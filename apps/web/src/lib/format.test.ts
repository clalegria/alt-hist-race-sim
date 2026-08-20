import { describe, expect, it } from "vitest";
import { formatGap, formatSeconds, parseSeed } from "./format.js";

describe("formatSeconds", () => {
  it("shows sub-minute gaps in seconds", () => {
    expect(formatSeconds(5.234)).toBe("+5.234s");
    expect(formatSeconds(59.999)).toBe("+59.999s");
  });

  it("breaks out minutes past sixty seconds", () => {
    expect(formatSeconds(77.23)).toBe("+1:17.230s");
    expect(formatSeconds(60)).toBe("+1:00.000s");
    expect(formatSeconds(125.5)).toBe("+2:05.500s");
  });

  it("rounds to milliseconds before splitting, not after", () => {
    // Formatting first and splitting after would render this as "+60.000s".
    expect(formatSeconds(59.9999)).toBe("+1:00.000s");
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

describe("parseSeed", () => {
  it("reads an integer", () => {
    expect(parseSeed("12", 1)).toBe(12);
  });

  it("falls back on anything that is not one", () => {
    // The input is a text field, so it is empty or half-typed a lot of the time.
    expect(parseSeed("", 4)).toBe(4);
    expect(parseSeed("-", 4)).toBe(4);
    expect(parseSeed("abc", 4)).toBe(4);
  });
});
