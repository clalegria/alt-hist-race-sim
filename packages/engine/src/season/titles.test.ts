import { describe, expect, it } from "vitest";
import {
  bestPossibleRound,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  titleClinchedBy,
} from "./titles.js";
import type { ConstructorStanding, DriverStanding, PointsScale } from "./types.js";

/**
 * The scale these tests reason about: 9-6-4-3-2-1, as 1961 to 1990 paid. A
 * fixture, not a default — every function here is handed its season's scale.
 */
const CLASSIC: PointsScale = [9, 6, 4, 3, 2, 1];

/** A driver standing with only the fields a title calculation reads. */
function driver(driverId: string, points: number): DriverStanding {
  return {
    driverId,
    teamId: `${driverId}-team`,
    points,
    wins: 0,
    podiums: 0,
    poles: 0,
    starts: 0,
    retirements: 0,
    nonQualifications: 0,
    bestFinish: null,
    finishCounts: [],
  };
}

function team(teamId: string, points: number, cars: number): ConstructorStanding {
  return {
    teamId,
    cars,
    points,
    wins: 0,
    podiums: 0,
    poles: 0,
    starts: 0,
    retirements: 0,
    nonQualifications: 0,
    bestFinish: null,
    finishCounts: [],
  };
}

describe("the best a round can be worth", () => {
  it("is the win for a single car", () => {
    expect(bestPossibleRound(1, CLASSIC)).toBe(9);
  });

  it("is a one-two for a two-car team", () => {
    // 9 + 6, not 9. A constructor scores with every car it enters.
    expect(bestPossibleRound(2, CLASSIC)).toBe(15);
  });

  it("cannot exceed the points table however many cars are entered", () => {
    const whole = 9 + 6 + 4 + 3 + 2 + 1;
    expect(bestPossibleRound(6, CLASSIC)).toBe(whole);
    expect(bestPossibleRound(40, CLASSIC)).toBe(whole);
  });

  it("is nothing for nobody", () => {
    expect(bestPossibleRound(0, CLASSIC)).toBe(0);
  });

  it("follows the scale it is given", () => {
    const modern: PointsScale = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    expect(bestPossibleRound(1, modern)).toBe(25);
    expect(bestPossibleRound(2, modern)).toBe(43);
  });
});

describe("clinching the drivers' title", () => {
  it("is not settled while the leader can still be caught", () => {
    // 17 clear with two rounds left, and 18 still on the table.
    expect(driversTitleClinchedBy([driver("a", 57), driver("b", 40)], 2, CLASSIC)).toBeNull();
  });

  it("is settled once the gap exceeds everything left to play for", () => {
    // 19 clear with two rounds left, and only 18 remain.
    expect(driversTitleClinchedBy([driver("a", 59), driver("b", 40)], 2, CLASSIC)?.driverId).toBe(
      "a",
    );
  });

  it("treats a gap exactly equal to the points remaining as still live", () => {
    // The challenger can draw level on points, and a tie falls to countback —
    // which is a result, not a certainty. Declaring it settled would be wrong.
    expect(driversTitleClinchedBy([driver("a", 58), driver("b", 40)], 2, CLASSIC)).toBeNull();
  });

  it("is settled when there are no rounds left and a clear leader", () => {
    expect(driversTitleClinchedBy([driver("a", 41), driver("b", 40)], 0, CLASSIC)?.driverId).toBe(
      "a",
    );
  });

  it("crowns the leader on a dead heat once the season is over", () => {
    // A tie mid-season is unsettled because countback has not happened yet. A
    // tie after the last round is settled *by* countback — the standings are
    // already sorted on it, so first place is the champion. Left unhandled, a
    // season whose top two finished level crowned nobody at all: no banner, and
    // no accent in the sidebar.
    expect(driversTitleClinchedBy([driver("a", 40), driver("b", 40)], 0, CLASSIC)?.driverId).toBe(
      "a",
    );
    expect(driversTitleClinchedBy([driver("a", 40), driver("b", 40)], 1, CLASSIC)).toBeNull();
  });

  it("crowns the leader on a dead heat in the constructors' table too", () => {
    const standings = [team("a", 40, 2), team("b", 40, 2)];
    expect(constructorsTitleClinchedBy(standings, 0, CLASSIC)?.teamId).toBe("a");
    expect(constructorsTitleClinchedBy(standings, 1, CLASSIC)).toBeNull();
  });

  it("checks every challenger, not just the runner-up", () => {
    // Second place is out of reach but third is not, so nothing is settled.
    const standings = [driver("a", 50), driver("b", 40), driver("c", 39)];
    expect(driversTitleClinchedBy(standings, 0, CLASSIC)?.driverId).toBe("a");
    expect(driversTitleClinchedBy(standings, 2, CLASSIC)).toBeNull();
  });

  it("stays settled as further rounds are run", () => {
    // Once clinched with rounds left, fewer rounds left can only reinforce it.
    for (let remaining = 2; remaining >= 0; remaining -= 1) {
      expect(
        driversTitleClinchedBy([driver("a", 59), driver("b", 40)], remaining, CLASSIC),
      ).not.toBeNull();
    }
  });

  it("has nothing to say about an empty table", () => {
    expect(driversTitleClinchedBy([], 5, CLASSIC)).toBeNull();
  });

  it("crowns an unopposed leader", () => {
    expect(driversTitleClinchedBy([driver("a", 0)], 14, CLASSIC)?.driverId).toBe("a");
  });
});

describe("clinching the constructors' title", () => {
  it("allows a two-car challenger a one-two every round", () => {
    // The same 14-point gap with one round left, read two ways. A driver
    // challenger can take 9 and falls short, so the drivers' title is settled.
    // A two-car team can take 15, so the constructors' one is not.
    expect(driversTitleClinchedBy([driver("a", 54), driver("b", 40)], 1, CLASSIC)?.driverId).toBe(
      "a",
    );
    expect(
      constructorsTitleClinchedBy([team("a", 54, 2), team("b", 40, 2)], 1, CLASSIC),
    ).toBeNull();
  });

  it("settles once the gap exceeds a one-two", () => {
    expect(
      constructorsTitleClinchedBy([team("a", 56, 2), team("b", 40, 2)], 1, CLASSIC)?.teamId,
    ).toBe("a");
  });

  it("holds a single-car challenger to a single car's points", () => {
    // The same gap the two-car team above could still close, against a
    // one-car entry that cannot.
    expect(
      constructorsTitleClinchedBy([team("a", 54, 2), team("b", 40, 1)], 1, CLASSIC)?.teamId,
    ).toBe("a");
  });

  it("measures each challenger by its own car count", () => {
    // Second has more points but one car and reaches 54; third has fewer points
    // and two cars, and reaches 59. Third is the real threat. Comparing only
    // against the runner-up would call this settled at 58.
    const standings = [team("a", 58, 2), team("b", 45, 1), team("c", 44, 2)];
    expect(constructorsTitleClinchedBy(standings, 1, CLASSIC)).toBeNull();
    // Drop the two-car team out of reach and it is settled after all.
    expect(
      constructorsTitleClinchedBy(
        [team("a", 60, 2), team("b", 45, 1), team("c", 44, 2)],
        1,
        CLASSIC,
      )?.teamId,
    ).toBe("a");
  });
});

describe("the shared rule", () => {
  it("never crowns someone who is not leading", () => {
    const standings = [driver("a", 10), driver("b", 9)];
    const clinched = titleClinchedBy(standings, 0, () => 9);
    expect(clinched?.driverId).toBe("a");
  });

  it("treats a negative rounds-remaining as none", () => {
    // Defensive: a caller doing `total - completed` on a stale total.
    expect(titleClinchedBy([driver("a", 10), driver("b", 9)], -3, () => 9)?.driverId).toBe("a");
  });
});
