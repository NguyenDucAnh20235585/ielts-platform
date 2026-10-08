import "server-only";
import postgres from "postgres";

import { serverEnv } from "@/config/env";

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

// One pool per server process. Kept on globalThis so that `next dev` hot
// reloads do not open a new pool on every change.
declare global {
  var __ieltsSql: Sql | undefined;
}

/**
 * Server-side Postgres client (decision D-008, option B).
 * The browser never talks to the database; every query goes through here.
 */
export function db(): Sql {
  if (!globalThis.__ieltsSql) {
    const env = serverEnv();
    globalThis.__ieltsSql = postgres(env.DATABASE_URL, {
      max: env.DATABASE_POOL_MAX,
      // Required by the Supabase pooler in transaction mode (port 6543);
      // harmless for direct connections.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      // Pass `undefined` values as SQL NULL instead of throwing.
      transform: { undefined: null },
    });
  }
  return globalThis.__ieltsSql;
}
