import { describe, expect, it } from "vitest";
import { parseReleases, releaseDate } from "./whats-new.js";
import data from "./whats-new.json";

const ENTRY = { date: "2026-11-01", items: ["A change."] };

describe("what's new", () => {
  it("loads the real file", () => {
    // The author's file, checked: a hand edit that breaks its shape fails here.
    expect(() => parseReleases(data)).not.toThrow();
  });

  it("reads entries newest first", () => {
    const entries = [
      { date: "2026-12-03", items: ["Newer.", "Also newer."] },
      { date: "2026-11-01", items: ["Older."] },
    ];
    expect(parseReleases(entries)).toEqual(entries);
  });

  it("refuses an older entry above a newer one, or two on one day", () => {
    expect(() => parseReleases([ENTRY, { ...ENTRY, date: "2026-11-02" }])).toThrow(/entry 2/);
    expect(() => parseReleases([ENTRY, ENTRY])).toThrow(/entry 2/);
  });

  it("refuses anything that is not a list of entries", () => {
    expect(() => parseReleases(ENTRY)).toThrow();
    expect(() => parseReleases(["A change."])).toThrow(/entry 1/);
    expect(() => parseReleases([null])).toThrow(/entry 1/);
  });

  it("refuses a missing, misspelt or extra field", () => {
    expect(() => parseReleases([{ date: ENTRY.date }])).toThrow(/exactly/);
    expect(() => parseReleases([{ date: ENTRY.date, item: ENTRY.items }])).toThrow(/exactly/);
    expect(() => parseReleases([{ ...ENTRY, link: "https://example.com" }])).toThrow(/exactly/);
  });

  it("refuses a day that is not a real one written YYYY-MM-DD", () => {
    for (const date of ["2026-02-30", "1 November 2026", "2026-11-1", "", 20261101]) {
      expect(() => parseReleases([{ ...ENTRY, date }]), String(date)).toThrow(/YYYY-MM-DD/);
    }
  });

  it("refuses an entry with no lines, or a blank one", () => {
    for (const items of [[], [""], ["  "], "A change.", [1]]) {
      expect(() => parseReleases([{ ...ENTRY, items }]), JSON.stringify(items)).toThrow(/items/);
    }
  });

  it("writes a day as a reader reads it, the same in every time zone", () => {
    expect(releaseDate("2026-11-01")).toBe("1 November 2026");
    expect(releaseDate("2027-01-31")).toBe("31 January 2027");
  });
});
