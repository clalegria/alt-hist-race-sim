import { describe, expect, it } from "vitest";
import { showcaseYears } from "./car-showcase.js";

/** A look per year, from a table; a year not in it looks like no other. */
function looks(table: Record<number, string>): (year: number) => string {
  return (year) => table[year] ?? `year ${year}`;
}

const YEARS = [1960, 1961, 1962, 1963, 1964];

describe("the cars on a team's page", () => {
  it("are its first, one between and its latest, oldest first, when all three differ", () => {
    const shown = showcaseYears(YEARS, looks({}), 0);
    expect(shown).toHaveLength(3);
    expect(shown[0]).toBe(1960);
    expect(shown[2]).toBe(1964);
    expect(YEARS.slice(1, -1)).toContain(shown[1]);
  });

  it("pick the one between across the whole span", () => {
    const picked = new Set(
      [0, 0.34, 0.67, 0.99].map((pick) => showcaseYears(YEARS, looks({}), pick)[1]),
    );
    expect(picked).toEqual(new Set([1961, 1962, 1963]));
  });

  it("never pick a year between that looks like either end", () => {
    const lookOf = looks({ 1960: "a", 1961: "a", 1962: "b", 1963: "c", 1964: "c" });
    for (const pick of [0, 0.5, 0.99]) {
      expect(showcaseYears(YEARS, lookOf, pick)).toEqual([1960, 1962, 1964]);
    }
  });

  it("leave out the one between when every year between looks like an end", () => {
    const lookOf = looks({ 1960: "a", 1961: "a", 1962: "b", 1963: "b", 1964: "b" });
    expect(showcaseYears(YEARS, lookOf, 0.5)).toEqual([1960, 1964]);
  });

  it("leave out the latest when it looks like the first", () => {
    const lookOf = looks({ 1960: "a", 1961: "a", 1962: "b", 1963: "a", 1964: "a" });
    expect(showcaseYears(YEARS, lookOf, 0.5)).toEqual([1960, 1962]);
  });

  it("are one car when every year looks the same", () => {
    expect(showcaseYears(YEARS, () => "a", 0.5)).toEqual([1960]);
  });

  it("are one car for one year, and none for none", () => {
    expect(showcaseYears([1970], looks({}), 0.5)).toEqual([1970]);
    expect(showcaseYears([], looks({}), 0.5)).toEqual([]);
  });
});
