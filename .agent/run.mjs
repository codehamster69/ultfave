import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { agents } from "./agents.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(here, "out");
mkdirSync(outDir, { recursive: true });

const KEY_FILE = process.env.EXPLABS_API_KEY_FILE || join(homedir(), ".config", "experiential", "api_key");
const BASE_URL = (process.env.EXPLABS_BASE_URL || "https://api.experientiallabs.ai/v1").replace(/\/+$/, "");
const MODEL = process.env.EXPLABS_MODEL || "claude-fable-5.2";
const apiKey = (process.env.EXPLABS_API_KEY || readFileSync(KEY_FILE, "utf8")).trim();
const contract = readFileSync(join(here, "CONTRACT.md"), "utf8");

const SYSTEM = `You are a senior full-stack engineer shipping production code in a strict parallel build. You follow a frozen interface contract exactly. You never invent shared names, routes, tables, or dependencies. You output COMPLETE files only, in the mandated envelope format, with no prose. Code must typecheck under TypeScript strict and build with Next.js 15.5 App Router and React 19.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAgent(agent) {
  const owned = agent.files.map((f) => `- ${f}`).join("\n");
  const prompt = `${contract}

## YOUR ASSIGNMENT — ${agent.id.toUpperCase()}: ${agent.title}

You own exactly these files (write nothing else):
${owned}

${agent.brief}

## Reminder
- Output only complete file envelopes. No markdown fences around file bodies. No commentary.
- Use the exact contract types and exports. Do not create helper files.
- Existing shared modules already exist; import them, never redefine them.
- Next.js 15.5: params/searchParams/cookies are async. Route handlers return Response/NextResponse.
- The database schema is already applied; do not emit SQL migration files.
- Date is 2026-11-10 UTC. All demo data must be relative to that date.
- If your work depends on a module owned by another worker, import the contract signature and use it; it will exist at integration time.`;

  const started = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 16000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(600_000),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 500)}`);
      const data = JSON.parse(raw);
      const content = data?.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => p?.text || "").join("") : "";
      if (!text.trim()) throw new Error("empty completion");
      writeFileSync(join(outDir, `${agent.id}.md`), text);
      writeFileSync(
        join(outDir, `${agent.id}.usage.json`),
        JSON.stringify({ model: data.model, usage: data.usage, ms: Date.now() - started, attempt }, null, 2),
      );
      console.log(`[ok] ${agent.id} ${agent.title} — ${text.length} chars, ${Math.round((Date.now() - started) / 1000)}s`);
      return;
    } catch (err) {
      const message = err?.name === "TimeoutError" ? "timeout" : err.message;
      console.log(`[retry ${attempt}/3] ${agent.id}: ${message}`);
      if (attempt === 3) {
        writeFileSync(join(outDir, `${agent.id}.error.txt`), String(message));
        console.log(`[fail] ${agent.id}`);
        return;
      }
      await sleep(attempt * 10_000);
    }
  }
}

console.log(`Dispatching ${agents.length} workers on ${MODEL} …`);
await Promise.all(agents.map(callAgent));
console.log("All workers finished.");
