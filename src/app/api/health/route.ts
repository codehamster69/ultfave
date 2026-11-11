import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";
import { all } from "@/lib/db";
import { getEnvReport, logEnvIssuesOnce } from "@/lib/env";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe.
 *
 * Returns a sanitized view of the deployment: DB reachability, app version and
 * the variable *names* of any configuration problems. Secret values are never
 * read into the response, and upstream error text is never echoed.
 */
const DB_PING_TIMEOUT_MS = 2_500;
const APP_VERSION = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

type DbCheck = { ok: boolean; latencyMs: number | null; error?: string };

async function pingDatabase(): Promise<DbCheck> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ping = all<{ ok: number }>("SELECT 1 AS ok");
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), DB_PING_TIMEOUT_MS);
      // Never keep the process alive just because of the probe timer.
      (timer as unknown as { unref?: () => void }).unref?.();
    });

    const rows = await Promise.race([ping, timeout]);
    const latencyMs = Date.now() - startedAt;
    const ok = Array.isArray(rows) && Number(rows[0]?.ok ?? 0) === 1;
    return { ok, latencyMs: ok ? latencyMs : null, ...(ok ? {} : { error: "unexpected_response" }) };
  } catch {
    return { ok: false, latencyMs: null, error: "database_unreachable" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.health);
  if (limited) return limited;

  // First health probe is also the place we surface configuration problems once.
  logEnvIssuesOnce();

  const [database, env] = await Promise.all([pingDatabase(), Promise.resolve(getEnvReport())]);

  const ok = database.ok && env.ok;
  const status = ok ? "ok" : "degraded";

  return NextResponse.json(
    {
      ok,
      status,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database,
        env: {
          ok: env.ok,
          mode: env.mode,
          // Names + human reasons only; no values, ever.
          fatal: env.fatal,
          warnings: env.warnings,
        },
        auth: {
          demo: env.features.demo,
          spotify: env.features.spotify,
          cron: env.features.cron,
          sessionSecret: env.features.sessionSecretConfigured,
        },
        data: {
          database: env.features.database,
        },
      },
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
