import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

import {
  SENTINEL_CREATED_AT,
  SENTINEL_EVENT_ID,
  TEST_DB_FILE,
  TEST_DB_URL,
  TEST_ENV,
} from "./env";

/**
 * Runs once per `playwright test` invocation, before any spec.
 *
 * 1. delete every artefact of a previous run so the suite starts from an empty
 *    database (a stale `test.db` hides migration and seed regressions),
 * 2. apply the schema and run the idempotent seed against `test.db`,
 * 3. drop a sentinel row that the preflight spec uses to prove the server is
 *    bound to this database.
 *
 * `local.db` is never touched: the URL is always `file:test.db` and every child
 * process receives it explicitly through the environment.
 */
export default async function globalSetup(): Promise<void> {
  const root = process.cwd();

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    await rm(path.join(root, `${TEST_DB_FILE}${suffix}`), { force: true });
  }

  const env = { ...process.env, ...TEST_ENV };

  runScript(path.join(root, "scripts", "migrate.mjs"), env, "migrate");
  runScript(path.join(root, "scripts", "seed.mjs"), env, "seed");

  const db = createClient({ url: TEST_DB_URL });
  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO activity_events
              (id, kind, actor_id, artist_id, target_user_id, message, meta, created_at)
            VALUES (?, 'milestone', NULL, NULL, NULL, ?, '{}', ?)`,
      args: [SENTINEL_EVENT_ID, "e2e preflight sentinel", SENTINEL_CREATED_AT],
    });
  } finally {
    db.close();
  }

  console.log(`[e2e] test database ready: ${TEST_DB_URL}`);
}

function runScript(script: string, env: NodeJS.ProcessEnv, label: string): void {
  console.log(`[e2e] ${label}: ${path.relative(process.cwd(), script)}`);
  execFileSync(process.execPath, [script], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}
