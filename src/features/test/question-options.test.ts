import { describe, expect, it } from "vitest";

import { effectiveOptions } from "./question-options";

const own = [{ key: "A", text: "own" }];
const shared = [{ key: "i", text: "heading" }];

describe("effectiveOptions", () => {
  it("TFNG / YNNG get fixed options from the server", () => {
    expect(effectiveOptions("true_false_not_given", "choice", null, null)?.map((o) => o.key)).toEqual(["TRUE", "FALSE", "NOT_GIVEN"]);
    expect(effectiveOptions("yes_no_not_given", "choice", null, null)?.map((o) => o.key)).toEqual(["YES", "NO", "NOT_GIVEN"]);
  });

  it("question options win over group options", () => {
    expect(effectiveOptions("mcq_single", "choice", own, shared)).toEqual(own);
    expect(effectiveOptions("matching_headings", "choice", null, shared)).toEqual(shared);
  });

  it("TEXT questions have no options", () => {
    expect(effectiveOptions("summary_completion", "text", null, shared)).toBeNull();
  });

  it("rejects malformed stored options", () => {
    expect(() => effectiveOptions("mcq_single", "choice", [{ key: "" }], null)).toThrow();
  });
});
