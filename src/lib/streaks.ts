import { all, get, run } from "@/lib/db";
import { addDays } from "@/lib/period";
import type { UserStreak } from "@/lib/types";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WALK = 400;

type StreakRow = {
  current: number;
  longest: number;
  lastDay: string | null;
};

/**
 * Records that `userId` listened to `artistId` on `day` (YYYY-MM-DD, UTC) and
 * recomputes the consecutive-day streak ending at that day. Older days (or a
 * repeat of the current last day) are no-ops so out-of-order syncs never
 * shorten a streak.
 */
export async function awardStreakDay(userId: string, artistId: string, day: string): Promise<void> {
  if (!userId || !artistId || !DAY_KEY.test(day)) return;

  const scored = await get<{ points: number }>(
    `SELECT points FROM daily_scores
     WHERE user_id = ? AND artist_id = ? AND day = ?
     LIMIT 1`,
    [userId, artistId, day],
  );
  if (!scored || scored.points <= 0) return;

  const existing = await get<StreakRow>(
    `SELECT current, longest, last_day AS "lastDay"
     FROM streaks
     WHERE user_id = ? AND artist_id = ?
     LIMIT 1`,
    [userId, artistId],
  );

  if (existing?.lastDay) {
    if (day < existing.lastDay) return;
    if (day === existing.lastDay) return;
  }

  const days = await all<{ day: string }>(
    `SELECT DISTINCT day FROM daily_scores
     WHERE user_id = ? AND artist_id = ? AND day <= ? AND points > 0
     ORDER BY day DESC
     LIMIT ?`,
    [userId, artistId, day, MAX_WALK],
  );

  let current = 0;
  let cursor = day;
  for (const row of days) {
    if (row.day !== cursor) break;
    current += 1;
    cursor = addDays(cursor, -1);
  }
  if (current === 0) return;

  const longest = Math.max(existing?.longest ?? 0, current);

  await run(
    `INSERT INTO streaks (user_id, artist_id, current, longest, last_day)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, artist_id) DO UPDATE SET
       current = excluded.current,
       longest = excluded.longest,
       last_day = excluded.last_day`,
    [userId, artistId, current, longest, day],
  );
}

/** Streaks for a user, artist names joined, strongest current streak first. */
export async function getUserStreaks(userId: string, limit: number = 10): Promise<UserStreak[]> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 10)));

  return all<UserStreak>(
    `SELECT s.artist_id AS "artistId",
            a.name AS "artistName",
            a.image_url AS "imageUrl",
            s.current AS "current",
            s.longest AS "longest",
            s.last_day AS "lastDay"
     FROM streaks s
     JOIN artists a ON a.id = s.artist_id
     WHERE s.user_id = ?
     ORDER BY s.current DESC, s.longest DESC, a.name ASC
     LIMIT ?`,
    [userId, safeLimit],
  );
}
