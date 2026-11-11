import { get, run } from "@/lib/db";
import { toDay, todayUtc } from "@/lib/period";
import type { SpotifyPlay } from "@/lib/types";
import {
  fetchRecentlyPlayed,
  isSpotifyConfigured,
  refreshAccessToken,
} from "@/lib/spotify";
import { awardStreakDay } from "@/lib/streaks";
import { detectOvertakes } from "@/lib/friends";
import { settleChallenges } from "@/lib/challenges";
import { evaluateBadges } from "@/lib/badges";

/** A single play can never count for more than 8 minutes (Spotify's 480000 ms cap). */
const MAX_PLAY_MS = 480_000;
/** Minutes per play credited to the fan. */
const _MAX_PLAY_MINUTES = MAX_PLAY_MS / 60_000;
/** Daily score tunables (frozen by the build contract). */
const POINTS_PER_DISTINCT_TRACK = 10;
const MAX_DISTINCT_TRACKS = 20;
const DAILY_PLAY_BONUS = 5;
/** Refresh the access token when it expires within this window. */
const REFRESH_WINDOW_SECONDS = 60;

type TokenRow = {
  id: string;
  spotifyAccessToken: string | null;
  spotifyRefreshToken: string | null;
  tokenExpiresAt: number | null;
};

type DailyAggregateRow = {
  minutes: number | null;
  plays: number | null;
  distinctTracks: number | null;
};

export type SyncResult = { imported: number; points: number; error?: string };

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function playMinutes(durationMs: number): number {
  const clamped = Math.min(Math.max(durationMs, 0), MAX_PLAY_MS);
  return round(clamped / 60_000, 3);
}

function playDay(playedAt: string): string | null {
  const parsed = new Date(playedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDay(parsed);
}

function playId(userId: string, play: SpotifyPlay): string {
  return `${userId}:${play.trackId}:${play.playedAt}`;
}

/**
 * Recomputes one user/artist/day row in daily_scores from the raw plays table.
 * points = minutes + 10 * min(distinct_tracks, 20) + 5 when at least one play exists.
 */
export async function recomputeDailyScore(
  userId: string,
  artistId: string,
  day: string,
): Promise<void> {
  const aggregate = await get<DailyAggregateRow>(
    `SELECT SUM(minutes) AS "minutes",
            COUNT(*) AS "plays",
            COUNT(DISTINCT track_id) AS "distinctTracks"
       FROM plays
      WHERE user_id = ? AND artist_id = ? AND day = ?`,
    [userId, artistId, day],
  );

  const plays = Number(aggregate?.plays ?? 0);
  // No plays left for this slice: leave whatever row exists untouched.
  if (!Number.isFinite(plays) || plays <= 0) return;

  const minutes = round(Number(aggregate?.minutes ?? 0), 3);
  const distinctTracks = Number(aggregate?.distinctTracks ?? 0);
  const points = round(
    minutes +
      POINTS_PER_DISTINCT_TRACK * Math.min(distinctTracks, MAX_DISTINCT_TRACKS) +
      DAILY_PLAY_BONUS,
    3,
  );

  await run(
    `INSERT INTO daily_scores (user_id, artist_id, day, points, minutes, plays, distinct_tracks)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, artist_id, day) DO UPDATE SET
       points = excluded.points,
       minutes = excluded.minutes,
       plays = excluded.plays,
       distinct_tracks = excluded.distinct_tracks`,
    [userId, artistId, day, points, minutes, plays, distinctTracks],
  );
}

async function readDailyPoints(userId: string, artistId: string, day: string): Promise<number> {
  const row = await get<{ points: number | null }>(
    `SELECT points FROM daily_scores WHERE user_id = ? AND artist_id = ? AND day = ?`,
    [userId, artistId, day],
  );
  return Number(row?.points ?? 0);
}

async function resolveAccessToken(user: TokenRow): Promise<{ accessToken: string } | { error: string }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = Number(user.tokenExpiresAt ?? 0);
  const accessToken = (user.spotifyAccessToken ?? "").trim();
  const refreshToken = (user.spotifyRefreshToken ?? "").trim();
  const needsRefresh = accessToken.length === 0 || expiresAt - nowSeconds <= REFRESH_WINDOW_SECONDS;

  if (!needsRefresh) return { accessToken };

  if (refreshToken.length === 0) {
    return { error: "Spotify access token expired and no refresh token is stored for this fan" };
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const nextExpiry = nowSeconds + refreshed.expiresIn;
    await run(
      `UPDATE users
          SET spotify_access_token = ?,
              spotify_refresh_token = ?,
              token_expires_at = ?
        WHERE id = ?`,
      [refreshed.accessToken, refreshed.refreshToken ?? refreshToken, nextExpiry, user.id],
    );
    return { accessToken: refreshed.accessToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Spotify refresh error";
    return { error: message };
  }
}

/**
 * Pulls the fan's 50 most recent Spotify plays, persists them, recomputes the affected
 * daily scores and runs the loyalty hooks (streaks, rivalries, challenges, badges).
 * Never throws for the "no credentials" path - it reports it through `error`.
 */
export async function syncUserPlays(userId: string): Promise<SyncResult> {
  if (!isSpotifyConfigured()) {
    return { imported: 0, points: 0, error: "Spotify is not configured on this deployment" };
  }

  const user = await get<TokenRow>(
    `SELECT id,
            spotify_access_token AS "spotifyAccessToken",
            spotify_refresh_token AS "spotifyRefreshToken",
            token_expires_at AS "tokenExpiresAt"
       FROM users
      WHERE id = ?`,
    [userId],
  );

  if (!user) {
    return { imported: 0, points: 0, error: "Fan not found" };
  }

  const accessTokenOrError = await resolveAccessToken(user);
  if ("error" in accessTokenOrError) {
    return { imported: 0, points: 0, error: accessTokenOrError.error };
  }

  let plays: SpotifyPlay[] = [];
  try {
    plays = await fetchRecentlyPlayed(accessTokenOrError.accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Spotify API error";
    return { imported: 0, points: 0, error: message };
  }

  // Deduplicate the payload itself so we never count the same play twice in one run.
  const unique = new Map<string, SpotifyPlay>();
  for (const play of plays) {
    unique.set(`${play.trackId}|${play.playedAt}`, play);
  }

  const artists = new Map<string, string>();
  const tracks = new Map<string, SpotifyPlay>();
  for (const play of unique.values()) {
    artists.set(play.artistId, play.artistName);
    tracks.set(play.trackId, play);
  }

  try {
    for (const [artistId, artistName] of artists) {
      await run(
        `INSERT OR IGNORE INTO artists (id, name, image_url, genres, followers)
         VALUES (?, ?, NULL, '[]', 0)`,
        [artistId, artistName],
      );
    }

    for (const play of tracks.values()) {
      await run(
        `INSERT OR REPLACE INTO tracks (id, artist_id, name, album_image, duration_ms)
         VALUES (?, ?, ?, ?, ?)`,
        [play.trackId, play.artistId, play.trackName, play.albumImage, play.durationMs],
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { imported: 0, points: 0, error: `Could not store Spotify catalogue: ${message}` };
  }

  const affected = new Map<string, { artistId: string; day: string }>();
  let imported = 0;

  for (const play of unique.values()) {
    const day = playDay(play.playedAt);
    if (!day) continue;

    try {
      const result = await run(
        `INSERT OR IGNORE INTO plays (id, user_id, track_id, artist_id, played_at, day, minutes, points, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'spotify')`,
        [
          playId(userId, play),
          userId,
          play.trackId,
          play.artistId,
          play.playedAt,
          day,
          playMinutes(play.durationMs),
          playMinutes(play.durationMs),
        ],
      );
      if (Number(result.rowsAffected ?? 0) > 0) {
        imported += 1;
        affected.set(`${play.artistId}|${day}`, { artistId: play.artistId, day });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      console.error(`[sync] failed to store play ${play.trackId} for ${userId}: ${message}`);
    }
  }

  // Recompute every touched user/artist/day and track the real points gained.
  const pointsByArtist = new Map<string, number>();
  const today = todayUtc();
  let totalPoints = 0;

  for (const { artistId, day } of affected.values()) {
    try {
      const before = await readDailyPoints(userId, artistId, day);
      await recomputeDailyScore(userId, artistId, day);
      const after = await readDailyPoints(userId, artistId, day);
      const delta = Math.max(after - before, 0);
      totalPoints += delta;
      // detectOvertakes compares today's standing, so only today's gain is relevant.
      if (day === today) {
        pointsByArtist.set(artistId, (pointsByArtist.get(artistId) ?? 0) + delta);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      console.error(`[sync] failed to recompute score ${userId}/${artistId}/${day}: ${message}`);
    }
  }

  // Post-steps: every hook is isolated so a single failure never aborts the sync.
  for (const { artistId, day } of affected.values()) {
    try {
      await awardStreakDay(userId, artistId, day);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown streak error";
      console.error(`[sync] awardStreakDay failed ${userId}/${artistId}/${day}: ${message}`);
    }
  }

  for (const [artistId, pointsAdded] of pointsByArtist) {
    if (pointsAdded <= 0) continue;
    try {
      await detectOvertakes(userId, artistId, pointsAdded);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown overtake error";
      console.error(`[sync] detectOvertakes failed ${userId}/${artistId}: ${message}`);
    }
  }

  try {
    await settleChallenges(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown challenge error";
    console.error(`[sync] settleChallenges failed ${userId}: ${message}`);
  }

  try {
    await evaluateBadges(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown badge error";
    console.error(`[sync] evaluateBadges failed ${userId}: ${message}`);
  }

  try {
    await run(`UPDATE users SET last_synced_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      userId,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    console.error(`[sync] failed to stamp last_synced_at for ${userId}: ${message}`);
  }

  return { imported, points: round(totalPoints, 1) };
}
