import { createClient, type InArgs, type ResultSet } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const db = createClient({ url, authToken });

export async function all<T = Record<string, unknown>>(sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function get<T = Record<string, unknown>>(sql: string, args: InArgs = []): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InArgs = []): Promise<ResultSet> {
  return db.execute({ sql, args });
}

export async function batch(statements: { sql: string; args?: InArgs }[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}
