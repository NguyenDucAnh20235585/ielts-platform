import { describe, expect, it } from "vitest";

import { normalizeAnswerText } from "./normalize";

const defaults = { caseSensitive: false, stripPunctuation: true };

describe("normalizeAnswerText", () => {
  it("trims, collapses whitespace and lowercases (v1 §21 examples)", () => {
    expect(normalizeAnswerText("Environment", defaults)).toBe("environment");
    expect(normalizeAnswerText(" environment ", defaults)).toBe("environment");
    expect(normalizeAnswerText("carbon \t  dioxide", defaults)).toBe("carbon dioxide");
  });

  it("strips sentence punctuation, quotes and brackets at the edges only", () => {
    expect(normalizeAnswerText("car.", defaults)).toBe("car");
    expect(normalizeAnswerText("( car )", defaults)).toBe("car");
    expect(normalizeAnswerText('"the museum",', defaults)).toBe("the museum");
    expect(normalizeAnswerText("St. Peter's", defaults)).toBe("st. peter's");
  });

  it("keeps symbols that change meaning", () => {
    expect(normalizeAnswerText("50%", defaults)).toBe("50%");
    expect(normalizeAnswerText("$20", defaults)).toBe("$20");
    expect(normalizeAnswerText("well-known", defaults)).toBe("well-known");
  });

  it("unifies curly quotes, dashes and full-width characters", () => {
    expect(normalizeAnswerText("Peter’s", defaults)).toBe("peter's");
    expect(normalizeAnswerText("glass–blowing", defaults)).toBe("glass-blowing");
    expect(normalizeAnswerText("ＡＢＣ", defaults)).toBe("abc");
  });

  it("respects case_sensitive and strip_punctuation = false", () => {
    expect(normalizeAnswerText("Paris.", { caseSensitive: true, stripPunctuation: true })).toBe("Paris");
    expect(normalizeAnswerText("Paris.", { caseSensitive: false, stripPunctuation: false })).toBe("paris.");
  });

  it("returns an empty string for blank or punctuation-only input", () => {
    expect(normalizeAnswerText("   ", defaults)).toBe("");
    expect(normalizeAnswerText(" . ", defaults)).toBe("");
  });
});
