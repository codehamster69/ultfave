import { all, get } from "@/lib/db";
import { periodRange } from "@/lib/period";
import type {
  ArtistLeaderboardRow,
  ArtistSummary,
  LeaderboardRow,
  Period,
  SessionUser,
  UserBadge,
  UserProfile,
  UserStreak,
} from "@/lib/types";

type ScoreRow = {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  points: unknown;
  minutes: unknown;
  plays: unknown;
  isFriend?: unknown;
};

type ArtistRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: unknown;
  followers: unknown;
};

type BadgeChip = LeaderboardRow["badges"][number];

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGenres(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((g): g is string => typeof g === "string");
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g): g is string => typeof g === "string");
  } catch {
    return [];
  }
}

function toArtistSummary(row: ArtistRow): ArtistSummary {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl ?? null,
    genres: parseGenres(row.genres),
    followers: num(row.followers),
  };
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/**
 * Aggregates daily_scores for one artist (or all artists when artistId is null)
 * over an inclusive day range, one row per user, ordered for ranking.
 */
async function loadUserScores(
  artistId: string | null,
  start: string,
  end: string,
  options: { userIds?: string[] | null; viewerId?: string | null } = {},
): Promise<ScoreRow[]> {
  const { userIds = null, viewerId = null } = options;
  const where: string[] = ["ds.day >= ? AND ds.day <= ?"];
  const whereArgs: (string | number)[] = [start, end];
  const selectArgs: (string | number)[] = [];

  if (artistId) {
    where.push("ds.artist_id = ?");
    whereArgs.push(artistId);
  }

  if (userIds) {
    if (userIds.length === 0) return [];
    where.push(`ds.user_id IN (${placeholders(userIds.length)})`);
    whereArgs.push(...userIds);
  }

  let friendSelect = `0 AS "isFriend"`;
  if (viewerId) {
    friendSelect = `EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = u.id) AS "isFriend"`;
    selectArgs.push(viewerId);
  }

  const sql = `
    SELECT ds.user_id AS "userId",
           u.display_name AS "name",
           u.handle AS "handle",
           u.avatar_url AS "avatarUrl",
           SUM(ds.points) AS "points",
           SUM(ds.minutes) AS "minutes",
           SUM(ds.plays) AS "plays",
           ${friendSelect}
    FROM daily_scores ds
    JOIN users u ON u.id = ds.user_id
    WHERE ${where.join(" AND ")}
    GROUP BY ds.user_id
    HAVING SUM(ds.points) > 0
    ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, ds.user_id ASC
  `;

  const rows = await all<ScoreRow>(sql, [...selectArgs, ...whereArgs]);
  return rows.map((row) => ({
    ...row,
    points: num(row.points),
    minutes: num(row.minutes),
    plays: num(row.plays),
  }));
}

function rankByUser(rows: ScoreRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  rows.forEach((row, index) => ranks.set(row.userId, index + 1));
  return ranks;
}

/** One query for all badge chips on a set of users, capped at three each. */
async function loadBadgeChips(userIds: string[]): Promise<Map<string, BadgeChip[]>> {
  const result = new Map<string, BadgeChip[]>();
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return result;

  const rows = await all<{
    userId: string;
    id: string;
    name: string;
    icon: string;
    tier: string;
  }>(
    `SELECT ub.user_id AS "userId", b.id AS "id", b.name AS "name",
            b.icon AS "icon", b.tier AS "tier"
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id IN (${placeholders(ids.length)})
     ORDER BY ub.earned_at DESC, b.id ASC`,
    ids,
  );

  for (const row of rows) {
    const chips = result.get(row.userId) ?? [];
    if (chips.length >= 3) continue;
    if (chips.some((chip) => chip.id === row.id)) continue;
    chips.push({ id: row.id, name: row.name, icon: row.icon, tier: row.tier });
    result.set(row.userId, chips);
  }
  return result;
}

async function buildLeaderboard(options: {
  artistId: string | null;
  period: Period;
  viewerId: string | null;
  limit: number;
  userIds?: string[] | null;
  friendIds?: Set<string> | null;
}): Promise<LeaderboardRow[]> {
  const { artistId, period, viewerId, limit, userIds = null, friendIds = null } = options;
  const range = periodRange(period);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;

  const [current, previous] = await Promise.all([
    loadUserScores(artistId, range.start, range.end, { userIds, viewerId }),
    loadUserScores(artistId, range.prevStart, range.prevEnd, { userIds }),
  ]);

  if (current.length === 0) return [];

  const prevRanks = rankByUser(previous);

  const rows: LeaderboardRow[] = current.map((row, index) => {
    const rank = index + 1;
    const prevRank = prevRanks.get(row.userId) ?? null;
    const friend = friendIds
      ? friendIds.has(row.userId) && row.userId !== viewerId
      : Boolean(num(row.isFriend)) && row.userId !== viewerId;
    return {
      rank,
      prevRank,
      delta: prevRank === null ? null : prevRank - rank,
      userId: row.userId,
      name: row.name,
      handle: row.handle,
      avatarUrl: row.avatarUrl ?? null,
      points: row.points as number,
      minutes: row.minutes as number,
      plays: row.plays as number,
      isMe: viewerId !== null && row.userId === viewerId,
      isFriend: friend,
      badges: [],
    };
  });

  const visible = rows.slice(0, safeLimit);
  if (viewerId) {
    const viewerRow = rows.find((row) => row.userId === viewerId);
    if (viewerRow && !visible.some((row) => row.userId === viewerId)) {
      visible.push(viewerRow);
    }
  }

  const badgeMap = await loadBadgeChips(visible.map((row) => row.userId));
  for (const row of visible) {
    row.badges = badgeMap.get(row.userId) ?? [];
  }

  return visible;
}

export async function getArtist(artistId: string): Promise<ArtistSummary | null> {
  const row = await get<ArtistRow>(
    `SELECT id AS "id", name AS "name", image_url AS "imageUrl",
            genres AS "genres", followers AS "followers"
     FROM artists
     WHERE id = ?
     LIMIT 1`,
    [artistId],
  );
  return row ? toArtistSummary(row) : null;
}

/** Resolves a public handle to the user's bare profile. Returns null when no user matches. */
export async function getUserByHandle(handle: string): Promise<{
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  isDemo: boolean;
} | null> {
  const row = await get<{
    id: string;
    display_name: string;
    handle: string;
    avatar_url: string | null;
    is_demo: number;
  }>(
    `SELECT id AS "id", display_name AS "display_name", handle AS "handle",
            avatar_url AS "avatarUrl", is_demo AS "isDemo"
     FROM users
     WHERE handle = ?
     LIMIT 1`,
    [handle],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    isDemo: row.is_demo === 1,
  };
}

export async function listArtists(limit = 50): Promise<ArtistSummary[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const rows = await all<ArtistRow>(
    `SELECT id AS "id", name AS "name", image_url AS "imageUrl",
            genres AS "genres", followers AS "followers"
     FROM artists
     ORDER BY followers DESC, name ASC
     LIMIT ?`,
    [safeLimit],
  );
  return rows.map(toArtistSummary);
}

export async function getArtistLeaderboard(
  artistId: string,
  period: Period,
  viewerId: string | null,
  limit = 50,
): Promise<LeaderboardRow[]> {
  return buildLeaderboard({ artistId, period, viewerId, limit });
}

export async function getGlobalArtistLeaderboard(
  period: Period,
  limit = 20,
): Promise<ArtistLeaderboardRow[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const range = periodRange(period);

  const [current, previous] = await Promise.all([
    all<{
      id: string;
      name: string;
      imageUrl: string | null;
      genres: unknown;
      followers: unknown;
      points: unknown;
      minutes: unknown;
      plays: unknown;
      fans: unknown;
    }>(
      `SELECT a.id AS "id", a.name AS "name", a.image_url AS "imageUrl",
              a.genres AS "genres", a.followers AS "followers",
              COALESCE(SUM(ds.points), 0) AS "points",
              COALESCE(SUM(ds.minutes), 0) AS "minutes",
              COALESCE(SUM(ds.plays), 0) AS "plays",
              COUNT(DISTINCT CASE WHEN ds.points > 0 THEN ds.user_id END) AS "fans"
       FROM artists a
       LEFT JOIN daily_scores ds
         ON ds.artist_id = a.id AND ds.day >= ? AND ds.day <= ?
       GROUP BY a.id
       ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, a.id ASC
       LIMIT ?`,
      [range.start, range.end, safeLimit],
    ),
    all<{ artistId: string; points: unknown; minutes: unknown }>(
      `SELECT ds.artist_id AS "artistId",
              SUM(ds.points) AS "points",
              SUM(ds.minutes) AS "minutes"
       FROM daily_scores ds
       WHERE ds.day >= ? AND ds.day <= ?
       GROUP BY ds.artist_id
       HAVING SUM(ds.points) > 0
       ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, ds.artist_id ASC`,
      [range.prevStart, range.prevEnd],
    ),
  ]);

  if (current.length === 0) return [];

  const prevRanks = new Map<string, number>();
  previous.forEach((row, index) => prevRanks.set(row.artistId, index + 1));

  const topFans = await Promise.all(
    current.map(async (row) => {
      const fan = await get<{ name: string; handle: string; avatarUrl: string | null }>(
        `SELECT u.display_name AS "name", u.handle AS "handle", u.avatar_url AS "avatarUrl"
         FROM daily_scores ds
         JOIN users u ON u.id = ds.user_id
         WHERE ds.artist_id = ? AND ds.day >= ? AND ds.day <= ?
         GROUP BY ds.user_id
         HAVING SUM(ds.points) > 0
         ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, ds.user_id ASC
         LIMIT 1`,
        [row.id, range.start, range.end],
      );
      return fan
        ? { name: fan.name, handle: fan.handle, avatarUrl: fan.avatarUrl ?? null }
        : null;
    }),
  );

  return current.map((row, index) => {
    const rank = index + 1;
    const prevRank = prevRanks.get(row.id) ?? null;
    return {
      rank,
      prevRank,
      delta: prevRank === null ? null : prevRank - rank,
      artist: toArtistSummary({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        genres: row.genres,
        followers: row.followers,
      }),
      points: num(row.points),
      minutes: num(row.minutes),
      plays: num(row.plays),
      fans: num(row.fans),
      topFan: topFans[index] ?? null,
    };
  });
}

export async function getUserArtistStanding(
  userId: string,
  artistId: string,
  period: Period,
): Promise<{ rank: number; total: number; points: number; prevRank: number | null } | null> {
  const range = periodRange(period);
  const current = await loadUserScores(artistId, range.start, range.end);

  const index = current.findIndex((row) => row.userId === userId);
  if (index === -1) return null;

  const previous = await loadUserScores(artistId, range.prevStart, range.prevEnd);
  const prevRank = rankByUser(previous).get(userId) ?? null;

  return {
    rank: index + 1,
    total: current.length,
    points: current[index].points as number,
    prevRank,
  };
}

export async function getUserTotals(
  userId: string,
  period: Period,
): Promise<{ points: number; minutes: number; plays: number }> {
  const range = periodRange(period);
  const row = await get<{ points: unknown; minutes: unknown; plays: unknown }>(
    `SELECT COALESCE(SUM(points), 0) AS "points",
            COALESCE(SUM(minutes), 0) AS "minutes",
            COALESCE(SUM(plays), 0) AS "plays"
     FROM daily_scores
     WHERE user_id = ? AND day >= ? AND day <= ?`,
    [userId, range.start, range.end],
  );
  return {
    points: num(row?.points),
    minutes: num(row?.minutes),
    plays: num(row?.plays),
  };
}

export async function getFriendsLeaderboard(
  viewerId: string,
  artistId: string | null,
  period: Period,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const followees = await all<{ id: string }>(
    `SELECT followee_id AS "id" FROM follows WHERE follower_id = ?`,
    [viewerId],
  );

  const friendIds = new Set(followees.map((row) => row.id).filter((id) => id !== viewerId));
  const userIds = [viewerId, ...Array.from(friendIds)];

  return buildLeaderboard({
    artistId,
    period,
    viewerId,
    limit,
    userIds,
    friendIds,
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRow = await get<{
    id: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
    isDemo: unknown;
  }>(
    `SELECT id AS "id", display_name AS "name", handle AS "handle",
            avatar_url AS "avatarUrl", is_demo AS "isDemo"
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  if (!userRow) return null;

  const user: SessionUser = {
    id: userRow.id,
    name: userRow.name,
    handle: userRow.handle,
    avatarUrl: userRow.avatarUrl ?? null,
    isDemo: Boolean(num(userRow.isDemo)),
  };

  const monthRange = periodRange("month");
  const yearRange = periodRange("year");

  const [badgeRows, streakRows, topArtistRows, yearTotals, artistCount] = await Promise.all([
    all<{
      id: string;
      name: string;
      description: string;
      icon: string;
      tier: string;
      artistId: string | null;
      artistName: string | null;
      earnedAt: string;
    }>(
      `SELECT b.id AS "id", b.name AS "name", b.description AS "description",
              b.icon AS "icon", b.tier AS "tier",
              ub.artist_id AS "artistId", a.name AS "artistName",
              ub.earned_at AS "earnedAt"
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       LEFT JOIN artists a ON a.id = ub.artist_id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC, b.id ASC`,
      [userId],
    ),
    all<{
      artistId: string;
      artistName: string;
      imageUrl: string | null;
      current: unknown;
      longest: unknown;
      lastDay: string | null;
    }>(
      `SELECT s.artist_id AS "artistId", a.name AS "artistName", a.image_url AS "imageUrl",
              s.current AS "current", s.longest AS "longest", s.last_day AS "lastDay"
       FROM streaks s
       JOIN artists a ON a.id = s.artist_id
       WHERE s.user_id = ?
       ORDER BY s.current DESC, a.name ASC
       LIMIT 10`,
      [userId],
    ),
    all<{
      artistId: string;
      artistName: string;
      imageUrl: string | null;
      points: unknown;
      minutes: unknown;
    }>(
      `SELECT ds.artist_id AS "artistId", a.name AS "artistName", a.image_url AS "imageUrl",
              SUM(ds.points) AS "points", SUM(ds.minutes) AS "minutes"
       FROM daily_scores ds
       JOIN artists a ON a.id = ds.artist_id
       WHERE ds.user_id = ? AND ds.day >= ? AND ds.day <= ?
       GROUP BY ds.artist_id
       HAVING SUM(ds.points) > 0
       ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, ds.artist_id ASC
       LIMIT 3`,
      [userId, monthRange.start, monthRange.end],
    ),
    getUserTotals(userId, "year"),
    get<{ count: unknown }>(
      `SELECT COUNT(DISTINCT artist_id) AS "count"
       FROM daily_scores
       WHERE user_id = ? AND day >= ? AND day <= ? AND points > 0`,
      [userId, yearRange.start, yearRange.end],
    ),
  ]);

  const badges: UserBadge[] = badgeRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    tier: row.tier as UserBadge["tier"],
    artistId: row.artistId ? row.artistId : null,
    artistName: row.artistName ?? null,
    earnedAt: row.earnedAt,
  }));

  const streaks: UserStreak[] = streakRows.map((row) => ({
    artistId: row.artistId,
    artistName: row.artistName,
    imageUrl: row.imageUrl ?? null,
    current: num(row.current),
    longest: num(row.longest),
    lastDay: row.lastDay ?? null,
  }));

  const topArtists = await Promise.all(
    topArtistRows.map(async (row) => {
      const standings = await loadUserScores(row.artistId, monthRange.start, monthRange.end);
      const index = standings.findIndex((entry) => entry.userId === userId);
      return {
        artistId: row.artistId,
        artistName: row.artistName,
        imageUrl: row.imageUrl ?? null,
        points: num(row.points),
        minutes: num(row.minutes),
        rank: index === -1 ? null : index + 1,
      };
    }),
  );

  return {
    user,
    badges,
    streaks,
    topArtists,
    totals: {
      points: yearTotals.points,
      minutes: yearTotals.minutes,
      plays: yearTotals.plays,
      artists: num(artistCount?.count),
    },
  };
}
