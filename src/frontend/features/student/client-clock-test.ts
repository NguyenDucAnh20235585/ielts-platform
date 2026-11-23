import { describe, expect, it } from "vitest";
import { clientRemainingSeconds } from "./client-clock";

describe("clientRemainingSeconds", () => {
  const anchor = {
    expires: 61_000,
    server: 1_000,
    monotonic: 500,
  };

  it("calculates remaining time from server clock", () => {
    expect(clientRemainingSeconds(anchor, 500)).toBe(60);
    expect(clientRemainingSeconds(anchor, 1_500)).toBe(59);
  });

  it("never returns negative seconds", () => {
    expect(clientRemainingSeconds(anchor, 60_500)).toBe(0);
    expect(clientRemainingSeconds(anchor, 70_000)).toBe(0);
  });

  it("supports attempts without a time limit", () => {
    expect(
      clientRemainingSeconds({ ...anchor, expires: null }, 500),
    ).toBeNull();
  });
});
