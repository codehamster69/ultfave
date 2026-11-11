import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });
const sql = readFileSync(join(root, "src/lib/schema.sql"), "utf8");
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await db.execute(statement);
}
console.log(`Applied ${statements.length} statements to ${url}`);
db.close();
