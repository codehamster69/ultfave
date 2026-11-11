import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og-fonts";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const alt = `${SITE_NAME} - fan leaderboards for Spotify listeners`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori cannot read CSS variables; these mirror the @theme tokens in globals.css.
const BRAND = {
  ink: "#150A12",
  panel: "#1E1019",
  line: "#40283A",
  fg: "#F7EDE3",
  muted: "#B9A3AE",
  coral: "#FF5236",
  brass: "#F2B24C",
  cold: "#93A7FF",
  rose: "#F2417C",
} as const;

const SAMPLE_BOARD = [
  { rank: 1, handle: "@nightshift", points: "2,418", tone: BRAND.brass },
  { rank: 2, handle: "@lilaloop", points: "2,301", tone: BRAND.cold },
  { rank: 3, handle: "@cratekid", points: "2,276", tone: BRAND.rose },
];

export default async function OpengraphImage() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BRAND.ink,
          color: BRAND.fg,
          fontFamily: "Bricolage Grotesque",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {[680, 520, 380, 250].map((diameter, index) => (
          <div
            key={diameter}
            style={{
              position: "absolute",
              right: 210 - diameter / 2,
              top: 40 - diameter / 2,
              width: diameter,
              height: diameter,
              borderRadius: diameter,
              background: BRAND.coral,
              opacity: 0.05 + index * 0.035,
              display: "flex",
            }}
          />
        ))}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="54" height="54" viewBox="0 0 64 64">
              <path fill={BRAND.coral} d="M6 4H22V44H42V4H46L58 16V60H6Z" />
            </svg>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6 }}>{SITE_NAME.toUpperCase()}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 0.92, letterSpacing: -4, maxWidth: 660 }}>
              {SITE_TAGLINE}
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, color: BRAND.muted, marginTop: 28, maxWidth: 600 }}>
              Minutes in. Rank out. Weekly, monthly and yearly fan boards for the artists you play on repeat.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignSelf: "flex-end",
            width: 380,
            background: BRAND.panel,
            border: `1px solid ${BRAND.line}`,
            borderRadius: 28,
            padding: 28,
            gap: 16,
          }}
        >
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: BRAND.muted, fontFamily: "JetBrains Mono" }}>THIS WEEK</div>
          {SAMPLE_BOARD.map((row) => (
            <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}>
              <div style={{ display: "flex", color: row.tone, fontWeight: 800, width: 40 }}>{row.rank}</div>
              <div style={{ display: "flex", flex: 1, fontWeight: 500 }}>{row.handle}</div>
              <div style={{ display: "flex", color: BRAND.muted, fontFamily: "JetBrains Mono" }}>{row.points}</div>
            </div>
          ))}
          <div style={{ display: "flex", height: 1, background: BRAND.line }} />
          <div style={{ display: "flex", fontSize: 20, color: BRAND.coral }}>The board remembers.</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
