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
}

const ROWS: readonly Row[] = [
  { name: "Charlie", overall: 70 },
  { name: "Alpha", overall: 55 },
  { name: "Delta", overall: 91 },
  { name: "Bravo", overall: 70 },
];

const order = (rows: readonly Row[]) => rows.map((row) => row.name);

const sorted = (mode: Parameters<typeof sortBy>[1]) =>
  sortBy(
    ROWS,
    mode,
    (row) => row.name,
    (row) => row.overall,
  );

describe("ordering a list", () => {
  it("opens alphabetically", () => {
    expect(DEFAULT_SORT_ORDER).toBe("name");
    expect(order(sorted("name"))).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  });

  it("puts the best first by rating, not the worst", () => {
    expect(order(sorted("overall"))).toEqual(["Delta", "Bravo", "Charlie", "Alpha"]);
  });

  it("breaks a tie on the name, so equal ratings hold still", () => {
    // Charlie and Bravo are both on 70, and Bravo comes first — the tie is
    // broken alphabetically rather than by whatever order they arrived in.
    const names = order(sorted("overall"));
    expect(names.indexOf("Bravo")).toBeLessThan(names.indexOf("Charlie"));
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
