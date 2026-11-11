import { randomUUID } from "node:crypto";

import { all, batch, get, run } from "@/lib/db";
import { periodRange } from "@/lib/period";
import type { UserBadge } from "@/lib/types";

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  rule: string;
};

/**
 * The fixed badge catalogue. Ids, names, icons and tiers are frozen by the
 * build contract; rules are stable strings that repeat the tier.
 */
export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first-blood",
    name: "First Blood",
    description: "First fan to 100 points on an artist",
    icon: "bolt",
    tier: "bronze",
    rule: "bronze · be the first fan to reach 100 points on any artist",
  },
  {
    id: "streak-7",
    name: "Seven Day Fuse",
    description: "Seven straight days of listening to one artist",
    icon: "flame",
    tier: "silver",
    rule: "silver · keep a 7-day listening streak alive on one artist",
  },
  {
    id: "streak-30",
    name: "Unbroken",
    description: "Thirty straight days of listening to one artist",
    icon: "flame",
    tier: "gold",
    rule: "gold · keep a 30-day listening streak alive on one artist",
  },
  {
    id: "top-1",
    name: "Inner Circle",
    description: "Weekly top 1% of an artist's fans",
    icon: "crown",
    tier: "elite",
    rule: "elite · land in the weekly top 1% of an artist with 20+ fans",
  },
  {
    id: "crate-digger",
    name: "Crate Digger",
    description: "40 different tracks from one artist in a single week",
    icon: "disc",
    tier: "silver",
    rule: "silver · play 40 distinct tracks from one artist in one ISO week",
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "50 late-night plays for one artist, 00:00-05:00 UTC",
    icon: "moon",
    tier: "bronze",
    rule: "bronze · log 50 plays between 00:00 and 05:00 UTC on one artist",
  },
  {
    id: "rivalry",
    name: "Rivalry",
    description: "Overtook a friend on an artist leaderboard",
    icon: "swords",
    tier: "bronze",
    rule: "bronze · overtake a friend on an artist leaderboard",
  },
  {
    id: "challenger",
    name: "Challenger",
    description: "Completed a weekly challenge",
    icon: "trophy",
    tier: "gold",
    rule: "gold · complete a weekly challenge",
  },
];

export const BADGE_BY_ID = new Map<string, BadgeDef>(BADGE_DEFS.map((def) => [def.id, def]));

const BADGE_TIERS: UserBadge["tier"][] = ["bronze", "silver", "gold", "elite"];

function normaliseTier(tier: string | null | undefined): UserBadge["tier"] {
  return BADGE_TIERS.includes(tier as UserBadge["tier"]) ? (tier as UserBadge["tier"]) : "bronze";
}

/** Upserts every definition into `badges`. Safe to call repeatedly. */
export async function ensureBadges(): Promise<void> {
  await batch(
    BADGE_DEFS.map((def) => ({
      sql: `INSERT OR REPLACE INTO badges (id, name, description, icon, tier, rule)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [def.id, def.name, def.description, def.icon, def.tier, def.rule],
    })),
  );
}

let ensurePromise: Promise<void> | null = null;

function ensureBadgesOnce(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureBadges().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

type Candidate = {
  id: string;
  artistId: string;
  artistName: string | null;
};

async function firstBlood(userId: string): Promise<Candidate[]> {
  const rows = await all<{ artistId: string; artistName: string }>(
    `WITH cumulative AS (
       SELECT artist_id, user_id, day,
              SUM(points) OVER (
                PARTITION BY artist_id, user_id
                ORDER BY day
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS cum
       FROM daily_scores
     ), crossings AS (
       SELECT artist_id, user_id, MIN(day) AS crossed
       FROM cumulative
       WHERE cum >= 100
       GROUP BY artist_id, user_id
     ), firsts AS (
       SELECT artist_id, MIN(crossed) AS first_day
       FROM crossings
       GROUP BY artist_id
     )
     SELECT c.artist_id AS "artistId", a.name AS "artistName"
     FROM crossings c
     JOIN firsts f ON f.artist_id = c.artist_id AND f.first_day = c.crossed
     JOIN artists a ON a.id = c.artist_id
     WHERE c.user_id = ?
     ORDER BY c.crossed ASC, a.name ASC
     LIMIT 1`,
    [userId],
  );
  return rows.map((row) => ({ id: "first-blood", artistId: row.artistId, artistName: row.artistName }));
}

async function streakBadge(userId: string, badgeId: string, threshold: number): Promise<Candidate[]> {
  const row = await get<{ artistId: string; artistName: string }>(
    `SELECT s.artist_id AS "artistId", a.name AS "artistName"
     FROM streaks s
     JOIN artists a ON a.id = s.artist_id
     WHERE s.user_id = ? AND s.current >= ?
     ORDER BY s.current DESC, s.longest DESC, a.name ASC
     LIMIT 1`,
    [userId, threshold],
  );
  return row ? [{ id: badgeId, artistId: row.artistId, artistName: row.artistName }] : [];
}

async function topOnePercent(userId: string): Promise<Candidate[]> {
  const week = periodRange("week");
  const row = await get<{ artistId: string; artistName: string; rank: number; fans: number }>(
    `WITH fan_points AS (
       SELECT artist_id, user_id, SUM(points) AS pts
       FROM daily_scores
       WHERE day BETWEEN ? AND ?
       GROUP BY artist_id, user_id
     ), ranked AS (
       SELECT artist_id, user_id, pts,
              ROW_NUMBER() OVER (PARTITION BY artist_id ORDER BY pts DESC, user_id ASC) AS rn,
              COUNT(*) OVER (PARTITION BY artist_id) AS fans
       FROM fan_points
     )
     SELECT r.artist_id AS "artistId", a.name AS "artistName", r.rn AS "rank", r.fans AS "fans"
     FROM ranked r
     JOIN artists a ON a.id = r.artist_id
     WHERE r.user_id = ?
       AND r.fans >= 20
       AND r.rn <= MAX(1, CAST((r.fans + 99) / 100 AS INTEGER))
     ORDER BY r.rn ASC, r.fans DESC, a.name ASC
     LIMIT 1`,
    [week.start, week.end, userId],
  );
  return row ? [{ id: "top-1", artistId: row.artistId, artistName: row.artistName }] : [];
}

async function crateDigger(userId: string): Promise<Candidate[]> {
  const row = await get<{ artistId: string; artistName: string; tracks: number }>(
    `SELECT p.artist_id AS "artistId", a.name AS "artistName",
            COUNT(DISTINCT p.track_id) AS "tracks"
     FROM plays p
     JOIN artists a ON a.id = p.artist_id
     WHERE p.user_id = ?
     GROUP BY p.artist_id,
              date(p.day, '-' || ((CAST(strftime('%w', p.day) AS INTEGER) + 6) % 7) || ' days')
     HAVING COUNT(DISTINCT p.track_id) >= 40
     ORDER BY COUNT(DISTINCT p.track_id) DESC, a.name ASC
     LIMIT 1`,
    [userId],
  );
  return row ? [{ id: "crate-digger", artistId: row.artistId, artistName: row.artistName }] : [];
}

async function nightOwl(userId: string): Promise<Candidate[]> {
  const row = await get<{ artistId: string; artistName: string; plays: number }>(
    `SELECT p.artist_id AS "artistId", a.name AS "artistName", COUNT(*) AS "plays"
     FROM plays p
     JOIN artists a ON a.id = p.artist_id
     WHERE p.user_id = ?
       AND p.played_at IS NOT NULL
       AND CAST(substr(p.played_at, 12, 2) AS INTEGER) < 5
     GROUP BY p.artist_id
     HAVING COUNT(*) >= 50
     ORDER BY COUNT(*) DESC, a.name ASC
     LIMIT 1`,
    [userId],
  );
  return row ? [{ id: "night-owl", artistId: row.artistId, artistName: row.artistName }] : [];
}

async function rivalry(userId: string): Promise<Candidate[]> {
  const row = await get<{ artistId: string | null; artistName: string | null }>(
    `SELECT e.artist_id AS "artistId", a.name AS "artistName"
     FROM activity_events e
     LEFT JOIN artists a ON a.id = e.artist_id
     WHERE e.kind = 'overtake' AND e.actor_id = ?
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [userId],
  );
  return row ? [{ id: "rivalry", artistId: row.artistId ?? "", artistName: row.artistName }] : [];
}

async function challenger(userId: string): Promise<Candidate[]> {
  const row = await get<{ artistId: string | null; artistName: string | null }>(
    `SELECT c.artist_id AS "artistId", a.name AS "artistName"
     FROM challenge_entries ce
     JOIN challenges c ON c.id = ce.challenge_id
     LEFT JOIN artists a ON a.id = c.artist_id
     WHERE ce.user_id = ? AND ce.completed_at IS NOT NULL
     ORDER BY ce.completed_at DESC
     LIMIT 1`,
    [userId],
  );
  return row ? [{ id: "challenger", artistId: row.artistId ?? "", artistName: row.artistName }] : [];
}

/**
 * Evaluates every badge rule for a user, awards the newly eligible ones
 * (`INSERT OR IGNORE`, `artist_id = ''` for global badges) and logs one
 * `badge` activity event per award. Returns only the newly earned badges.
 */
export async function evaluateBadges(userId: string): Promise<UserBadge[]> {
  await ensureBadgesOnce();

  const owner = await get<{ name: string }>(
    `SELECT display_name AS "name" FROM users WHERE id = ?`,
    [userId],
  );
  if (!owner) return [];

  const ownedRows = await all<{ badgeId: string }>(
    `SELECT badge_id AS "badgeId" FROM user_badges WHERE user_id = ?`,
    [userId],
  );
  const owned = new Set(ownedRows.map((row) => row.badgeId));

  const candidates: Candidate[] = [];
  const collect = async (badgeId: string, load: () => Promise<Candidate[]>) => {
    if (owned.has(badgeId)) return;
    const found = await load();
    for (const candidate of found) candidates.push(candidate);
  };

  await collect("first-blood", () => firstBlood(userId));
  await collect("streak-7", () => streakBadge(userId, "streak-7", 7));
  await collect("streak-30", () => streakBadge(userId, "streak-30", 30));
  await collect("top-1", () => topOnePercent(userId));
  await collect("crate-digger", () => crateDigger(userId));
  await collect("night-owl", () => nightOwl(userId));
  await collect("rivalry", () => rivalry(userId));
  await collect("challenger", () => challenger(userId));

  const earned: UserBadge[] = [];
  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const def = BADGE_BY_ID.get(candidate.id);
    if (!def) continue;
    const key = `${candidate.id}:${candidate.artistId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const inserted = await run(
      `INSERT OR IGNORE INTO user_badges (user_id, badge_id, artist_id, earned_at)
       VALUES (?, ?, ?, ?)`,
      [userId, candidate.id, candidate.artistId, now],
    );
    if (inserted.rowsAffected === 0) continue;

    const message = candidate.artistName
      ? `${owner.name} earned ${def.name} on ${candidate.artistName}`
      : `${owner.name} earned ${def.name}`;

    await run(
      `INSERT INTO activity_events (id, kind, actor_id, artist_id, target_user_id, message, meta, created_at)
       VALUES (?, 'badge', ?, ?, NULL, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        candidate.artistId === "" ? null : candidate.artistId,
        message.slice(0, 280),
        JSON.stringify({ badgeId: def.id, badgeName: def.name, tier: def.tier, artistId: candidate.artistId || null }),
        now,
      ],
    );

    earned.push({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      tier: normaliseTier(def.tier),
      artistId: candidate.artistId === "" ? null : candidate.artistId,
      artistName: candidate.artistName,
      earnedAt: now,
    });
  }

  return earned;
}

/** All badges earned by a user, artist names joined, newest first. */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const rows = await all<{
    id: string;
    name: string | null;
    description: string | null;
    icon: string | null;
    tier: string | null;
    artistId: string | null;
    artistName: string | null;
    earnedAt: string;
  }>(
    `SELECT ub.badge_id AS "id",
            b.name AS "name",
            b.description AS "description",
            b.icon AS "icon",
            b.tier AS "tier",
            NULLIF(ub.artist_id, '') AS "artistId",
            a.name AS "artistName",
            ub.earned_at AS "earnedAt"
     FROM user_badges ub
     LEFT JOIN badges b ON b.id = ub.badge_id
     LEFT JOIN artists a ON a.id = NULLIF(ub.artist_id, '')
     WHERE ub.user_id = ?
     ORDER BY ub.earned_at DESC, ub.badge_id ASC`,
    [userId],
  );

  return rows.map((row) => {
    const def = BADGE_BY_ID.get(row.id);
    return {
      id: row.id,
      name: row.name ?? def?.name ?? row.id,
      description: row.description ?? def?.description ?? "",
      icon: row.icon ?? def?.icon ?? "bolt",
      tier: normaliseTier(row.tier ?? def?.tier),
      artistId: row.artistId ?? null,
      artistName: row.artistName ?? null,
      earnedAt: row.earnedAt,
    };
  });
}
