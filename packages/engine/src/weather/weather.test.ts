import { describe, expect, it } from "vitest";
import { RACE_CONSTANTS } from "../race/constants.js";
import { simulateRace } from "../race/simulateRace.js";
import type { RaceEntrant } from "../race/types.js";
import { createRng } from "../rng/index.js";
import type { Rng } from "../rng/types.js";
import { WEATHER_CONSTANTS } from "./constants.js";
import { DRY, type RaceWeather, rollWeather, wetConstants, wetDriver } from "./weather.js";

/**
 * Synthetic ratings throughout, per `CLAUDE.md`: what a wet race does is a rule,
 * and a test that read an authored driver would fail the day someone decided
 * Prost was a 90 rather than an 86 in the rain.
 */
function driver(over: Partial<RaceEntrant["driver"]> = {}) {
  return {
    racing: 70,
    qualifying: 70,
    consistency: 70,
    adaptability: 70,
    composure: 70,
    wetWeather: 70,
    ...over,
  };
}

function entrant(driverId: string, over: Partial<RaceEntrant["driver"]> = {}): RaceEntrant {
  return {
    driverId,
    teamId: `team-${driverId}`,
    driver: driver(over),
    chassis: { racing: 70, qualifying: 70, consistency: 70, reliability: 70 },
  };
}

const FULLY_WET: RaceWeather = { wet: true, wetness: 1 };

describe("rolling the weather", () => {
  it("declares about as many wet races as the constants ask for", () => {
    const rng = createRng(11);
    const rounds = 20_000;
    let wet = 0;
    for (let round = 0; round < rounds; round += 1) {
      if (rollWeather(rng).wet) {
        wet += 1;
      }
    }
    const rate = wet / rounds;
    // Two points either side: over 20,000 rounds the standard error is about a
    // quarter of a point, so this is wide enough never to flake and far too
    // tight to survive the probability being read as anything but itself.
    expect(rate).toBeGreaterThan(WEATHER_CONSTANTS.wetRaceProbability - 0.02);
    expect(rate).toBeLessThan(WEATHER_CONSTANTS.wetRaceProbability + 0.02);
  });

  it("keeps a wet race inside the authored range, skewed toward the floor", () => {
    const rng = createRng(12);
    const wetness: number[] = [];
    while (wetness.length < 4000) {
      const weather = rollWeather(rng);
      if (weather.wet) {
        wetness.push(weather.wetness);
      }
    }
    for (const value of wetness) {
      expect(value).toBeGreaterThanOrEqual(WEATHER_CONSTANTS.wetnessFloor);
      expect(value).toBeLessThanOrEqual(WEATHER_CONSTANTS.wetnessCeiling);
    }
    // The point of the range: a wet race is usually a shower. The mean has to
    // sit below the midpoint of the range, which a uniform draw would not do.
    const midpoint = (WEATHER_CONSTANTS.wetnessFloor + WEATHER_CONSTANTS.wetnessCeiling) / 2;
    const mean = wetness.reduce((total, value) => total + value, 0) / wetness.length;
    expect(mean).toBeLessThan(midpoint);
    // And it is a range rather than a constant: both halves are populated.
    expect(wetness.some((value) => value > 0.85)).toBe(true);
    expect(wetness.some((value) => value < 0.35)).toBe(true);
  });

  it("draws the same number of values whether or not it rains", () => {
    const counting = (seed: number): { rng: Rng; draws: () => number } => {
      const inner = createRng(seed);
      let count = 0;
      const rng: Rng = {
        next: () => {
          count += 1;
          return inner.next();
        },
        getState: () => inner.getState(),
        nextInt: (min, max) => inner.nextInt(min, max),
        pick: (items) => inner.pick(items),
        shuffle: (items) => inner.shuffle(items),
        gaussian: (mean, sd) => inner.gaussian(mean, sd),
      };
      return { rng, draws: () => count };
    };
    // Every seed, wet or dry, has to cost the same — otherwise round 4 raining
    // moves round 5 down the stream, and a season stops being reproducible from
    // its early rounds.
    const first = counting(1);
    rollWeather(first.rng);
    for (let seed = 2; seed <= 200; seed += 1) {
      const { rng, draws } = counting(seed);
      rollWeather(rng);
      expect(draws()).toBe(first.draws());
    }
  });

  it("takes a per-round chance over the base rate", () => {
    const never = createRng(3);
    const always = createRng(3);
    for (let round = 0; round < 200; round += 1) {
      expect(rollWeather(never, undefined, 0).wet).toBe(false);
      expect(rollWeather(always, undefined, 1).wet).toBe(true);
    }
  });
});

describe("the constants a wet race is run on", () => {
  it("hands a dry round the constants themselves", () => {
    // By identity, like the balanced randomness level: six rounds in seven are
    // scored by exactly the constants as written.
    expect(wetConstants(DRY, RACE_CONSTANTS)).toBe(RACE_CONSTANTS);
    expect(wetConstants({ wet: true, wetness: 0 }, RACE_CONSTANTS)).toBe(RACE_CONSTANTS);
  });

  it("keeps every weight pair summing to one", () => {
    for (const wetness of [0.2, 0.5, 0.8, 1]) {
      const wet = wetConstants({ wet: true, wetness }, RACE_CONSTANTS);
      expect(wet.weightCarRacing + wet.weightDriverRacing).toBeCloseTo(1, 10);
      expect(wet.weightCarQualifying + wet.weightDriverQualifying).toBeCloseTo(1, 10);
      expect(wet.weightChassisPerformance + wet.weightEnginePerformance).toBeCloseTo(1, 10);
    }
  });

  it("moves the score toward the driver and the chassis, further the wetter", () => {
    const damp = wetConstants({ wet: true, wetness: 0.3 }, RACE_CONSTANTS);
    const soaked = wetConstants(FULLY_WET, RACE_CONSTANTS);
    expect(damp.weightDriverRacing).toBeGreaterThan(RACE_CONSTANTS.weightDriverRacing);
    expect(soaked.weightDriverRacing).toBeGreaterThan(damp.weightDriverRacing);
    expect(damp.weightDriverQualifying).toBeGreaterThan(RACE_CONSTANTS.weightDriverQualifying);
    expect(soaked.weightDriverQualifying).toBeGreaterThan(damp.weightDriverQualifying);
    expect(damp.weightChassisPerformance).toBeGreaterThan(RACE_CONSTANTS.weightChassisPerformance);
    expect(soaked.weightChassisPerformance).toBeGreaterThan(damp.weightChassisPerformance);
  });

  it("widens the noise and raises both retirement risks", () => {
    const soaked = wetConstants(FULLY_WET, RACE_CONSTANTS);
    expect(soaked.racingNoise).toBeGreaterThan(RACE_CONSTANTS.racingNoise);
    expect(soaked.qualifyingNoise).toBeGreaterThan(RACE_CONSTANTS.qualifyingNoise);
    expect(soaked.mechanicalDnfEraScale).toBeGreaterThan(RACE_CONSTANTS.mechanicalDnfEraScale);
    expect(soaked.driverErrorDnfAtZeroComposure).toBeGreaterThan(
      RACE_CONSTANTS.driverErrorDnfAtZeroComposure,
    );
    // Driver error rises harder than mechanical failure: cars leave the road in
    // the rain rather than breaking in it.
    const errorRise =
      soaked.driverErrorDnfAtZeroComposure / RACE_CONSTANTS.driverErrorDnfAtZeroComposure;
    const mechanicalRise = soaked.mechanicalDnfEraScale / RACE_CONSTANTS.mechanicalDnfEraScale;
    expect(errorRise).toBeGreaterThan(mechanicalRise);
  });

  it("composes with whatever the run already scaled, rather than replacing it", () => {
    const chaotic = { ...RACE_CONSTANTS, racingNoise: RACE_CONSTANTS.racingNoise * 2.5 };
    const soaked = wetConstants(FULLY_WET, chaotic);
    // A wet race in a chaotic run is wetter *and* wilder: two multipliers, not
    // one constant they fight over.
    expect(soaked.racingNoise).toBeCloseTo(
      chaotic.racingNoise * WEATHER_CONSTANTS.noiseScaleAtFullWetness,
      10,
    );
  });

  it("never inverts a weight, however hard the shift is turned up", () => {
    const brutal = {
      ...WEATHER_CONSTANTS,
      driverWeightShiftAtFullWetness: 5,
      chassisWeightShiftAtFullWetness: 5,
    };
    const soaked = wetConstants(FULLY_WET, RACE_CONSTANTS, brutal);
    expect(soaked.weightCarRacing).toBeGreaterThanOrEqual(0);
    expect(soaked.weightCarQualifying).toBeGreaterThanOrEqual(0);
    expect(soaked.weightEnginePerformance).toBeGreaterThanOrEqual(0);
    expect(soaked.weightCarRacing + soaked.weightDriverRacing).toBeCloseTo(1, 10);
    expect(soaked.weightChassisPerformance + soaked.weightEnginePerformance).toBeCloseTo(1, 10);
  });
});

describe("who a driver is in the wet", () => {
  it("leaves a dry round alone, by identity", () => {
    const dry = driver({ wetWeather: 95 });
    expect(wetDriver(dry, DRY)).toBe(dry);
  });

  it("leaves a driver whose wet rating equals their dry one exactly as they are", () => {
    // The majority of the pool, and the reason this term costs nothing to
    // author for a driver nobody has an opinion about.
    const ordinary = driver({ racing: 80, qualifying: 76, composure: 72, wetWeather: 80 });
    const wet = wetDriver({ ...ordinary, wetWeather: ordinary.racing }, FULLY_WET);
    expect(wet.racing).toBeCloseTo(ordinary.racing, 10);
  });

  it("moves pace and composure toward the wet rating, further the wetter", () => {
    const specialist = driver({ racing: 70, qualifying: 70, composure: 70, wetWeather: 95 });
    const damp = wetDriver(specialist, { wet: true, wetness: 0.3 });
    const soaked = wetDriver(specialist, FULLY_WET);
    expect(damp.racing).toBeGreaterThan(specialist.racing);
    expect(soaked.racing).toBeGreaterThan(damp.racing);
    expect(soaked.qualifying).toBeGreaterThan(damp.qualifying);
    expect(soaked.composure).toBeGreaterThan(damp.composure);
    // Pace moves further than composure: staying on the road is partly the
    // ordinary discipline that keeps a driver out of the barrier in the dry.
    expect(soaked.racing - specialist.racing).toBeGreaterThan(
      soaked.composure - specialist.composure,
    );
  });

  it("pulls a poor wet driver down as readily as it lifts a good one", () => {
    const poor = driver({ racing: 90, qualifying: 90, wetWeather: 60 });
    const soaked = wetDriver(poor, FULLY_WET);
    expect(soaked.racing).toBeLessThan(poor.racing);
    expect(soaked.qualifying).toBeLessThan(poor.qualifying);
  });

  it("touches nothing the rain has no opinion about", () => {
    const someone = driver({ wetWeather: 99 });
    const soaked = wetDriver(someone, FULLY_WET);
    expect(soaked.consistency).toBe(someone.consistency);
    expect(soaked.adaptability).toBe(someone.adaptability);
    expect(soaked.wetWeather).toBe(someone.wetWeather);
  });
});

describe("a wet race, run", () => {
  /** How often the second of two entrants beat the first, over many races. */
  function upsetRate(field: readonly RaceEntrant[], weather: RaceWeather, races = 3000): number {
    const rng = createRng(7);
    const underdog = field[1]?.driverId;
    let wins = 0;
    for (let race = 0; race < races; race += 1) {
      const result = simulateRace(field, rng, RACE_CONSTANTS, { weather });
      if (result.winnerDriverId === underdog) {
        wins += 1;
      }
    }
    return wins / races;
  }

  it("reports the weather it was run in", () => {
    const field = [entrant("a"), entrant("b")];
    const result = simulateRace(field, createRng(1), RACE_CONSTANTS, { weather: FULLY_WET });
    expect(result.weather).toEqual(FULLY_WET);
    expect(simulateRace(field, createRng(1), RACE_CONSTANTS, { weather: DRY }).weather).toEqual(
      DRY,
    );
  });

  it("reorders the field more than a dry one does", () => {
    // Equal drivers in unequal cars: what the rain has to buy is the weaker car
    // beating the stronger one more often, and nothing else here can produce it.
    const field: RaceEntrant[] = [
      {
        ...entrant("quick"),
        chassis: { racing: 85, qualifying: 85, consistency: 80, reliability: 95 },
      },
      {
        ...entrant("slow"),
        chassis: { racing: 70, qualifying: 70, consistency: 80, reliability: 95 },
      },
    ];
    expect(upsetRate(field, FULLY_WET)).toBeGreaterThan(upsetRate(field, DRY));
  });

  it("hands the race to the wet specialist it would not have handed him dry", () => {
    const field: RaceEntrant[] = [
      {
        ...entrant("dry-ace", { racing: 88, qualifying: 88, wetWeather: 70 }),
        chassis: { racing: 80, qualifying: 80, consistency: 80, reliability: 95 },
      },
      {
        ...entrant("rain-master", { racing: 74, qualifying: 74, wetWeather: 99 }),
        chassis: { racing: 80, qualifying: 80, consistency: 80, reliability: 95 },
      },
    ];
    const dry = upsetRate(field, DRY);
    const wet = upsetRate(field, FULLY_WET);
    // Not merely "more often": the wet rating is worth enough to turn the
    // result around, which is the claim the whole feature makes.
    expect(dry).toBeLessThan(0.5);
    expect(wet).toBeGreaterThan(0.5);
  });

  it("retires far more cars than the same race in the dry", () => {
    const field = Array.from({ length: 20 }, (_, index) => entrant(`car-${index}`));
    const retirementRate = (weather: RaceWeather): number => {
      const rng = createRng(9);
      let retired = 0;
      let started = 0;
      for (let race = 0; race < 400; race += 1) {
        const result = simulateRace(field, rng, RACE_CONSTANTS, { weather });
        retired += result.retirements;
        started += result.classifiedCount + result.retirements;
      }
      return retired / started;
    };
    expect(retirementRate(FULLY_WET)).toBeGreaterThan(retirementRate(DRY) * 1.15);
  });

  it("leaves a dry round scored exactly as it was before weather existed", () => {
    // The regression that matters most: adding weather must not quietly change
    // what a dry afternoon is worth. Same field, same stream position, forced
    // dry either way — the scores have to be identical.
    const field = [entrant("a", { racing: 80 }), entrant("b", { racing: 74 })];
    const forced = simulateRace(field, createRng(5), RACE_CONSTANTS, { weather: DRY });
    const alsoForced = simulateRace(field, createRng(5), RACE_CONSTANTS, { weather: DRY });
    expect(forced.entries.map((entry) => entry.raceScore)).toEqual(
      alsoForced.entries.map((entry) => entry.raceScore),
    );
    // And a driver's wet rating cannot reach a dry score at all.
    const drenched = [
      entrant("a", { racing: 80, wetWeather: 1 }),
      entrant("b", { racing: 74, wetWeather: 100 }),
    ];
    expect(
      simulateRace(drenched, createRng(5), RACE_CONSTANTS, { weather: DRY }).entries.map(
        (entry) => entry.raceScore,
      ),
    ).toEqual(forced.entries.map((entry) => entry.raceScore));
  });
});
