import { describe, expect, it } from "vitest";

import { countWordsAndNumbers, withinWordLimit } from "./word-limit";

describe("countWordsAndNumbers", () => {
  it("counts hyphenated words as one word", () => {
    expect(countWordsAndNumbers("well-known author")).toEqual({ words: 2, numbers: 0 });
  });

  it("recognises numbers with separators, currency and percent", () => {
    expect(countWordsAndNumbers("1,500 people")).toEqual({ words: 1, numbers: 1 });
    expect(countWordsAndNumbers("10.30 am")).toEqual({ words: 1, numbers: 1 });
    expect(countWordsAndNumbers("$20")).toEqual({ words: 0, numbers: 1 });
    expect(countWordsAndNumbers("3/4")).toEqual({ words: 0, numbers: 1 });
    expect(countWordsAndNumbers("50%")).toEqual({ words: 0, numbers: 1 });
  });

  it("ignores punctuation-only tokens and edge punctuation", () => {
    expect(countWordsAndNumbers("car , .")).toEqual({ words: 1, numbers: 0 });
    expect(countWordsAndNumbers("1,500.")).toEqual({ words: 0, numbers: 1 });
  });
});

describe("withinWordLimit", () => {
  const twoWords = { maxWords: 2, allowNumber: false };
  const twoWordsAndOrNumber = { maxWords: 2, allowNumber: true };
  const aNumber = { maxWords: 0, allowNumber: true };

  it("NO MORE THAN TWO WORDS: numbers count as words", () => {
    expect(withinWordLimit("old bridge", twoWords)).toBe(true);
    expect(withinWordLimit("the old bridge", twoWords)).toBe(false);
    expect(withinWordLimit("3 bridges", twoWords)).toBe(true);
    expect(withinWordLimit("3 old bridges", twoWords)).toBe(false);
  });

  it("NO MORE THAN TWO WORDS AND/OR A NUMBER", () => {
    expect(withinWordLimit("3 old bridges", twoWordsAndOrNumber)).toBe(true);
    expect(withinWordLimit("3 4 bridges", twoWordsAndOrNumber)).toBe(false);
    expect(withinWordLimit("the old bridge", twoWordsAndOrNumber)).toBe(false);
  });

  it("A NUMBER", () => {
    expect(withinWordLimit("1,500", aNumber)).toBe(true);
    expect(withinWordLimit("1,500 dollars", aNumber)).toBe(false);
  });

  it("no limit when maxWords is null", () => {
    expect(withinWordLimit("a very long answer indeed", { maxWords: null, allowNumber: false })).toBe(true);
  });
});
