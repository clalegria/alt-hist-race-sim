import { describe, expect, it } from "vitest";
import { ageInSeason } from "./people.js";

describe("ageInSeason", () => {
  it("is the age reached during that season", () => {
    expect(ageInSeason(1980, 1946)).toBe(34);
    expect(ageInSeason(1980, 1955)).toBe(25);
  });
});
