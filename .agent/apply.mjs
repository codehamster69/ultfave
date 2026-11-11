import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { agents } from "./agents.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(here, "out");

const owners = new Map();
for (const agent of agents) {
  for (const file of agent.files) {
    if (owners.has(file)) throw new Error(`Duplicate ownership: ${file} (${owners.get(file)} / ${agent.id})`);
    owners.set(file, agent.id);
  }
}

const written = [];
const missing = [];
const errors = [];

for (const agent of agents) {
  const filePath = join(outDir, `${agent.id}.md`);
  if (!existsSync(filePath)) {
    errors.push(`${agent.id}: no output file`);
    continue;
  }
  const raw = readFileSync(filePath, "utf8");
  const re = /=== FILE: (.+?) ===\r?\n([\s\S]*?)=== END FILE ===/g;
  const found = [];
  let match;
  while ((match = re.exec(raw)) !== null) {
    found.push({ path: match[1].trim(), body: match[2] });
  }

  if (found.length === 0) {
    errors.push(`${agent.id}: no file envelopes parsed`);
    continue;
  }

  for (const item of found) {
    const clean = normalize(item.path.replace(/^\.?\//, ""));
    if (clean.startsWith("..") || clean.includes("node_modules")) {
      errors.push(`${agent.id}: unsafe path ${clean}`);
      continue;
    }
    if (!owners.has(clean)) {
      errors.push(`${agent.id}: unowned file ${clean}`);
      continue;
    }
    if (owners.get(clean) !== agent.id) {
      errors.push(`${agent.id}: ${clean} belongs to ${owners.get(clean)}`);
      continue;
    }
    let body = item.body.replace(/^\r?\n/, "");
    if (/^```[a-z]*\r?\n/.test(body) && /\r?\n```\s*$/.test(body)) {
      body = body.replace(/^```[a-z]*\r?\n/, "").replace(/\r?\n```\s*$/, "");
    }
    if (/^<>|<{3,}|\.\.\.\s*$/m.test(body) && body.includes("...")) {
      // still write; typecheck will surface truncation
    }
    if (!body.endsWith("\n")) body += "\n";
    const target = join(root, clean);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    written.push(clean);
  }

  for (const file of agent.files) {
    if (!found.some((f) => normalize(f.path.replace(/^\.?\//, "")) === normalize(file))) {
      missing.push(`${agent.id}: missing ${file}`);
    }
  }
}

console.log(`Wrote ${written.length} files:`);
for (const f of written) console.log(`  + ${f}`);
if (missing.length) {
  console.log("\nMissing owned files:");
  for (const m of missing) console.log(`  ! ${m}`);
}
if (errors.length) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  x ${e}`);
  process.exitCode = 1;
}
