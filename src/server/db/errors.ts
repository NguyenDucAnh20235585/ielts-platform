import postgres from "postgres";

import { ApiError } from "@/server/http/errors";

/**
 * Maps database errors raised on purpose by our migrations to API errors.
 * Custom SQLSTATEs come from the triggers in
 * supabase/migrations/20261005075716_prototype_schema_changes.sql
 * (database-schema.md §6). Anything else is left to the caller.
 */
export function mapDatabaseError(error: unknown): ApiError | null {
  if (!(error instanceof postgres.PostgresError)) {
    return null;
  }
  switch (error.code) {
    case "IE001":
      return new ApiError("NOT_DRAFT", "This test version is not a draft and cannot be changed.");
    case "IE003":
      return new ApiError("INVALID_STATUS_TRANSITION", "This status change is not allowed.");
    default:
      return null;
  }
}

/** True when `error` is a unique-constraint violation on the given constraint/index. */
export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === "23505" &&
    error.constraint_name === constraintName
  );
}
