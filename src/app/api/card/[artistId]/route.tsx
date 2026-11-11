import { ImageResponse } from "next/og";
import { getSession } from "@/lib/auth";
import { get } from "@/lib/db";
import { formatPoints, isPeriod, periodRange } from "@/lib/period";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import type { Period, SessionUser } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const INK = "#150a12";
const FG = "#f7ede3";
const MUTED = "#b9a3ae";
const LINE = "#40283a";
const LIME = "#ff5236";
const DIM = "#454d5f";

const PERIOD_WORD: Record<Period, string> = {
  week: "THIS WEEK",
  month: "THIS MONTH",
  year: "THIS YEAR",
};

const MONOGRAM_GRADIENTS: { from: string; to: string }[] = [
  { from: "#1d2433", to: "#2c3547" },
  { from: "#1f2a24", to: "#2b3a30" },
  { from: "#241f31", to: "#342b45" },
  { from: "#2a2320", to: "#3a3029" },
  { from: "#1c2831", to: "#273a46" },
  { from: "#2b1f26", to: "#3b2a33" },
];

type ArtistRow = { id: string; name: string };

type ViewerCard = {
  user: SessionUser | null;
  points: number;
  rank: number | null;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "UF";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  const initials = `${first}${last}`.toUpperCase();
  return initials.length > 0 ? initials : "FR";
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function loadArtist(artistId: string): Promise<ArtistRow | null> {
  return get<ArtistRow>(`SELECT id, name FROM artists WHERE id = ?`, [artistId]);
}

async function loadViewer(artistId: string, period: Period, user: SessionUser): Promise<ViewerCard> {
  const range = periodRange(period);

  const mine = await get<{ points: number | null; minutes: number | null }>(
    `SELECT COALESCE(SUM(points), 0) AS points,
            COALESCE(SUM(minutes), 0) AS minutes
       FROM daily_scores
      WHERE user_id = ? AND artist_id = ? AND day >= ? AND day <= ?`,
    [user.id, artistId, range.start, range.end],
  );

  const points = Number(mine?.points ?? 0);
  const minutes = Number(mine?.minutes ?? 0);
  if (!Number.isFinite(points) || points <= 0) {
    return { user, points: 0, rank: null };
  }

  const ahead = await get<{ ahead: number }>(
    `SELECT COUNT(*) AS ahead
       FROM (
         SELECT ds.user_id AS user_id,
                SUM(ds.points) AS points,
                SUM(ds.minutes) AS minutes
           FROM daily_scores ds
           JOIN users u ON u.id = ds.user_id
          WHERE ds.artist_id = ? AND ds.day >= ? AND ds.day <= ?
          GROUP BY ds.user_id
         HAVING SUM(ds.points) > 0
       ) s
      WHERE s.points > ?
         OR (s.points = ? AND s.minutes > ?)
         OR (s.points = ? AND s.minutes = ? AND s.user_id < ?)`,
    [artistId, range.start, range.end, points, points, minutes, points, minutes, user.id],
  );

  return { user, points: Math.round(points), rank: Number(ahead?.ahead ?? 0) + 1 };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ artistId: string }> },
): Promise<Response> {
  // OG image rendering is CPU heavy (satori), so it gets its own budget.
  const limited = enforceRateLimit(request, RATE_LIMITS.card);
  if (limited) return limited;

  const { artistId } = await context.params;
  if (!artistId || artistId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(artistId)) {
    return jsonError("Artist not found", 404);
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedPeriod = searchParams.get("period");
  const period: Period = isPeriod(requestedPeriod) ? requestedPeriod : "week";
  const range = periodRange(period);

  let artist: ArtistRow | null = null;
  try {
    artist = await loadArtist(artistId);
  } catch (error) {
    console.error("card: failed to load artist", error);
    return jsonError("Could not load artist", 500);
  }

  if (!artist) {
    return jsonError("Artist not found", 404);
  }

  let user: SessionUser | null = null;
  try {
    user = await getSession();
  } catch {
    user = null;
  }

  let viewer: ViewerCard = { user: null, points: 0, rank: null };
  if (user) {
    try {
      viewer = await loadViewer(artistId, period, user);
    } catch (error) {
      console.error("card: failed to load viewer standing", error);
      viewer = { user, points: 0, rank: null };
    }
  }

  const artistName = artist.name.toUpperCase();
  const ranked = viewer.rank !== null;
  const rankText = ranked ? String(viewer.rank) : "\u2014";
  const rankDigits = String(viewer.rank ?? 0).length;
  const rankSize = ranked ? (rankDigits <= 2 ? 196 : rankDigits === 3 ? 148 : 112) : 140;
  const rankColor = ranked ? LIME : DIM;
  const nameSize =
    artistName.length <= 10 ? 76 : artistName.length <= 14 ? 66 : artistName.length <= 20 ? 54 : 46;

  const handleText = viewer.user ? `@${viewer.user.handle}` : "@ultfave";
  const monogram = viewer.user ? initialsOf(viewer.user.name) : "FR";
  const gradient = MONOGRAM_GRADIENTS[hashString(viewer.user?.name ?? artistName) % MONOGRAM_GRADIENTS.length] ?? MONOGRAM_GRADIENTS[0]!;

  const pointsLabel = viewer.user ? formatPoints(viewer.points) : "\u2014";
  const noteText = !viewer.user
    ? "SIGN IN TO CLAIM YOUR CARD"
    : ranked
      ? null
      : "SYNC YOUR PLAYS TO GET RANKED";

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          background: INK,
          color: FG,
          padding: "48px 64px 38px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -270,
            right: -150,
            width: 600,
            height: 600,
            borderRadius: 300,
            background: "rgba(255, 82, 54, 0.09)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            left: -180,
            width: 600,
            height: 600,
            borderRadius: 300,
            background: "rgba(147, 167, 255, 0.12)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 5,
            height: CARD_HEIGHT,
            background: "rgba(255, 82, 54, 0.22)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 12,
                height: 26,
                borderRadius: 2,
                background: LIME,
                marginRight: 12,
              }}
            />
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 10, color: FG }}>ULTFAVE</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: `1px solid ${LINE}`,
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 13,
              letterSpacing: 4,
              color: MUTED,
              background: "rgba(30, 16, 25, 0.72)",
            }}
          >
            {`${PERIOD_WORD[period]} \u00b7 ${range.label.toUpperCase()}`}
          </div>
        </div>

        <div style={{ display: "flex", flexGrow: 1, alignItems: "center", marginTop: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 400 }}>
            <div style={{ display: "flex", fontSize: 13, letterSpacing: 6, color: MUTED }}>YOUR RANK</div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 4 }}>
              {ranked ? (
                <div style={{ display: "flex", fontSize: 52, color: rankColor, marginTop: 30, marginRight: 6 }}>
                  #
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontSize: rankSize,
                  lineHeight: 1,
                  letterSpacing: -6,
                  color: rankColor,
                }}
              >
                {rankText}
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  border: `1px solid ${ranked ? "rgba(255, 82, 54, 0.45)" : LINE}`,
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 12,
                  letterSpacing: 4,
                  color: ranked ? LIME : MUTED,
                  background: ranked ? "rgba(255, 82, 54, 0.08)" : "rgba(30, 16, 25, 0.7)",
                }}
              >
                {ranked ? "RANKED" : "UNRANKED"}
              </div>
            </div>
            {noteText ? (
              <div style={{ display: "flex", fontSize: 11, letterSpacing: 3, color: MUTED, marginTop: 12 }}>
                {noteText}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: 26 }}>
            <div style={{ display: "flex", fontSize: 12, letterSpacing: 6, color: MUTED }}>FAN OF</div>
            <div style={{ display: "flex", maxWidth: 648, marginTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: nameSize,
                  lineHeight: 1.04,
                  letterSpacing: -2,
                  color: FG,
                }}
              >
                {artistName}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 34, letterSpacing: 12, color: LIME, marginTop: 8 }}>
              FAN
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  border: `1px solid ${ranked ? "rgba(255, 82, 54, 0.5)" : LINE}`,
                  background: `linear-gradient(140deg, ${gradient.from}, ${gradient.to})`,
                  fontSize: 18,
                  letterSpacing: 1,
                  color: ranked ? LIME : FG,
                }}
              >
                {monogram}
              </div>
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 1, color: FG, marginLeft: 14 }}>
                {handleText}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 24 }}>
              <div style={{ display: "flex", fontSize: 50, letterSpacing: 2, color: FG, lineHeight: 1 }}>
                {pointsLabel}
              </div>
              <div style={{ display: "flex", fontSize: 12, letterSpacing: 4, color: MUTED, marginLeft: 14, marginBottom: 8 }}>
                {`PTS \u00b7 ${PERIOD_WORD[period]}`}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 1, background: LINE, marginBottom: 14 }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 12, letterSpacing: 5, color: MUTED }}>
              {"DON'T JUST LISTEN. PROVE IT."}
            </div>
            <div style={{ display: "flex", fontSize: 12, letterSpacing: 5, color: MUTED }}>ultfave.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=300",
        Vary: "Cookie",
      },
    },
  );
}
