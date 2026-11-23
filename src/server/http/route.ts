import { z } from "zod";

import { mapDatabaseError } from "@/server/db/errors";

import { ApiError } from "./errors";
import { zodIssues } from "./validation";

type Handler<Context> = (request: Request, context: Context) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Wraps every Route Handler under /api:
 * - rejects cross-origin state-changing requests (CSRF guard; api-contract §1.1),
 * - turns thrown errors into the standard error body (api-contract §1.5),
 * - marks every response as private and not cacheable (user-specific data,
 *   and Supabase may have refreshed the session cookies).
 */
export function withRoute<Context>(handler: Handler<Context>): Handler<Context> {
  return async (request, context) => {
    let response: Response;
    try {
      assertSameOrigin(request, extraAllowedOrigins());
      response = await handler(request, context);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status >= 500) {
        logServerError(request, error);
      }
      response = Response.json(apiError.toBody(), { status: apiError.status });
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new ApiError("VALIDATION_ERROR", "Request is invalid.", { fields: zodIssues(error) });
  }
  return mapDatabaseError(error) ?? new ApiError("INTERNAL_ERROR", "Unexpected server error.");
}

/**
 * Browsers send `Origin` on cross-site POST/PUT/PATCH/DELETE. Requests without
 * it (curl, server-to-server) carry no browser cookies by accident, so they are
 * allowed through to the normal auth check.
 */
export function assertSameOrigin(request: Request, extraOrigins: readonly string[] = []): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }
  const allowed = new Set([requestOrigin(request), ...extraOrigins]);
  if (!allowed.has(origin)) {
    throw new ApiError("FORBIDDEN", "Cross-origin request blocked.");
  }
}

/** The app's own origin, as seen by the client (works behind Railway's proxy). */
function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function extraAllowedOrigins(): string[] {
  return (process.env.APP_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Logs only what is needed to debug: never bodies, cookies, tokens or SQL parameters. */
function logServerError(request: Request, error: unknown): void {
  const path = new URL(request.url).pathname;
  const summary =
    error instanceof Error ? `${error.name}: ${error.message}` : "Non-Error value thrown";
  console.error(`[api] ${request.method} ${path} failed — ${summary}`);
}
