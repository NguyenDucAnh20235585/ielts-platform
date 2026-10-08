import { z } from "zod";

import { ApiError } from "./errors";

export type FieldIssue = { path: string; message: string };

export function zodIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/**
 * Reads and validates a JSON request body.
 * - An empty body is treated as `{}` (e.g. `POST …/submit` with no body).
 * - A non-empty body must be `application/json`; this also blocks HTML form
 *   posts from other sites (they cannot send JSON without a CORS preflight).
 */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const text = await request.text();
  let raw: unknown = {};

  if (text.trim() !== "") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ApiError("VALIDATION_ERROR", "Request body must be application/json.");
    }
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError("VALIDATION_ERROR", "Request body is not valid JSON.");
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Request body is invalid.", {
      fields: zodIssues(result.error),
    });
  }
  return result.data;
}

/** Validates query parameters. Each parameter is read as a single string. */
export function parseQuery<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): z.infer<Schema> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiError("INVALID_QUERY", "Query parameters are invalid.", {
      fields: zodIssues(result.error),
    });
  }
  return result.data;
}

/**
 * Validates a path parameter that must be a UUID. A malformed id cannot exist,
 * so it gets the same "not found" error as an unknown id.
 */
export function parseUuidParam(value: string, notFound: ApiError): string {
  if (!z.uuid().safeParse(value).success) {
    throw notFound;
  }
  return value;
}
