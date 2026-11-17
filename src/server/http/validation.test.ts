import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "./errors";
import { parseJsonBody, parseQuery, parseUuidParam } from "./validation";
import { paginationQuery, paginated } from "./pagination";

const body = z.strictObject({ flagged: z.boolean() });

function jsonRequest(text: string, contentType = "application/json") {
  return new Request("http://localhost/api/x", { method: "PATCH", body: text, headers: { "content-type": contentType } });
}

async function apiErrorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected an ApiError");
}

describe("parseJsonBody", () => {
  it("returns parsed data", async () => {
    await expect(parseJsonBody(jsonRequest('{"flagged":true}'), body)).resolves.toEqual({ flagged: true });
  });

  it("treats an empty body as {}", async () => {
    const schema = z.strictObject({ answers: z.array(z.string()).optional() });
    await expect(parseJsonBody(new Request("http://localhost/x", { method: "POST" }), schema)).resolves.toEqual({});
  });

  it("rejects invalid JSON, wrong content type, unknown fields and wrong types with VALIDATION_ERROR", async () => {
    for (const request of [
      jsonRequest("{oops"),
      jsonRequest('{"flagged":true}', "text/plain"),
      jsonRequest('{"flagged":true,"extra":1}'),
      jsonRequest('{"flagged":"yes"}'),
    ]) {
      const error = await apiErrorOf(parseJsonBody(request, body));
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.status).toBe(400);
    }
  });

  it("lists field paths in details.fields", async () => {
    const error = await apiErrorOf(parseJsonBody(jsonRequest('{"flagged":"yes"}'), body));
    expect(error.details).toEqual({ fields: [expect.objectContaining({ path: "flagged" })] });
  });
});

describe("parseQuery + pagination", () => {
  const schema = z.object({ ...paginationQuery, type: z.enum(["READING", "LISTENING"]).optional() });

  it("applies defaults and coerces numbers", () => {
    expect(parseQuery(new Request("http://localhost/api/tests"), schema)).toEqual({ page: 1, limit: 20 });
    expect(parseQuery(new Request("http://localhost/api/tests?page=2&limit=5&type=READING"), schema)).toEqual({
      page: 2,
      limit: 5,
      type: "READING",
    });
  });

  it("rejects bad values with INVALID_QUERY", () => {
    for (const url of ["?page=0", "?limit=101", "?type=SPEAKING", "?page=abc"]) {
      expect(() => parseQuery(new Request(`http://localhost/api/tests${url}`), schema)).toThrow(
        expect.objectContaining({ code: "INVALID_QUERY", status: 400 }),
      );
    }
  });

  it("builds the pagination block", () => {
    expect(paginated(["a"], 57, 3, 20).pagination).toEqual({ page: 3, limit: 20, total: 57, total_pages: 3 });
    expect(paginated([], 0, 1, 20).pagination.total_pages).toBe(0);
  });
});

describe("parseUuidParam", () => {
  const notFound = new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found.");
  it("passes a UUID through and turns anything else into the given 404", () => {
    expect(parseUuidParam("0f9b2c1e-1d2a-4f3b-9c4d-5e6f7a8b9c0d", notFound)).toBe("0f9b2c1e-1d2a-4f3b-9c4d-5e6f7a8b9c0d");
    expect(() => parseUuidParam("123", notFound)).toThrow(notFound);
  });
});
