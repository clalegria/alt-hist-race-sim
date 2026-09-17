/**
 * What an order does, against synthetic ratings.
 *
 * Synthetic on purpose, like the filter tests beside them: sorting is a rule,
 * and a test that read a real rating would fail the day the data is tuned
 * rather than the day the rule breaks.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SORT_ORDER, sortBy } from "./sort.js";

interface Row {
  readonly name: string;
  readonly overall: number;
  readonly racing: number;
}

const ROWS: readonly Row[] = [
  { name: "Charlie", overall: 70, racing: 80 },
  { name: "Alpha", overall: 55, racing: 99 },
  { name: "Delta", overall: 91, racing: 60 },
  { name: "Bravo", overall: 70, racing: 90 },
];

const order = (rows: readonly Row[]) => rows.map((row) => row.name);

const sorted = (mode: Parameters<typeof sortBy>[1], rows: readonly Row[] = ROWS) =>
  sortBy(
    rows,
    mode,
    (row) => row.name,
    (row) => row.overall,
    (row) => row.racing,
  );

describe("ordering a list", () => {
  it("opens alphabetically", () => {
    expect(DEFAULT_SORT_ORDER).toBe("name");
    expect(order(sorted("name"))).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  });

  it("puts the best first by rating, not the worst", () => {
    expect(order(sorted("overall"))).toEqual(["Delta", "Bravo", "Charlie", "Alpha"]);
  });

  it("leaves the overall in charge, whatever the racing rating says", () => {
    // Alpha has the highest racing rating on the list and the lowest overall,
    // and comes last: racing settles a tie, it does not outvote the headline.
    expect(order(sorted("overall")).at(-1)).toBe("Alpha");
  });

  it("breaks a tie on the racing rating, not on the name", () => {
    // Bravo and Charlie are both on 70 — Bravo is the quicker of the two and
    // comes first, which alphabetical order happens to agree with, so here is
    // a pair where the two answers differ.
    const rows: readonly Row[] = [
      { name: "Zulu", overall: 70, racing: 90 },
      { name: "Alpha", overall: 70, racing: 80 },
    ];
    expect(order(sorted("overall", rows))).toEqual(["Zulu", "Alpha"]);
    const names = order(sorted("overall"));
    expect(names.indexOf("Bravo")).toBeLessThan(names.indexOf("Charlie"));
  });

  it("falls back to the name when both ratings are level, so equals hold still", () => {
    const rows: readonly Row[] = [
      { name: "Zulu", overall: 70, racing: 80 },
      { name: "Mike", overall: 70, racing: 80 },
      { name: "Alpha", overall: 70, racing: 80 },
    ];
    expect(order(sorted("overall", rows))).toEqual(["Alpha", "Mike", "Zulu"]);
  });

  it("leaves the list it was handed alone", () => {
    sorted("overall");
    expect(order(ROWS)).toEqual(["Charlie", "Alpha", "Delta", "Bravo"]);
  });

  it("keeps everyone, whichever way round", () => {
    for (const mode of ["name", "overall"] as const) {
      expect(order(sorted(mode)).toSorted()).toEqual(order(ROWS).toSorted());
    }
  });
});
