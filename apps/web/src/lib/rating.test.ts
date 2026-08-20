import { buildField } from "@alt-hist/data";
import type { CarSpec, DriverRatings } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { carOverall, driverOverall } from "./rating.js";

function driver(overrides: Partial<DriverRatings> = {}): DriverRatings {
  return {
    racing: 50,
    qualifying: 50,
    consistency: 50,
    composure: 50,
    adaptability: 50,
    ...overrides,
  };
}

function car(overrides: Partial<CarSpec> = {}): CarSpec {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50, ...overrides };
}

describe("driverOverall", () => {
  it("stays on the same 0-100 scale as the ratings", () => {
    expect(driverOverall(driver())).toBe(50);
    expect(driverOverall(driver({ racing: 0, qualifying: 0, consistency: 0, composure: 0 }))).toBe(
      0,
    );
    expect(
      driverOverall(driver({ racing: 100, qualifying: 100, consistency: 100, composure: 100 })),
    ).toBe(100);
  });

  it("weighs racing above everything else", () => {
    const base = driverOverall(driver());
    const racier = driverOverall(driver({ racing: 70 })) - base;
    for (const key of ["qualifying", "consistency", "composure"] as const) {
      expect(driverOverall(driver({ [key]: 70 })) - base).toBeLessThan(racier);
    }
  });

  it("ranks qualifying, composure and consistency in that order below it", () => {
    const base = driverOverall(driver());
    const bump = (key: keyof DriverRatings): number => driverOverall(driver({ [key]: 90 })) - base;
    expect(bump("qualifying")).toBeGreaterThan(bump("composure"));
    expect(bump("composure")).toBeGreaterThan(bump("consistency"));
  });

  it("ignores adaptability, because the sim does", () => {
    // Not an oversight: weighting a rating nothing reads would claim a driver is
    // better at something never asked of them.
    expect(driverOverall(driver({ adaptability: 0 }))).toBe(
      driverOverall(driver({ adaptability: 100 })),
    );
  });

  it("never goes backwards when a rating improves", () => {
    for (const key of ["racing", "qualifying", "consistency", "composure"] as const) {
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
    expect(carOverall(car())).toBe(50);
    expect(
      carOverall(car({ racing: 100, qualifying: 100, consistency: 100, reliability: 100 })),
    ).toBe(100);
  });

  it("weighs racing first and reliability second", () => {
    const base = carOverall(car());
    const bump = (key: keyof CarSpec): number => carOverall(car({ [key]: 90 })) - base;
    expect(bump("racing")).toBeGreaterThan(bump("reliability"));
    expect(bump("reliability")).toBeGreaterThan(bump("qualifying"));
    expect(bump("qualifying")).toBeGreaterThan(bump("consistency"));
  });
});

describe("against the 1980 grid", () => {
  const field = buildField();
  const carOf = (teamId: string): number => {
    const entrant = field.find((e) => e.teamId === teamId);
    if (entrant === undefined) {
      throw new Error(`no entrant for ${teamId}`);
    }
    return carOverall(entrant.car);
  };
  const driverOf = (driverId: string): number => {
    const entrant = field.find((e) => e.driverId === driverId);
    if (entrant === undefined) {
      throw new Error(`no entrant for ${driverId}`);
    }
    return driverOverall(entrant.driver);
  };

  it("puts the championship-winning car above the fastest fragile one", () => {
    // Renault had the quickest car and finished fourth; an overall that ranked
    // it top would be describing a different sport.
    expect(carOf("williams")).toBeGreaterThan(carOf("renault"));
    expect(carOf("williams")).toBeGreaterThan(carOf("brabham"));
  });

  it("separates the front of the grid from the back", () => {
    expect(carOf("williams") - carOf("shadow")).toBeGreaterThan(30);
  });

  it("rates the great drivers highest, wherever they are driving", () => {
    // Andretti is in a Lotus going nowhere in 1980; the driver number should not
    // care what car he is sitting in.
    expect(driverOf("andretti")).toBeGreaterThan(driverOf("zunino") + 25);
    expect(driverOf("piquet")).toBeGreaterThan(80);
  });

  it("keeps every number on the grid inside the rating scale", () => {
    for (const entrant of field) {
      expect(driverOverall(entrant.driver)).toBeGreaterThanOrEqual(0);
      expect(driverOverall(entrant.driver)).toBeLessThanOrEqual(100);
      expect(carOverall(entrant.car)).toBeGreaterThanOrEqual(0);
      expect(carOverall(entrant.car)).toBeLessThanOrEqual(100);
    }
  });
});
