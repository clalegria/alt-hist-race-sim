import { describe, expect, it } from "vitest";
import type { DriverRatings } from "../model/index.js";
import { peakWindow, ratingsForSeason, seasonDeficits } from "./ageing.js";
import { AGEING_CONSTANTS } from "./constants.js";
import type { DriverCareer } from "./types.js";

const PEAK: DriverRatings = {
  racing: 90,
  qualifying: 88,
  consistency: 84,
  adaptability: 80,
  composure: 86,
};

function career(overrides: Partial<DriverCareer> = {}): DriverCareer {
  return {
    debutSeason: 1980,
    peakSeason: 1987,
    peakSeasons: 5,
    developmentSpeed: 5,
    declineSpeed: 5,
    peak: PEAK,
    ...overrides,
  };
}

const ATTRIBUTES = ["racing", "qualifying", "consistency", "adaptability", "composure"] as const;

/** Every attribute at once, so a claim about "getting better" cannot cherry-pick. */
function total(ratings: DriverRatings): number {
  return ATTRIBUTES.reduce((sum, key) => sum + ratings[key], 0);
}

describe("the peak window", () => {
  it("centres an odd span on the peak season", () => {
    expect(peakWindow(career({ peakSeason: 1987, peakSeasons: 7 }))).toEqual({
      start: 1984,
      end: 1990,
    });
    expect(peakWindow(career({ peakSeasons: 1 }))).toEqual({ start: 1987, end: 1987 });
  });

  it("gives an even span its extra season after the peak, not before", () => {
    // Form is held on to longer than it takes to find; the asymmetry is a
    // choice rather than a rounding accident, so it is pinned.
    expect(peakWindow(career({ peakSeasons: 4 }))).toEqual({ start: 1986, end: 1989 });
  });

  it("never disappears, however it is authored", () => {
    for (const peakSeasons of [0, -3, 0.4]) {
      const window = peakWindow(career({ peakSeasons }));
      expect(window.start, `${peakSeasons}`).toBeLessThanOrEqual(1987);
      expect(window.end, `${peakSeasons}`).toBeGreaterThanOrEqual(1987);
    }
  });
});

describe("the shape of a career", () => {
  it("is exactly the authored peak in the peak season", () => {
    expect(ratingsForSeason(career(), 1987)).toEqual(PEAK);
  });

  it("improves every season from debut to the plateau", () => {
    const driver = career({ debutSeason: 1980, peakSeason: 1990, peakSeasons: 3 });
    for (let season = 1980; season < 1989; season += 1) {
      expect(
        total(ratingsForSeason(driver, season + 1)),
        `${season} → ${season + 1}`,
      ).toBeGreaterThan(total(ratingsForSeason(driver, season)));
    }
  });

  it("holds within a few percent of peak across the whole plateau", () => {
    const driver = career({ peakSeasons: 7 });
    const window = peakWindow(driver);
    for (let season = window.start; season <= window.end; season += 1) {
      const ratio = ratingsForSeason(driver, season).racing / PEAK.racing;
      expect(ratio, `${season}`).toBeGreaterThan(1 - AGEING_CONSTANTS.plateauEdgeDeficit * 1.5);
      expect(ratio, `${season}`).toBeLessThanOrEqual(1);
    }
  });

  it("declines every season once the plateau ends", () => {
    const driver = career();
    const end = peakWindow(driver).end;
    for (let season = end; season < end + 12; season += 1) {
      expect(total(ratingsForSeason(driver, season + 1)), `${season} → ${season + 1}`).toBeLessThan(
        total(ratingsForSeason(driver, season)),
      );
    }
  });

  it("declines faster the further past peak it gets", () => {
    // The exponent above 1 is the point: the first season past the plateau
    // should cost less than the fifth. A linear decline passes the test above
    // and fails this one.
    const driver = career();
    const end = peakWindow(driver).end;
    const drop = (season: number): number =>
      total(ratingsForSeason(driver, season)) - total(ratingsForSeason(driver, season + 1));
    expect(drop(end + 4)).toBeGreaterThan(drop(end));
  });

  it("keeps every rating inside 1–100, whatever the career", () => {
    const brutal = career({ declineSpeed: 10, steepDecline: { season: 1995, severity: 1 } });
    for (let season = 1960; season <= 2040; season += 1) {
      for (const key of ATTRIBUTES) {
        const value = ratingsForSeason(brutal, season)[key];
        expect(value, `${key} in ${season}`).toBeGreaterThanOrEqual(AGEING_CONSTANTS.minRating);
        expect(value, `${key} in ${season}`).toBeLessThanOrEqual(AGEING_CONSTANTS.maxRating);
        expect(Number.isInteger(value), `${key} in ${season} is not whole`).toBe(true);
      }
    }
  });
});

describe("young and old are different, not just better and worse", () => {
  // A flat peak, so any gap between two attributes is the sensitivity tables
  // and not the rounding of two different authored numbers. With the tables
  // flat, every attribute here lands on exactly the same value.
  const FLAT = { racing: 90, qualifying: 90, consistency: 90, adaptability: 90, composure: 90 };

  it("makes the young driver quick but wild", () => {
    const driver = career({
      debutSeason: 1980,
      peakSeason: 1990,
      peakSeasons: 3,
      peak: FLAT,
    });
    const young = ratingsForSeason(driver, 1981);
    expect(young.composure).toBeLessThan(young.qualifying);
    expect(young.consistency).toBeLessThan(young.racing);
  });

  it("makes the old driver wise but slow", () => {
    const driver = career({ peak: FLAT });
    const old = ratingsForSeason(driver, peakWindow(driver).end + 8);
    expect(old.qualifying).toBeLessThan(old.composure);
    expect(old.racing).toBeLessThan(old.consistency);
  });

  it("agrees they are the same driver at their peak", () => {
    // The two profiles above must come from the curve, not from the peak
    // ratings quietly differing.
    expect(ratingsForSeason(career({ peak: FLAT }), 1987)).toEqual(FLAT);
  });
});

describe("authored career events", () => {
  it("costs a driver something extra in their debut season", () => {
    const driver = career({ debutSeason: 1980, peakSeason: 1990 });
    const withRookie = seasonDeficits(driver, 1980).development;
    const withoutRookie = seasonDeficits({ ...driver, debutSeason: 1979 }, 1980).development;
    expect(withRookie).toBeGreaterThan(withoutRookie);
  });

  it("never makes a driver better before their debut than in it", () => {
    // The bug this pins: the rookie penalty landed only on the debut season and
    // the development curve was flat-clamped before it, so a driver's last year
    // out of the sport outrated his first year in it.
    const driver = career({ debutSeason: 1980, peakSeason: 1990, peakSeasons: 3 });
    const debut = total(ratingsForSeason(driver, 1980));
    for (let season = 1979; season >= 1966; season -= 1) {
      expect(total(ratingsForSeason(driver, season)), `${season}`).toBeLessThan(debut);
    }
  });

  it("climbs towards the debut instead of sitting flat", () => {
    const driver = career({ debutSeason: 1980, peakSeason: 1990, peakSeasons: 3 });
    for (let season = 1974; season < 1980; season += 1) {
      expect(
        total(ratingsForSeason(driver, season + 1)),
        `${season} → ${season + 1}`,
      ).toBeGreaterThan(total(ratingsForSeason(driver, season)));
    }
  });

  it("carries the rookie penalty into every season before the debut", () => {
    const driver = career({ debutSeason: 1980, peakSeason: 1990 });
    const penalty = AGEING_CONSTANTS.rookieSeasonPenalty;
    // Both the debut season and the one before it carry it; the season after
    // does not.
    expect(seasonDeficits(driver, 1980).development).toBeGreaterThanOrEqual(penalty);
    expect(seasonDeficits(driver, 1979).development).toBeGreaterThan(penalty);
    expect(seasonDeficits(driver, 1981).development).toBeLessThan(
      seasonDeficits(driver, 1980).development,
    );
  });

  it("stops falling away once the pre-debut cap is reached", () => {
    // Otherwise a late debutant swept from age 18 hits the rating floor and the
    // table becomes a column of 1s.
    const driver = career({ debutSeason: 1980, peakSeason: 1990 });
    const far = seasonDeficits(driver, 1960).development;
    const further = seasonDeficits(driver, 1950).development;
    expect(further).toBe(far);
  });

  it("applies a steep decline from its season onward, and never before", () => {
    const driver = career({ steepDecline: { season: 1993, severity: 0.8 } });
    const plain = career();
    expect(total(ratingsForSeason(driver, 1992))).toBe(total(ratingsForSeason(plain, 1992)));
    expect(total(ratingsForSeason(driver, 1993))).toBeLessThan(
      total(ratingsForSeason(plain, 1993)),
    );
    // Persistent, not a one-season dip.
    expect(total(ratingsForSeason(driver, 1996))).toBeLessThan(
      total(ratingsForSeason(plain, 1996)),
    );
  });

  it("scales a steep decline by its severity", () => {
    const mild = career({ steepDecline: { season: 1993, severity: 0.2 } });
    const severe = career({ steepDecline: { season: 1993, severity: 0.9 } });
    expect(total(ratingsForSeason(severe, 1993))).toBeLessThan(total(ratingsForSeason(mild, 1993)));
  });

  it("dips an off season and leaves the seasons around it alone", () => {
    const driver = career({ peakSeasons: 7, offSeasons: [{ season: 1989, severity: 0.6 }] });
    const plain = career({ peakSeasons: 7 });
    expect(total(ratingsForSeason(driver, 1989))).toBeLessThan(
      total(ratingsForSeason(plain, 1989)),
    );
    for (const season of [1988, 1990]) {
      expect(total(ratingsForSeason(driver, season)), `${season}`).toBe(
        total(ratingsForSeason(plain, season)),
      );
    }
  });
});

describe("development speed", () => {
  it("puts the fast developer ahead of the slow one early on", () => {
    const shared = { debutSeason: 1980, peakSeason: 1990, peakSeasons: 3 } as const;
    const fast = career({ ...shared, developmentSpeed: 9 });
    const slow = career({ ...shared, developmentSpeed: 2 });
    expect(total(ratingsForSeason(fast, 1983))).toBeGreaterThan(
      total(ratingsForSeason(slow, 1983)),
    );
    // Both still arrive at the same plateau — speed shapes the route, not the
    // destination.
    expect(ratingsForSeason(fast, 1990)).toEqual(ratingsForSeason(slow, 1990));
  });
});

describe("determinism", () => {
  it("gives the same answer every time, with no generator in sight", () => {
    const driver = career({ offSeasons: [{ season: 1989, severity: 0.5 }] });
    for (let season = 1975; season <= 2005; season += 1) {
      expect(ratingsForSeason(driver, season)).toEqual(ratingsForSeason(driver, season));
    }
  });
});
