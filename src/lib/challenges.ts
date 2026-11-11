import { all, get, run } from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { todayUtc } from "@/lib/period";
import type { Challenge } from "@/lib/types";

type Metric = Challenge["metric"];

type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  artistId: string | null;
  artistName: string | null;
  metric: string;
  target: number;
  bonusPoints: number;
  startsOn: string;
  endsOn: string;
  participants: number | null;
  joined: number | null;
  completed: number | null;
  progress: number | null;
};

type SettleRow = {
  id: string;
  title: string;
  artistId: string | null;
  metric: string;
  target: number;
  bonusPoints: number;
  startsOn: string;
  endsOn: string;
};

function asMetric(value: string | null): Metric {
  if (value === "plays" || value === "distinct_tracks" || value === "minutes") return value;
  return "minutes";
}

function roundProgress(value: number): number {
  return Math.round(value * 10) / 10;
}

/** daily_scores column that backs a challenge metric. Allowlisted, never user input. */
function metricColumn(metric: Metric): "minutes" | "plays" | "distinct_tracks" {
  if (metric === "plays") return "plays";
  if (metric === "distinct_tracks") return "distinct_tracks";
  return "minutes";
}

async function userLabel(userId: string): Promise<string> {
  const row = await get<{ name: string | null }>(
    "SELECT display_name AS name FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const name = (row?.name ?? "").trim();
  return name || "A fan";
}

async function sumProgress(
  userId: string,
  metric: Metric,
  startsOn: string,
  endsOn: string,
  artistId: string | null,
): Promise<number> {
  const column = metricColumn(metric);
  const artistFilter = artistId ? " AND artist_id = ?" : "";
  const args: string[] = artistId
    ? [userId, startsOn, endsOn, artistId]
    : [userId, startsOn, endsOn];
  const row = await get<{ total: number | null }>(
    `SELECT COALESCE(SUM(${column}), 0) AS total
       FROM daily_scores
      WHERE user_id = ? AND day >= ? AND day <= ?${artistFilter}`,
    args,
  );
  return Number(row?.total ?? 0);
}

/** The user's highest-scoring artist inside a challenge window. */
async function topArtistForPeriod(
  userId: string,
  startsOn: string,
  endsOn: string,
): Promise<string | null> {
  const row = await get<{ artistId: string }>(
    `SELECT artist_id AS "artistId"
       FROM daily_scores
      WHERE user_id = ? AND day >= ? AND day <= ?
      GROUP BY artist_id
      ORDER BY SUM(points) DESC, artist_id ASC
      LIMIT 1`,
    [userId, startsOn, endsOn],
  );
  return row?.artistId ?? null;
}

/**
 * Challenges that are running today (inclusive window), with participant counts
 * and the viewer's own progress computed from daily_scores inside the window.
 */
export async function getActiveChallenges(viewerId: string | null): Promise<Challenge[]> {
  const today = todayUtc();
  const viewerKey = viewerId ?? "";

  const rows = await all<ChallengeRow>(
    `SELECT
       c.id AS id,
       c.title AS title,
       c.description AS description,
       c.artist_id AS "artistId",
       a.name AS "artistName",
       c.metric AS metric,
       c.target AS target,
       c.bonus_points AS "bonusPoints",
       c.starts_on AS "startsOn",
       c.ends_on AS "endsOn",
       (SELECT COUNT(*) FROM challenge_entries p WHERE p.challenge_id = c.id) AS participants,
       (SELECT COUNT(*) FROM challenge_entries j
         WHERE j.challenge_id = c.id AND j.user_id = ?) AS joined,
       (SELECT COUNT(*) FROM challenge_entries d
         WHERE d.challenge_id = c.id AND d.user_id = ? AND d.completed_at IS NOT NULL) AS completed,
       (SELECT COALESCE(SUM(
          CASE c.metric
            WHEN 'plays' THEN ds.plays
            WHEN 'distinct_tracks' THEN ds.distinct_tracks
            ELSE ds.minutes
          END
        ), 0)
          FROM daily_scores ds
         WHERE ds.user_id = ?
           AND ds.day >= c.starts_on
           AND ds.day <= c.ends_on
           AND (c.artist_id IS NULL OR ds.artist_id = c.artist_id)
       ) AS progress
     FROM challenges c
     LEFT JOIN artists a ON a.id = c.artist_id
     WHERE c.starts_on <= ? AND c.ends_on >= ?
     ORDER BY c.ends_on ASC, c.starts_on ASC, c.title ASC`,
    [viewerKey, viewerKey, viewerKey, today, today],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    artistId: row.artistId,
    artistName: row.artistName,
    metric: asMetric(row.metric),
    target: Number(row.target ?? 0),
    bonusPoints: Number(row.bonusPoints ?? 0),
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    joined: Number(row.joined ?? 0) > 0,
    completed: Number(row.completed ?? 0) > 0,
    progress: roundProgress(Number(row.progress ?? 0)),
    participants: Number(row.participants ?? 0),
  }));
}

/**
 * Idempotent enrollment. Re-joining a challenge succeeds without duplicating the
 * entry or logging a second event; out-of-window and unknown challenges fail.
 */
export async function joinChallenge(
  viewerId: string,
  challengeId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!viewerId) return { ok: false, error: "Sign in to join challenges." };

  const id = (challengeId ?? "").trim();
  if (!id) return { ok: false, error: "Challenge not found." };

  const challenge = await get<{
    id: string;
    title: string;
    artistId: string | null;
    startsOn: string;
    endsOn: string;
  }>(
    `SELECT id AS id, title AS title, artist_id AS "artistId",
            starts_on AS "startsOn", ends_on AS "endsOn"
       FROM challenges WHERE id = ? LIMIT 1`,
    [id],
  );

  if (!challenge) return { ok: false, error: "Challenge not found." };

  const today = todayUtc();
  if (today < challenge.startsOn) return { ok: false, error: "This challenge has not started yet." };
  if (today > challenge.endsOn) return { ok: false, error: "This challenge has already ended." };

  const inserted = await run(
    `INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id, joined_at)
     VALUES (?, ?, ?)`,
    [id, viewerId, new Date().toISOString()],
  );

  if (inserted.rowsAffected === 0) return { ok: true };

  const name = await userLabel(viewerId);
  await logEvent({
    kind: "join",
    actorId: viewerId,
    artistId: challenge.artistId,
    message: `${name} joined ${challenge.title}`,
    meta: { challengeId: id },
  });

  return { ok: true };
}

/**
 * Completes every joined, unfinished challenge whose progress now meets target.
 * The `completed_at IS NULL` guard on the UPDATE is the idempotency boundary:
 * only the caller that flips the row hands out bonus points, the badge and the
 * activity event.
 */
export async function settleChallenges(userId: string): Promise<void> {
  if (!userId) return;

  const today = todayUtc();
  const rows = await all<SettleRow>(
    `SELECT c.id AS id, c.title AS title, c.artist_id AS "artistId",
            c.metric AS metric, c.target AS target, c.bonus_points AS "bonusPoints",
            c.starts_on AS "startsOn", c.ends_on AS "endsOn"
       FROM challenge_entries ce
       JOIN challenges c ON c.id = ce.challenge_id
      WHERE ce.user_id = ? AND ce.completed_at IS NULL AND c.starts_on <= ?
      ORDER BY c.ends_on ASC`,
    [userId, today],
  );
  if (rows.length === 0) return;

  const name = await userLabel(userId);

  for (const row of rows) {
    const metric = asMetric(row.metric);
    const progress = await sumProgress(userId, metric, row.startsOn, row.endsOn, row.artistId);
    const target = Number(row.target ?? 0);
    if (!Number.isFinite(target) || progress < target) continue;

    const stamp = new Date().toISOString();
    const claimed = await run(
      `UPDATE challenge_entries
          SET completed_at = ?
        WHERE challenge_id = ? AND user_id = ? AND completed_at IS NULL`,
      [stamp, row.id, userId],
    );
    if (claimed.rowsAffected === 0) continue;

    const bonusPoints = Number(row.bonusPoints ?? 0);
    const artistId = row.artistId ?? (await topArtistForPeriod(userId, row.startsOn, row.endsOn));

    if (artistId && bonusPoints > 0) {
      // Upsert today's artist row so the bonus lands on the leaderboard.
      await run(
        `INSERT INTO daily_scores (user_id, artist_id, day, points, minutes, plays, distinct_tracks)
         VALUES (?, ?, ?, ?, 0, 0, 0)
         ON CONFLICT(user_id, artist_id, day)
         DO UPDATE SET points = daily_scores.points + excluded.points`,
        [userId, artistId, today, bonusPoints],
      );
    }

    // Global (non-artist) badge uses '' because SQLite treats NULL PKs as distinct.
    await run(
      `INSERT OR IGNORE INTO user_badges (user_id, badge_id, artist_id, earned_at)
       VALUES (?, 'challenger', '', ?)`,
      [userId, stamp],
    );

    await logEvent({
      kind: "challenge",
      actorId: userId,
      artistId,
      message: `${name} completed ${row.title}`,
      meta: {
        challengeId: row.id,
        metric,
        target,
        progress: roundProgress(progress),
        bonusPoints,
      },
    });
  }
}
