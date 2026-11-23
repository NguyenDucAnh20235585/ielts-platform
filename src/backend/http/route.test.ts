import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { assertSameOrigin, toApiError, withRoute } from "./route";

describe("withRoute", () => {
  it("passes the handler response through and marks it not cacheable", async () => {
    const handler = withRoute(async () => Response.json({ ok: true }));
    const response = await handler(new Request("http://localhost/api/me"), undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("turns an ApiError into the standard error body", async () => {
    const handler = withRoute(async () => {
      throw new ApiError("ATTEMPT_LOCKED", "Already submitted.", { status: "SUBMITTED" });
    });
    const response = await handler(new Request("http://localhost/api/x"), undefined);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "ATTEMPT_LOCKED", message: "Already submitted.", details: { status: "SUBMITTED" } },
    });
  });

  it("hides unexpected errors behind INTERNAL_ERROR (500) and logs no details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withRoute(async () => {
      throw new Error("db password is hunter2");
    });
    const response = await handler(new Request("http://localhost/api/x"), undefined);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("blocks cross-origin POSTs before the handler runs", async () => {
    const inner = vi.fn(async () => Response.json({}));
    const handler = withRoute(inner);
    const response = await handler(
      new Request("http://localhost/api/x", { method: "POST", headers: { origin: "https://evil.example" } }),
      undefined,
    );
    expect(response.status).toBe(403);
    expect(inner).not.toHaveBeenCalled();
  });
});

describe("assertSameOrigin", () => {
  const post = (headers: Record<string, string>) =>
    new Request("http://internal:3000/api/x", { method: "POST", headers });

  it("allows same origin, missing Origin, safe methods and configured extra origins", () => {
    expect(() => assertSameOrigin(post({ origin: "http://internal:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(post({}))).not.toThrow();
    expect(() => assertSameOrigin(new Request("http://internal:3000/api/x", { headers: { origin: "https://evil.example" } }))).not.toThrow();
    expect(() => assertSameOrigin(post({ origin: "https://fe.example" }), ["https://fe.example"])).not.toThrow();
  });

  it("uses X-Forwarded-Host/Proto behind a proxy", () => {
    const request = post({ origin: "https://app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects other origins with FORBIDDEN", () => {
    expect(() => assertSameOrigin(post({ origin: "https://evil.example" }))).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});

describe("toApiError", () => {
  it("maps our trigger SQLSTATEs", () => {
    const notDraft = Object.assign(Object.create(postgres.PostgresError.prototype), { code: "IE001" });
    expect(toApiError(notDraft).code).toBe("NOT_DRAFT");
    const transition = Object.assign(Object.create(postgres.PostgresError.prototype), { code: "IE003" });
    expect(toApiError(transition).code).toBe("INVALID_STATUS_TRANSITION");
  });
});
