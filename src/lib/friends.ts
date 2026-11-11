import { all, get, run } from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { periodRange, todayUtc } from "@/lib/period";
import type { Period } from "@/lib/types";

type Rivalry = {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  myPoints: number;
  theirPoints: number;
  diff: number;
  ahead: boolean;
};

type FriendRow = {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
};

type ScoreRow = {
  userId: string;
  artistId: string;
  artistName: string | null;
  points: number;
};

type FriendScoreRow = {
  userId: string;
  name: string;
  points: number;
};

type ArtistBucket = { points: number; artistName: string | null };

const RIVALRY_LIMIT = 12;

function totalPoints(bucket: Map<string, ArtistBucket>): number {
  let total = 0;
  for (const entry of bucket.values()) total += entry.points;
  return total;
}

export async function followUser(viewerId: string, targetId: string): Promise<void> {
  if (!viewerId || !targetId) return;
  if (viewerId === targetId) return;
  await run(
    `INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)`,
    [viewerId, targetId],
  );
}

export async function unfollowUser(viewerId: string, targetId: string): Promise<void> {
  if (!viewerId || !targetId) return;
  await run(
    `DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`,
    [viewerId, targetId],
  );
}

export async function isFollowing(viewerId: string, targetId: string): Promise<boolean> {
  if (!viewerId || !targetId) return false;
  if (viewerId === targetId) return false;
  const row = await get<{ hits: number }>(
    `SELECT COUNT(*) AS hits FROM follows WHERE follower_id = ? AND followee_id = ?`,
    [viewerId, targetId],
  );
  return Number(row?.hits ?? 0) > 0;
}

export async function getRivalries(viewerId: string, period: Period): Promise<Rivalry[]> {
  if (!viewerId) return [];

  const range = periodRange(period);

  const friends = await all<FriendRow>(
    `SELECT u.id AS "userId", u.display_name AS "name", u.handle AS "handle", u.avatar_url AS "avatarUrl"
       FROM follows f
       JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = ?
      ORDER BY u.display_name ASC`,
    [viewerId],
  );
  if (friends.length === 0) return [];

  const rows = await all<ScoreRow>(
    `SELECT ds.user_id AS "userId",
            ds.artist_id AS "artistId",
            ar.name AS "artistName",
            SUM(ds.points) AS "points"
       FROM daily_scores ds
       LEFT JOIN artists ar ON ar.id = ds.artist_id
      WHERE ds.day >= ? AND ds.day <= ?
        AND (ds.user_id = ? OR ds.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
      GROUP BY ds.user_id, ds.artist_id`,
    [range.start, range.end, viewerId, viewerId],
  );

  const byUser = new Map<string, Map<string, ArtistBucket>>();
  for (const row of rows) {
    const points = Number(row.points ?? 0);
    if (!(points > 0)) continue;
    let bucket = byUser.get(row.userId);
    if (!bucket) {
      bucket = new Map<string, ArtistBucket>();
      byUser.set(row.userId, bucket);
    }
    bucket.set(row.artistId, { points, artistName: row.artistName ?? null });
  }

  const mine = byUser.get(viewerId) ?? new Map<string, ArtistBucket>();

  const rivalries: Rivalry[] = friends.map((friend) => {
    const theirs = byUser.get(friend.userId) ?? new Map<string, ArtistBucket>();

    let sharedArtistId: string | null = null;
    let sharedArtistName: string | null = null;
    let sharedMine = 0;
    let sharedTheirs = 0;
    let bestCombined = -1;

    for (const [artistId, theirScore] of theirs) {
      const myScore = mine.get(artistId);
      if (!myScore) continue;
      const combined = myScore.points + theirScore.points;
      if (combined > bestCombined) {
        bestCombined = combined;
        sharedArtistId = artistId;
        sharedArtistName = theirScore.artistName ?? myScore.artistName;
        sharedMine = myScore.points;
        sharedTheirs = theirScore.points;
      }
    }

    const hasShared = sharedArtistId !== null;
    const myPoints = hasShared ? sharedMine : totalPoints(mine);
    const theirPoints = hasShared ? sharedTheirs : totalPoints(theirs);
    const diff = myPoints - theirPoints;

    return {
      userId: friend.userId,
      name: friend.name,
      handle: friend.handle,
      avatarUrl: friend.avatarUrl ?? null,
      artistId: sharedArtistId,
      artistName: hasShared ? sharedArtistName : null,
      myPoints,
      theirPoints,
      diff,
      ahead: diff > 0,
    };
  });

  rivalries.sort((a, b) => {
    const byGap = Math.abs(b.diff) - Math.abs(a.diff);
    if (byGap !== 0) return byGap;
    const byTheirs = b.theirPoints - a.theirPoints;
    if (byTheirs !== 0) return byTheirs;
    return a.name.localeCompare(b.name);
  });

  return rivalries.slice(0, RIVALRY_LIMIT);
}

export async function detectOvertakes(
  userId: string,
  artistId: string,
  pointsAdded: number,
): Promise<void> {
  if (!userId || !artistId) return;
  if (!Number.isFinite(pointsAdded) || pointsAdded <= 0) return;

  const day = todayUtc();

  const mine = await get<{ points: number }>(
    `SELECT COALESCE(SUM(points), 0) AS "points"
       FROM daily_scores
      WHERE user_id = ? AND artist_id = ? AND day = ?`,
    [userId, artistId, day],
  );
  const currentPoints = Number(mine?.points ?? 0);
  const previousPoints = currentPoints - pointsAdded;

  const friends = await all<FriendScoreRow>(
    `SELECT u.id AS "userId",
            u.display_name AS "name",
            COALESCE(SUM(ds.points), 0) AS "points"
       FROM follows f
       JOIN users u ON u.id = f.followee_id
       LEFT JOIN daily_scores ds
         ON ds.user_id = u.id AND ds.artist_id = ? AND ds.day = ?
      WHERE f.follower_id = ?
      GROUP BY u.id, u.display_name`,
    [artistId, day, userId],
  );
  if (friends.length === 0) return;

  const actor = await get<{ name: string }>(
    `SELECT display_name AS "name" FROM users WHERE id = ?`,
    [userId],
  );
  if (!actor) return;

  const artist = await get<{ name: string }>(
    `SELECT name AS "name" FROM artists WHERE id = ?`,
    [artistId],
  );
  if (!artist) return;

  for (const friend of friends) {
    const friendPoints = Number(friend.points ?? 0);
    const crossed = previousPoints <= friendPoints && currentPoints > friendPoints;
    if (!crossed) continue;

    const existing = await get<{ hit: number }>(
      `SELECT 1 AS "hit"
         FROM activity_events
        WHERE kind = 'overtake'
          AND actor_id = ?
          AND target_user_id = ?
          AND artist_id = ?
          AND substr(created_at, 1, 10) = ?
        LIMIT 1`,
      [userId, friend.userId, artistId, day],
    );
    if (existing) continue;

    try {
      await logEvent({
        kind: "overtake",
        actorId: userId,
        artistId,
        targetUserId: friend.userId,
        message: `${actor.name} just overtook ${friend.name} on ${artist.name}`,
        meta: {
          points: currentPoints,
          previousPoints,
          friendPoints,
          artistId,
          artistName: artist.name,
          day,
        },
      });
    } catch {
      // Never let activity logging break a sync.
    }
  }
}
