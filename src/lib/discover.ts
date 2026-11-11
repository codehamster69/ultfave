import { all } from "@/lib/db";
import { addDays, periodRange, todayUtc } from "@/lib/period";
import type { Period } from "@/lib/types";

/**
 * Discover: browse every artist board with search, genre facets and sorts.
 *
 * Every value that comes from the caller is bound as a parameter. The only
 * string interpolated into SQL is the ORDER BY clause, which is picked from a
 * fixed whitelist keyed by the validated sort id.
 */

export const DISCOVER_SORTS = ["points", "rising", "fans", "az"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const SPARK_DAYS = 14;
export const DISCOVER_MAX_RESULTS = 200;
export const DISCOVER_QUERY_MAX = 64;
export const DISCOVER_GENRE_MAX = 48;

export function isDiscoverSort(value: string | null | undefined): value is DiscoverSort {
  return typeof value === "string" && (DISCOVER_SORTS as readonly string[]).includes(value);
}

export type DiscoverArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number;
  /** Rank among all artists by fan points this period (1-based). */
  rank: number;
  /** Rank in the previous period, null when the artist had no points then. */
  prevRank: number | null;
  /** prevRank - rank; positive means climbed. */
  delta: number | null;
  points: number;
  prevPoints: number;
  minutes: number;
  /** Distinct fans who scored this period. */
  fans: number;
  /** Daily fan points for the last SPARK_DAYS days, oldest first. */
  spark: number[];
  /** Viewer standing on this artist's board this period, when signed in. */
  me: { rank: number; total: number; points: number } | null;
};

export type GenreFacet = { name: string; count: number };

export type DiscoverResult = {
  period: Period;
  sort: DiscoverSort;
  q: string;
  genre: string | null;
  artists: DiscoverArtist[];
  /** Genre chips, derived from every artist (not just the filtered set). */
  genres: GenreFacet[];
  /** Artists on Ultfave before any filter. */
  totalArtists: number;
  /** Distinct fans scoring anywhere this period. */
  activeFans: number;
  sparkStart: string;
  sparkEnd: string;
};

export type DiscoverInput = {
  q?: string | null;
  genre?: string | null;
  sort?: DiscoverSort;
  period?: Period;
  viewerId?: string | null;
};

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGenres(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g): g is string => typeof g === "string" && g.trim().length > 0);
  } catch {
    return [];
  }
}

/** Escape LIKE wildcards so user input only ever matches literally (ESCAPE '\'). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Collapse whitespace, strip control characters, cap length. */
export function normalizeQuery(value: string | null | undefined, max = DISCOVER_QUERY_MAX): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const ORDER_BY: Record<DiscoverSort, string> = {
  points: `r.rank ASC`,
  // Biggest climb first; artists new to the board count as a climb from below
  // the last ranked spot. Ties fall back to the current board order.
  rising: `CASE WHEN r.points > 0 THEN 0 ELSE 1 END ASC,
           COALESCE(r.prevRank, r.boardSize + 1) - r.rank DESC,
           r.points - r.prevPoints DESC,
           r.rank ASC`,
  fans: `r.fans DESC, r.points DESC, r.followers DESC, r.rank ASC`,
  az: `r.name COLLATE NOCASE ASC, r.id ASC`,
};

type RankedRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: unknown;
  followers: unknown;
  points: unknown;
  minutes: unknown;
  fans: unknown;
  rank: unknown;
  prevRank: unknown;
  prevPoints: unknown;
};

export async function getDiscoverArtists(input: DiscoverInput = {}): Promise<DiscoverResult> {
  const period: Period = input.period ?? "week";
  const sort: DiscoverSort = input.sort ?? "points";
  const q = normalizeQuery(input.q);
  const genre = normalizeQuery(input.genre, DISCOVER_GENRE_MAX).toLowerCase() || null;
  const viewerId = input.viewerId ?? null;

  const range = periodRange(period);
  const sparkEnd = todayUtc();
  const sparkStart = addDays(sparkEnd, -(SPARK_DAYS - 1));

  const filters: string[] = [];
  const filterArgs: string[] = [];
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    filters.push(
      `(r.name LIKE ? ESCAPE '\\' OR EXISTS (
         SELECT 1 FROM json_each(CASE WHEN json_valid(r.genres) THEN r.genres ELSE '[]' END) g
         WHERE g.value LIKE ? ESCAPE '\\'))`,
    );
    filterArgs.push(pattern, pattern);
  }
  if (genre) {
    filters.push(
      `EXISTS (
         SELECT 1 FROM json_each(CASE WHEN json_valid(r.genres) THEN r.genres ELSE '[]' END) g
         WHERE lower(g.value) = ?)`,
    );
    filterArgs.push(genre);
  }

  const rankedSql = `
    WITH cur AS (
      SELECT ds.artist_id AS artist_id,
             SUM(ds.points) AS points,
             SUM(ds.minutes) AS minutes,
             COUNT(DISTINCT CASE WHEN ds.points > 0 THEN ds.user_id END) AS fans
      FROM daily_scores ds
      WHERE ds.day >= ? AND ds.day <= ?
      GROUP BY ds.artist_id
    ),
    prev AS (
      SELECT ds.artist_id AS artist_id,
             SUM(ds.points) AS points,
             ROW_NUMBER() OVER (
               ORDER BY SUM(ds.points) DESC, SUM(ds.minutes) DESC, ds.artist_id ASC
             ) AS rank
      FROM daily_scores ds
      WHERE ds.day >= ? AND ds.day <= ?
      GROUP BY ds.artist_id
      HAVING SUM(ds.points) > 0
    ),
    ranked AS (
      SELECT a.id AS id,
             a.name AS name,
             a.image_url AS imageUrl,
             a.genres AS genres,
             a.followers AS followers,
             COALESCE(cur.points, 0) AS points,
             COALESCE(cur.minutes, 0) AS minutes,
             COALESCE(cur.fans, 0) AS fans,
             ROW_NUMBER() OVER (
               ORDER BY COALESCE(cur.points, 0) DESC, COALESCE(cur.minutes, 0) DESC, a.id ASC
             ) AS rank,
             prev.rank AS prevRank,
             COALESCE(prev.points, 0) AS prevPoints,
             (SELECT COUNT(*) FROM prev) AS boardSize
      FROM artists a
      LEFT JOIN cur ON cur.artist_id = a.id
      LEFT JOIN prev ON prev.artist_id = a.id
    )
    SELECT r.id AS "id", r.name AS "name", r.imageUrl AS "imageUrl", r.genres AS "genres",
           r.followers AS "followers", r.points AS "points", r.minutes AS "minutes",
           r.fans AS "fans", r.rank AS "rank", r.prevRank AS "prevRank",
           r.prevPoints AS "prevPoints"
    FROM ranked r
    ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY ${ORDER_BY[sort]}
    LIMIT ?
  `;

  const [rows, facetRows, activeRow] = await Promise.all([
    all<RankedRow>(rankedSql, [
      range.start,
      range.end,
      range.prevStart,
      range.prevEnd,
      ...filterArgs,
      DISCOVER_MAX_RESULTS,
    ]),
    all<{ genres: unknown }>(`SELECT genres AS "genres" FROM artists`),
    all<{ fans: unknown }>(
      `SELECT COUNT(DISTINCT user_id) AS "fans"
       FROM daily_scores
       WHERE day >= ? AND day <= ? AND points > 0`,
      [range.start, range.end],
    ),
  ]);

  const facetMap = new Map<string, GenreFacet>();
  for (const row of facetRows) {
    const seen = new Set<string>();
    for (const raw of parseGenres(row.genres)) {
      const key = raw.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = facetMap.get(key);
      if (existing) existing.count += 1;
      else facetMap.set(key, { name: key, count: 1 });
    }
  }
  const genres = Array.from(facetMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  const ids = rows.map((row) => row.id);
  const [sparkRows, meRows] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([] as { artistId: string; day: string; points: unknown }[])
      : all<{ artistId: string; day: string; points: unknown }>(
          `SELECT artist_id AS "artistId", day AS "day", SUM(points) AS "points"
           FROM daily_scores
           WHERE day >= ? AND day <= ?
             AND artist_id IN (${ids.map(() => "?").join(", ")})
           GROUP BY artist_id, day`,
          [sparkStart, sparkEnd, ...ids],
        ),
    !viewerId || ids.length === 0
      ? Promise.resolve([] as { artistId: string; rank: unknown; total: unknown; points: unknown }[])
      : all<{ artistId: string; rank: unknown; total: unknown; points: unknown }>(
          `WITH s AS (
             SELECT artist_id, user_id, SUM(points) AS p, SUM(minutes) AS m
             FROM daily_scores
             WHERE day >= ? AND day <= ?
               AND artist_id IN (${ids.map(() => "?").join(", ")})
             GROUP BY artist_id, user_id
             HAVING SUM(points) > 0
           ),
           r AS (
             SELECT artist_id, user_id, p,
                    ROW_NUMBER() OVER (
                      PARTITION BY artist_id ORDER BY p DESC, m DESC, user_id ASC
                    ) AS rk,
                    COUNT(*) OVER (PARTITION BY artist_id) AS total
             FROM s
           )
           SELECT artist_id AS "artistId", rk AS "rank", total AS "total", p AS "points"
           FROM r
           WHERE user_id = ?`,
          [range.start, range.end, ...ids, viewerId],
        ),
  ]);

  const dayIndex = new Map<string, number>();
  for (let i = 0; i < SPARK_DAYS; i += 1) dayIndex.set(addDays(sparkStart, i), i);
  const sparks = new Map<string, number[]>();
  for (const row of sparkRows) {
    const index = dayIndex.get(row.day);
    if (index === undefined) continue;
    let series = sparks.get(row.artistId);
    if (!series) {
      series = Array.from({ length: SPARK_DAYS }, () => 0);
      sparks.set(row.artistId, series);
    }
    series[index] = Math.round(num(row.points));
  }

  const mine = new Map<string, DiscoverArtist["me"]>();
  for (const row of meRows) {
    mine.set(row.artistId, { rank: num(row.rank), total: num(row.total), points: num(row.points) });
  }

  const artists: DiscoverArtist[] = rows.map((row) => {
    const rank = num(row.rank);
    const prevRank = row.prevRank === null || row.prevRank === undefined ? null : num(row.prevRank);
    return {
      id: row.id,
      name: row.name,
      imageUrl: typeof row.imageUrl === "string" && row.imageUrl.length > 0 ? row.imageUrl : null,
      genres: parseGenres(row.genres).map((g) => g.toLowerCase()),
      followers: num(row.followers),
      rank,
      prevRank,
      delta: prevRank === null ? null : prevRank - rank,
      points: Math.round(num(row.points)),
      prevPoints: Math.round(num(row.prevPoints)),
      minutes: Math.round(num(row.minutes)),
      fans: num(row.fans),
      spark: sparks.get(row.id) ?? Array.from({ length: SPARK_DAYS }, () => 0),
      me: mine.get(row.id) ?? null,
    };
  });

  return {
    period,
    sort,
    q,
    genre,
    artists,
    genres,
    totalArtists: facetRows.length,
    activeFans: num(activeRow[0]?.fans),
    sparkStart,
    sparkEnd,
  };
}

/** Plain A-Z list of every artist, so crawlers always reach each board. */
export async function listArtistIndex(): Promise<{ id: string; name: string }[]> {
  return all<{ id: string; name: string }>(
    `SELECT id AS "id", name AS "name" FROM artists ORDER BY name COLLATE NOCASE ASC, id ASC LIMIT 1000`,
  );
}
