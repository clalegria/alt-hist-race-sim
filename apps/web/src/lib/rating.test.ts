import { buildField, FIRST_AUTHORED_SEASON, seasonSeed } from "@alt-hist/data";
import type { ChassisSpec, DriverRatings, EngineSpec } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { carOverall, carRacing, compareByRating, driverOverall } from "./rating.js";

function driver(overrides: Partial<DriverRatings> = {}): DriverRatings {
  return {
    racing: 50,
    qualifying: 50,
    consistency: 50,
    composure: 50,
    adaptability: 50,
    wetWeather: 50,
    ...overrides,
  };
}

function chassis(overrides: Partial<ChassisSpec> = {}): ChassisSpec {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50, ...overrides };
}

function engine(overrides: Partial<EngineSpec> = {}): EngineSpec {
  return { racing: 50, qualifying: 50, reliability: 50, ...overrides };
}

describe("driverOverall", () => {
  it("stays on the same 0-100 scale as the ratings", () => {
    expect(driverOverall(driver())).toBe(50);
    expect(
      driverOverall(
        driver({ racing: 0, qualifying: 0, consistency: 0, composure: 0, wetWeather: 0 }),
      ),
    ).toBe(0);
    expect(
      driverOverall(
        driver({
          racing: 100,
          qualifying: 100,
          consistency: 100,
          composure: 100,
          wetWeather: 100,
        }),
      ),
    ).toBe(100);
  });

  it("weighs racing above everything else", () => {
    const base = driverOverall(driver());
    const racier = driverOverall(driver({ racing: 70 })) - base;
    for (const key of ["qualifying", "consistency", "composure", "wetWeather"] as const) {
      expect(driverOverall(driver({ [key]: 70 })) - base).toBeLessThan(racier);
    }
  });

  it("ranks qualifying, composure, consistency and wet weather in that order below it", () => {
    // Across the whole scale rather than a nudge off the middle: the overall is
    // rounded to a whole number, so two weights a hundredth apart are
    // indistinguishable over a short span and this would compare 4 against 4.
    const bump = (key: keyof DriverRatings): number =>
      driverOverall(driver({ [key]: 100 })) - driverOverall(driver({ [key]: 0 }));
    expect(bump("qualifying")).toBeGreaterThan(bump("composure"));
    expect(bump("composure")).toBeGreaterThan(bump("consistency"));
    // Last of the four that count, because only about one race in seven is wet
    // — not because a wet race cares least about it. It still has to be above
    // zero, which is what separates it from `adaptability` below.
    expect(bump("consistency")).toBeGreaterThan(bump("wetWeather"));
    expect(bump("wetWeather")).toBeGreaterThan(0);
  });

  it("ignores adaptability, because the sim does", () => {
    // Not an oversight: weighting a rating nothing reads would claim a driver is
    // better at something never asked of them.
    expect(driverOverall(driver({ adaptability: 0 }))).toBe(
      driverOverall(driver({ adaptability: 100 })),
    );
  });

  it("never goes backwards when a rating improves", () => {
    for (const key of ["racing", "qualifying", "consistency", "composure", "wetWeather"] as const) {
      let previous = -1;
      for (let value = 0; value <= 100; value += 10) {
        const overall = driverOverall(driver({ [key]: value }));
        expect(overall).toBeGreaterThanOrEqual(previous);
        previous = overall;
      }
    }
  });
});

describe("carOverall", () => {
  it("stays on the same 0-100 scale", () => {
    expect(carOverall(chassis())).toBe(50);
    expect(
      carOverall(chassis({ racing: 100, qualifying: 100, consistency: 100, reliability: 100 })),
    ).toBe(100);
  });

  it("weighs racing first, and by more than the other three together", () => {
    // Full scale, for the reason `driverOverall`'s ordering test spans it too.
    const bump = (key: keyof ChassisSpec): number =>
      carOverall(chassis({ [key]: 100 })) - carOverall(chassis({ [key]: 0 }));
    // Racing is the only rating the race score reads directly, so it must not
    // merely lead: the supporting three must not be able to outvote it.
    expect(bump("racing")).toBeGreaterThan(
      bump("qualifying") + bump("reliability") + bump("consistency"),
    );
    // Reliability above qualifying, and not the other way round: a car that
    // does not finish scores nothing, while a qualifying point only buys grid
    // position, which is worth a few points of race pace at the very front and
    // less than that everywhere else.
    expect(bump("reliability")).toBeGreaterThan(bump("qualifying"));
    expect(bump("qualifying")).toBeGreaterThan(bump("consistency"));
  });
});

describe("against the authored grid", () => {
  // What the overall is *worth* on the real grid — that Williams outranks
  // Renault, that Piquet clears 80 — is not tested anywhere, on purpose: those
  // are claims about ratings that are still being tuned, and a test that made
  // them would fail every time a number moved. The rule is in `CLAUDE.md`.
  // What is worth checking is that the heuristic survives contact with real
  // data at all.
  const field = buildField(seasonSeed(FIRST_AUTHORED_SEASON));

  it("keeps every number on the grid inside the rating scale", () => {
    expect(field.length).toBeGreaterThan(0);
    for (const entrant of field) {
      expect(driverOverall(entrant.driver), entrant.driverId).toBeGreaterThanOrEqual(0);
      expect(driverOverall(entrant.driver), entrant.driverId).toBeLessThanOrEqual(100);
      expect(carOverall(entrant.chassis), entrant.teamId).toBeGreaterThanOrEqual(0);
      expect(carOverall(entrant.chassis), entrant.teamId).toBeLessThanOrEqual(100);
    }
  });

  it("returns a whole number for every entrant, since the grid prints it raw", () => {
    for (const entrant of field) {
      expect(Number.isInteger(driverOverall(entrant.driver)), entrant.driverId).toBe(true);
      expect(Number.isInteger(carOverall(entrant.chassis)), entrant.teamId).toBe(true);
    }
  });

  it("tells the grid apart rather than flattening it to one number", () => {
    // Not a claim about who is quick: only that the heuristic discriminates. A
    // weighting bug that returned a constant would pass every scale check above.
    expect(new Set(field.map((entrant) => driverOverall(entrant.driver))).size).toBeGreaterThan(1);
    expect(new Set(field.map((entrant) => carOverall(entrant.chassis))).size).toBeGreaterThan(1);
  });
});

describe("carRacing", () => {
  it("is the bare chassis when there is no engine", () => {
    expect(carRacing(chassis({ racing: 63 }))).toBe(63);
  });

  it("reads the blend, so the engine moves it and the other ratings do not", () => {
    const base = carRacing(chassis(), engine());
    expect(carRacing(chassis(), engine({ racing: 90 }))).toBeGreaterThan(base);
    expect(carRacing(chassis({ racing: 90 }), engine())).toBeGreaterThan(base);
    for (const key of ["qualifying", "consistency", "reliability"] as const) {
      expect(carRacing(chassis({ [key]: 100 }), engine())).toBe(base);
    }
  });

  it("sits between the two it blends, never outside them", () => {
    const blended = carRacing(chassis({ racing: 80 }), engine({ racing: 40 }));
    expect(blended).toBeGreaterThan(40);
    expect(blended).toBeLessThan(80);
  });

  it("separates two cars an overall cannot, which is what it is for", () => {
    // Searched rather than hand-picked, so this does not become an assertion
    // about the weights: somewhere on the scale two engines must land the same
    // rounded overall in the same chassis, and there the pace still differs.
    // Rounding an overall throws that difference away; the tie-break exists to
    // keep it.
    const cars = Array.from({ length: 101 }, (_, racing) => engine({ racing }));
    const tied = cars.flatMap((a, index) =>
      cars
        .slice(index + 1)
        .filter((b) => carOverall(chassis(), a) === carOverall(chassis(), b))
        .map((b) => [a, b] as const),
    );
    expect(tied.length).toBeGreaterThan(0);
    for (const [a, b] of tied) {
      expect(carRacing(chassis(), a)).not.toBe(carRacing(chassis(), b));
    }
  });
});

describe("compareByRating", () => {
  // The one ranking rule: every list of drivers or teams, and the reseat, order
  // by this.
  const ahead = (a: { overall: number; racing: number }, b: typeof a) => compareByRating(a, b) < 0;

  it("puts the higher overall first", () => {
    expect(ahead({ overall: 84, racing: 70 }, { overall: 83, racing: 99 })).toBe(true);
  });

  it("settles a tied overall on racing", () => {
    expect(ahead({ overall: 84, racing: 88 }, { overall: 84, racing: 87 })).toBe(true);
    expect(ahead({ overall: 84, racing: 87 }, { overall: 84, racing: 88 })).toBe(false);
  });

  it("calls two rows level when both agree, leaving the last word to the caller", () => {
    expect(compareByRating({ overall: 84, racing: 88 }, { overall: 84, racing: 88 })).toBe(0);
  });
});
