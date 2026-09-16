import { describe, expect, it } from "vitest";
import type { ChassisSpec, DriverRatings } from "../model/ratings.js";
import { RACE_CONSTANTS } from "./constants.js";
import { AWAY, homeAdvantage, homeAllegiances, isAtHome, sameCountry } from "./home.js";
import type { RaceEntrant } from "./types.js";

const DRIVER: DriverRatings = {
  racing: 70,
  qualifying: 70,
  consistency: 70,
  wetWeather: 70,
  adaptability: 70,
  composure: 70,
};

const CHASSIS: ChassisSpec = { racing: 70, qualifying: 70, consistency: 70, reliability: 70 };

function entrant(countries: Partial<RaceEntrant>): RaceEntrant {
  return {
    driverId: "driver",
    teamId: "team",
    driver: DRIVER,
    chassis: CHASSIS,
    ...countries,
  };
}

describe("sameCountry", () => {
  it("ignores case and padding", () => {
    expect(sameCountry("it", "IT")).toBe(true);
    expect(sameCountry(" IT ", "it")).toBe(true);
  });

  it("puts an unknown or blank code nowhere", () => {
    expect(sameCountry(undefined, "IT")).toBe(false);
    expect(sameCountry("IT", undefined)).toBe(false);
    expect(sameCountry("", "")).toBe(false);
  });

  it("tells two places apart", () => {
    expect(sameCountry("IT", "FR")).toBe(false);
  });
});

describe("homeAllegiances", () => {
  it("reads each of the three separately", () => {
    const flags = homeAllegiances(
      entrant({ driverCountry: "IT", teamCountry: "GB", engineCountry: "IT" }),
      { country: "IT" },
    );
    expect(flags).toEqual({ driver: true, team: false, engine: true });
  });

  it("sends a whole entry away at a round held nowhere it is from", () => {
    const flags = homeAllegiances(
      entrant({ driverCountry: "BR", teamCountry: "GB", engineCountry: "FR" }),
      { country: "IT" },
    );
    expect(flags).toEqual(AWAY);
    expect(isAtHome(flags)).toBe(false);
  });

  it("sends everyone away at a round with no host country", () => {
    const flags = homeAllegiances(
      entrant({ driverCountry: "IT", teamCountry: "IT", engineCountry: "IT" }),
      {},
    );
    expect(flags).toEqual(AWAY);
  });

  it("calls an entry at home when any one of the three is", () => {
    expect(isAtHome({ driver: true, team: false, engine: false })).toBe(true);
    expect(isAtHome({ driver: false, team: true, engine: false })).toBe(true);
    expect(isAtHome({ driver: false, team: false, engine: true })).toBe(true);
  });
});

describe("homeAdvantage", () => {
  it("pays nothing to a visitor", () => {
    expect(homeAdvantage(AWAY, RACE_CONSTANTS)).toBe(0);
  });

  it("stacks the three shares", () => {
    const { homeAdvantageDriver, homeAdvantageTeam, homeAdvantageEngine } = RACE_CONSTANTS;
    expect(homeAdvantage({ driver: true, team: true, engine: true }, RACE_CONSTANTS)).toBeCloseTo(
      homeAdvantageDriver + homeAdvantageTeam + homeAdvantageEngine,
      10,
    );
    expect(homeAdvantage({ driver: true, team: false, engine: false }, RACE_CONSTANTS)).toBeCloseTo(
      homeAdvantageDriver,
      10,
    );
    expect(homeAdvantage({ driver: false, team: true, engine: true }, RACE_CONSTANTS)).toBeCloseTo(
      homeAdvantageTeam + homeAdvantageEngine,
      10,
    );
  });
});
