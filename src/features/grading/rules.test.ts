import { describe, expect, it } from "vitest";

import { resolveRules } from "./rules";

describe("resolveRules", () => {
  it("uses defaults when nothing is set", () => {
    expect(resolveRules({}, {})).toEqual({
      maxWords: null,
      allowNumber: false,
      selectCount: null,
      allowOptionReuse: false,
    });
  });

  it("inherits group rules and lets question config override key by key", () => {
    const rules = resolveRules({ max_words: 2, allow_number: true }, { max_words: 3 });
    expect(rules.maxWords).toBe(3);
    expect(rules.allowNumber).toBe(true);
  });

  it("an explicit null in the question clears the group value", () => {
    expect(resolveRules({ max_words: 2 }, { max_words: null }).maxWords).toBeNull();
  });

  it("rejects malformed stored JSON", () => {
    expect(() => resolveRules({ max_words: "two" }, {})).toThrow();
    expect(() => resolveRules({}, { select_count: 9 })).toThrow();
  });
});
