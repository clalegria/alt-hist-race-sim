import { describe, expect, it } from "vitest";
import { parseSeed, randomSeed } from "./seed.js";

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

describe("randomSeed", () => {
  it("returns a positive integer", () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
    }
  });

  it("does not keep returning the same one", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomSeed()));
    expect(seen.size).toBeGreaterThan(1);
  });
});
