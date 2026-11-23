import type postgres from "postgres";

/**
 * A JSON round trip turns values typed as `unknown` (answers, answer keys,
 * snapshots, audit metadata) into a plain JSON value that postgres.js can
 * store with `sql.json(...)`. Never interpolate `JSON.stringify(x)::jsonb`:
 * postgres.js would store a JSON *string*.
 */
export function jsonValue(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value ?? null)) as postgres.JSONValue;
}
