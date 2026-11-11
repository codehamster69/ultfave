import { SITE_NAME } from "@/lib/seo";

const MARK_PATH = "M6 4H22V44H42V4H46L58 16V60H6Z";

const WORDMARK_GLYPHS: Array<{ d: string; x: number; evenOdd?: boolean }> = [
  { d: "M0 0H20V80H58V0H78V100H0Z", x: 0 },
  { d: "M0 0H20V80H58V100H0Z", x: 86 },
  { d: "M0 0H70V20H45V100H25V20H0Z", x: 152 },
  { d: "M0 0H58V20H20V43H52V63H20V100H0Z", x: 230 },
  { d: "M24 0H56L80 100H59L51 70H29L21 100H0ZM40 20L47 52H33Z", x: 296, evenOdd: true },
  { d: "M0 0H21L38 80L55 0H76L47 100H29Z", x: 384 },
  { d: "M0 0H58V20H20V42H52V62H20V80H58V100H0Z", x: 468 },
];

/** The Folded U. Inherits currentColor. */
export function LogoMark({ className = "h-5 w-5", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path fill="currentColor" d={MARK_PATH} />
    </svg>
  );
}

export function LogoWordmark({ className = "h-3.5 w-auto", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="-6 -6 538 112"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <g fill="currentColor">
        {WORDMARK_GLYPHS.map((glyph) => (
          <path
            key={glyph.x}
            d={glyph.d}
            fillRule={glyph.evenOdd ? "evenodd" : undefined}
            transform={glyph.x ? `translate(${glyph.x} 0)` : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

/** Primary lockup: coral mark plus a wordmark in the current text colour. */
export function Logo({
  className = "",
  markClassName = "h-[1.15rem] w-[1.15rem]",
  wordmarkClassName = "h-[0.95rem] w-auto",
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <LogoMark className={`${markClassName} text-lime`} />
      {showWordmark ? <LogoWordmark className={`${wordmarkClassName} text-fg`} /> : null}
      <span className="sr-only">{SITE_NAME}</span>
    </span>
  );
}
