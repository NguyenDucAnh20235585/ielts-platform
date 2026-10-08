import { describe, expect, it } from "vitest";

import { assignNumbers } from "./numbering";

describe("assignNumbers", () => {
  it("numbers questions consecutively; a 2-mark question takes two numbers", () => {
    expect(
      assignNumbers([
        { marks: 1, displayNumber: null },
        { marks: 2, displayNumber: null },
        { marks: 1, displayNumber: null },
      ]),
    ).toEqual([[1], [2, 3], [4]]);
  });

  it("display_number restarts the count from that value", () => {
    expect(
      assignNumbers([
        { marks: 1, displayNumber: 14 },
        { marks: 1, displayNumber: null },
      ]),
    ).toEqual([[14], [15]]);
  });
});
