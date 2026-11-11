import { randomUUID } from "node:crypto";
import { all, run } from "@/lib/db";
import type { ActivityEvent } from "@/lib/types";

export type FeedScope = "global" | "friends";

const MAX_MESSAGE_LENGTH = 280;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type FeedRow = {
  id: string;
  kind: string;
  message: string;
  actorName: string | null;
  actorHandle: string | null;
  actorAvatarUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  createdAt: string;
  meta: string | null;
};

function clampMessage(message: string): string {
  const clean = (message ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_MESSAGE_LENGTH) return clean;
  return `${clean.slice(0, MAX_MESSAGE_LENGTH - 3).trimEnd()}...`;
}

function clampLimit(limit: number): number {
  const value = Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, value));
}

/**
 * Normalizes the two timestamp shapes that can land in the table: libSQL's
 * `datetime('now')` output ("YYYY-MM-DD HH:MM:SS", UTC, no zone marker) and
 * JS ISO strings. Clients need an unambiguous UTC instant for relative times.
 */
function normalizeTimestamp(value: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace(" ", "T")}.000Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw}.000Z`;
  }
  return raw;
}

function parseMeta(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function logEvent(input: {
  kind: string;
  actorId?: string | null;
  artistId?: string | null;
  targetUserId?: string | null;
  message: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const kind = (input.kind ?? "").trim();
  const message = clampMessage(input.message);
  if (!kind || !message) return;

  await run(
    `INSERT INTO activity_events
       (id, kind, actor_id, artist_id, target_user_id, message, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      kind.slice(0, 40),
      input.actorId ?? null,
      input.artistId ?? null,
      input.targetUserId ?? null,
      message,
      JSON.stringify(input.meta ?? {}),
      new Date().toISOString(),
    ],
  );
}

/**
 * Newest-first activity stream. `friends` means: the viewer acted, someone the
 * viewer follows acted, or the viewer was the target of the event. Signed-out
 * viewers have no circle, so a friends feed resolves to an empty stream rather
 * than leaking the global feed into a personalized view.
 */
export async function getFeed(
  viewerId: string | null,
  scope: FeedScope,
  limit = DEFAULT_LIMIT,
): Promise<ActivityEvent[]> {
  const capped = clampLimit(limit);
  const args: (string | number)[] = [];
  let where = "";

  if (scope === "friends") {
    if (!viewerId) return [];
    where = `WHERE (
      e.actor_id = ?
      OR e.target_user_id = ?
      OR e.actor_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)
    )`;
    args.push(viewerId, viewerId, viewerId);
  }

  args.push(capped);

  const rows = await all<FeedRow>(
    `SELECT
       e.id AS id,
       e.kind AS kind,
       e.message AS message,
       u.display_name AS "actorName",
       u.handle AS "actorHandle",
       u.avatar_url AS "actorAvatarUrl",
       e.artist_id AS "artistId",
       a.name AS "artistName",
       e.created_at AS "createdAt",
       e.meta AS meta
     FROM activity_events e
     LEFT JOIN users u ON u.id = e.actor_id
     LEFT JOIN artists a ON a.id = e.artist_id
     ${where}
     ORDER BY datetime(e.created_at) DESC, e.created_at DESC, e.id DESC
     LIMIT ?`,
    args,
  );

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    message: row.message,
    actorName: row.actorName,
    actorHandle: row.actorHandle,
    actorAvatarUrl: row.actorAvatarUrl,
    artistId: row.artistId,
    artistName: row.artistName,
    createdAt: normalizeTimestamp(row.createdAt),
    meta: parseMeta(row.meta),
  }));
}
