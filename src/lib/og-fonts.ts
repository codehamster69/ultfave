import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" };

const FONT_DIR = join(process.cwd(), "src/assets/fonts");

const FONT_FILES: Array<{ name: string; file: string; weight: 500 | 800 }> = [
  { name: "Bricolage Grotesque", file: "bricolage-grotesque-latin-800.woff", weight: 800 },
  { name: "Bricolage Grotesque", file: "bricolage-grotesque-latin-500.woff", weight: 500 },
  { name: "JetBrains Mono", file: "jetbrains-mono-latin-500.woff", weight: 500 },
];

let cached: Promise<OgFont[]> | null = null;

/** Brand fonts for next/og, read from disk once per instance. Falls back to Satori's default font. */
export function loadOgFonts(): Promise<OgFont[]> {
  cached ??= Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => {
      const buffer = await readFile(join(FONT_DIR, file));
      const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      return { name, data, weight, style: "normal" as const };
    }),
  ).catch(() => {
    cached = null;
    return [];
  });
  return cached;
}
