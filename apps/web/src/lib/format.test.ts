import { describe, expect, it } from "vitest";
import { count, formatGap, formatSeconds } from "./format.js";

describe("formatSeconds", () => {
  it("shows sub-minute gaps in seconds", () => {
    expect(formatSeconds(5.234)).toBe("+5.234s");
    expect(formatSeconds(59.999)).toBe("+59.999s");
  });

  it("breaks out minutes past sixty seconds", () => {
    expect(formatSeconds(77.23)).toBe("+1:17.230");
    expect(formatSeconds(60)).toBe("+1:00.000");
    expect(formatSeconds(125.5)).toBe("+2:05.500");
  });

  it("writes no trailing s on an m:ss time", () => {
    expect(formatSeconds(77.23).endsWith("s")).toBe(false);
    expect(formatSeconds(5.234).endsWith("s")).toBe(true);
  });

  it("rounds to milliseconds before splitting, not after", () => {
    // Formatting first and splitting after would render this as "+60.000s".
    expect(formatSeconds(59.9999)).toBe("+1:00.000");
  });
});

describe("count", () => {
  it("is singular for one and plural otherwise, adding an s unless told", () => {
    expect(count(1, "win")).toBe("1 win");
    expect(count(0, "win")).toBe("0 wins");
    expect(count(2, "win")).toBe("2 wins");
    expect(count(2, "child", "children")).toBe("2 children");
  });
});

describe("formatGap", () => {
  it("formats a time gap", () => {
    expect(formatGap({ kind: "time", seconds: 5.234 })).toBe("+5.234s");
  });

  it("pluralises laps", () => {
    expect(formatGap({ kind: "laps", laps: 1 })).toBe("+1 lap");
    expect(formatGap({ kind: "laps", laps: 3 })).toBe("+3 laps");
  });
});
