import { describe, expect, it } from "vitest";
import type { DriverRatings } from "../model/index.js";
import {
  canonicalAbility,
  canonicalAge,
  peakWindow,
  ratingsForSeason,
  seasonDeficits,
} from "./ageing.js";
import { AGEING_CONSTANTS, type AttributeSensitivity } from "./constants.js";
import type { DriverCareer } from "./types.js";

/**
 * The authored plateau width that the warp maps one-for-one onto the canonical
 * one. Derived rather than written down, because the identity property below is
 * exactly the claim that these two agree.
 */
const CANONICAL_PEAK_SEASONS =
  AGEING_CONSTANTS.canonical.plateauEnd - AGEING_CONSTANTS.canonical.plateauStart + 1;

const PEAK: DriverRatings = {
  racing: 90,
  qualifying: 88,
  consistency: 84,
  adaptability: 80,
  composure: 86,
  wetWeather: 82,
};

/**
 * The nominal career: peaks at 30, as wide as the canonical plateau, both traits
 * at 5.
 *
 * Chosen so the warp is the identity — this driver *is* the population curve —
 * because most of what follows is easier to reason about when canonical age and
 * real age are the same number.
 */
function career(overrides: Partial<DriverCareer> = {}): DriverCareer {
  return {
    birthYear: 1957,
    debutSeason: 1980,
    peakSeason: 1987,
    peakSeasons: CANONICAL_PEAK_SEASONS,
    developmentSpeed: 5,
    declineSpeed: 5,
    peak: PEAK,
    ...overrides,
  };
}

const ATTRIBUTES = ["racing", "qualifying", "consistency", "adaptability", "composure"] as const;

/**
 * Slack for comparing two slopes off the anchor table.
 *
 * Two segments the author wrote as equal falls — 0.90 → 0.85 and 0.85 → 0.80 —
 * do not subtract to the same double, so a bare `>=` between them fails by
 * 5e-17. Far below any difference the table means to express.
 */
const SLOPE_EPSILON = 1e-9;

/** Every attribute at once, so a claim about "getting better" cannot cherry-pick. */
function total(ratings: DriverRatings): number {
  return ATTRIBUTES.reduce((sum, key) => sum + ratings[key], 0);
}

describe("the population curve", () => {
  const { canonicalAbility: anchors, canonical } = AGEING_CONSTANTS;

  it("is exactly 1.0 across the canonical peak, and never above it", () => {
    expect(canonicalAbility(canonical.peak)).toBe(1);
    for (let age = 0; age <= 70; age += 0.5) {
      expect(canonicalAbility(age), `${age}`).toBeLessThanOrEqual(1);
    }
  });

  it("rises the whole way to the peak and falls the whole way after it", () => {
    for (let age = 0; age < canonical.peak - 2; age += 0.5) {
      expect(canonicalAbility(age + 0.5), `${age}`).toBeGreaterThanOrEqual(canonicalAbility(age));
    }
    for (let age = canonical.plateauEnd; age < 70; age += 0.5) {
      expect(canonicalAbility(age + 0.5), `${age}`).toBeLessThanOrEqual(canonicalAbility(age));
    }
  });

  it("holds the plateau within a few percent of peak", () => {
    for (let age = canonical.plateauStart; age <= canonical.plateauEnd; age += 0.5) {
      expect(canonicalAbility(age), `${age}`).toBeGreaterThan(0.95);
    }
  });

  it("steepens with every segment past the plateau, so decline accelerates", () => {
    // The property the old exponent bought, now a shape rather than a formula.
    // A table with a constant slope past the plateau fails the acceleration
    // check at the bottom.
    //
    // Runs to the end of the table, which is only possible because the table
    // reaches its floor *at* its last anchor rather than easing onto one: a
    // fall that keeps steepening has to cross zero, so a tail that lands softly
    // on a floor has to decelerate to get there. That is why the anchors stop
    // at the floor and `canonicalAbility` holds flat past it.
    const past = anchors.filter((anchor) => anchor.age >= canonical.plateauEnd);
    const slopes = past.slice(1).map((anchor, index) => {
      const previous = past[index];
      if (previous === undefined) {
        throw new Error("unreachable");
      }
      return (previous.ability - anchor.ability) / (anchor.age - previous.age);
    });
    for (let index = 1; index < slopes.length; index += 1) {
      const [before, after] = [slopes[index - 1], slopes[index]];
      if (before === undefined || after === undefined) {
        throw new Error("unreachable");
      }
      expect(after, `segment ${index}`).toBeGreaterThanOrEqual(before - SLOPE_EPSILON);
    }
    // Never easing is not enough on its own — a straight line satisfies it. The
    // fall has to actually get faster, and by a lot, or "decline accelerates"
    // is not a claim the table makes.
    const [first, last] = [slopes[0], slopes[slopes.length - 1]];
    if (first === undefined || last === undefined) {
      throw new Error("unreachable");
    }
    expect(last).toBeGreaterThan(first * 2);
    expect(slopes.length).toBeGreaterThan(2);
  });

  it("ramps in, peaks in the teens, then eases the whole way into the plateau", () => {
    // A teenager gains far more per year than a 24-year-old, which is the other
    // half of the shape the author asked for. It is not a monotone ease from
    // the very bottom, though: the table ramps *in* below the mid-teens, since
    // a twelve-year-old is not improving as a racing driver faster than a
    // sixteen-year-old is. So the claim is a single maximum with no wobble on
    // either side of it, which is stronger than "eases throughout" would be.
    const rising = anchors.filter((anchor) => anchor.age <= canonical.plateauStart);
    const slopes = rising.slice(1).map((anchor, index) => {
      const previous = rising[index];
      if (previous === undefined) {
        throw new Error("unreachable");
      }
      return (anchor.ability - previous.ability) / (anchor.age - previous.age);
    });
    const steepest = slopes.indexOf(Math.max(...slopes));

    for (let index = 1; index <= steepest; index += 1) {
      const [before, after] = [slopes[index - 1], slopes[index]];
      if (before === undefined || after === undefined) {
        throw new Error("unreachable");
      }
      expect(after, `ramping in, segment ${index}`).toBeGreaterThan(before);
    }
    for (let index = steepest + 1; index < slopes.length; index += 1) {
      const [before, after] = [slopes[index - 1], slopes[index]];
      if (before === undefined || after === undefined) {
        throw new Error("unreachable");
      }
      expect(after, `easing in, segment ${index}`).toBeLessThan(before);
    }

    // The maximum sits in the teens, and there is a real ease after it — both
    // halves have to exist, or a monotone ramp passes the loops above.
    const fastest = rising[steepest + 1];
    if (fastest === undefined) {
      throw new Error("unreachable");
    }
    expect(fastest.age).toBeGreaterThanOrEqual(13);
    expect(fastest.age).toBeLessThanOrEqual(20);
    expect(steepest).toBeGreaterThan(0);
    expect(steepest).toBeLessThan(slopes.length - 1);
  });

  it("holds flat beyond both ends instead of running off the scale", () => {
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (first === undefined || last === undefined) {
      throw new Error("unreachable");
    }
    expect(canonicalAbility(first.age - 30)).toBe(first.ability);
    expect(canonicalAbility(last.age + 30)).toBe(last.ability);
    expect(first.ability).toBeGreaterThan(0);
  });
});

describe("the warp onto the population curve", () => {
  it("is the identity for the nominal career", () => {
    // The property the whole design rests on: a driver whose plateau is as wide
    // as the canonical one is not warped at all, so the canonical curve is a
    // description of him and not a coincidence.
    const nominal = career();
    for (let season = 1965; season <= 2010; season += 1) {
      expect(canonicalAge(nominal, season), `${season}`).toBeCloseTo(season - nominal.birthYear, 9);
    }
  });

  it("pins the peak season to the canonical peak, however the career is authored", () => {
    for (const overrides of [
      { peakSeason: 1975, birthYear: 1953, developmentSpeed: 9, declineSpeed: 2 },
      { peakSeason: 2001, birthYear: 1975, peakSeasons: 8, developmentSpeed: 1 },
      { peakSeason: 1990, birthYear: 1944, peakSeasons: 1, declineSpeed: 10 },
    ]) {
      const driver = career(overrides);
      expect(canonicalAge(driver, driver.peakSeason), `${driver.peakSeason}`).toBeCloseTo(
        AGEING_CONSTANTS.canonical.peak,
        9,
      );
    }
  });

  it("lets a fast developer reach the same canonical age younger", () => {
    const fast = career({ developmentSpeed: 10 });
    const slow = career({ developmentSpeed: 1 });
    for (let season = 1970; season < 1980; season += 1) {
      expect(canonicalAge(fast, season), `${season}`).toBeGreaterThan(canonicalAge(slow, season));
    }
  });

  it("lets a slow decliner spend real years on very few canonical ones", () => {
    const durable = career({ declineSpeed: 1 });
    const brittle = career({ declineSpeed: 10 });
    const end = peakWindow(durable).end;
    for (let season = end + 1; season <= end + 12; season += 1) {
      expect(canonicalAge(durable, season), `${season}`).toBeLessThan(
        canonicalAge(brittle, season),
      );
    }
  });

  it("moves monotonically with the season, so no season is out of order", () => {
    for (const driver of [career(), career({ developmentSpeed: 1, declineSpeed: 10 })]) {
      for (let season = 1960; season < 2020; season += 1) {
        expect(canonicalAge(driver, season + 1), `${season}`).toBeGreaterThan(
          canonicalAge(driver, season),
        );
      }
    }
  });
});

describe("the peak window", () => {
  it("is exactly as many seasons as were authored", () => {
    // `peakSeasons` is a count, not a nudge against some nominal width. An
    // earlier version scaled it, and an authored 7 came back as 17.
    for (const peakSeasons of [1, 2, 3, 7, 12]) {
      const window = peakWindow(career({ peakSeasons }));
      expect(window.end - window.start + 1, `${peakSeasons}`).toBe(peakSeasons);
      expect(window.start, `${peakSeasons}`).toBeLessThanOrEqual(1987);
      expect(window.end, `${peakSeasons}`).toBeGreaterThanOrEqual(1987);
    }
  });

  it("gives an even span its extra season after the peak, not before", () => {
    // Form is held on to longer than it takes to find; the asymmetry is a
    // choice rather than a rounding accident, so it is pinned.
    expect(peakWindow(career({ peakSeasons: 4 }))).toEqual({ start: 1986, end: 1989 });
  });

  it("never disappears, however it is authored", () => {
    for (const peakSeasons of [0, -3, 0.4]) {
      const window = peakWindow(career({ peakSeasons }));
      expect(window, `${peakSeasons}`).toEqual({ start: 1987, end: 1987 });
    }
  });
});

describe("the shape of a career", () => {
  it("is exactly the authored peak in the peak season", () => {
    expect(ratingsForSeason(career(), 1987)).toEqual(PEAK);
  });

  it("improves every season from debut to the plateau", () => {
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    for (let season = 1980; season < peakWindow(driver).start; season += 1) {
      expect(
        total(ratingsForSeason(driver, season + 1)),
        `${season} → ${season + 1}`,
      ).toBeGreaterThan(total(ratingsForSeason(driver, season)));
    }
  });

  it("holds within a few percent of peak across the whole plateau", () => {
    // Debuting well before the plateau opens, so no season here is still
    // paying the inexperience penalty — that is a separate axis, tested below.
    const driver = career({ debutSeason: 1975, peakSeasons: 7 });
    const window = peakWindow(driver);
    for (let season = window.start; season <= window.end; season += 1) {
      const ratio = ratingsForSeason(driver, season).racing / PEAK.racing;
      expect(ratio, `${season}`).toBeGreaterThan(0.95);
      expect(ratio, `${season}`).toBeLessThanOrEqual(1);
    }
  });

  it("never gets worse on the way up or better on the way down", () => {
    const driver = career();
    for (let season = 1970; season < 1987; season += 1) {
      expect(total(ratingsForSeason(driver, season + 1)), `${season}`).toBeGreaterThanOrEqual(
        total(ratingsForSeason(driver, season)),
      );
    }
    for (let season = 1987; season < 2015; season += 1) {
      expect(total(ratingsForSeason(driver, season + 1)), `${season}`).toBeLessThanOrEqual(
        total(ratingsForSeason(driver, season)),
      );
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
    // The first season past the plateau should cost less than the fifth. A
    // straight-line decline passes the test above and fails this one.
    // Measured over three seasons rather than one: a single season's fall is a
    // couple of rating points, and integer rounding can swallow the difference.
    const driver = career();
    const end = peakWindow(driver).end;
    const dropOver = (from: number, to: number): number =>
      total(ratingsForSeason(driver, from)) - total(ratingsForSeason(driver, to));
    expect(dropOver(end + 6, end + 9)).toBeGreaterThan(dropOver(end, end + 3));
  });

  it("is the population curve read at the driver's own pace, and nothing more", () => {
    // Pins the composition rather than any one number: past the peak, with no
    // authored events, a rating is exactly the canonical ability at the driver's
    // canonical age, through the decline sensitivity. Any extra term anywhere in
    // the decline path — an exponent, a per-driver steepness — shows up here.
    //
    // The clamp is part of the composition and has to be applied here too. A
    // fast decliner swept two decades past his plateau reads off the bottom of
    // the population curve, and `qualifying` — the most decline-sensitive
    // attribute — goes negative before the floor catches it.
    const { minRating, maxRating, declineSensitivity } = AGEING_CONSTANTS;
    let unclamped = 0;
    for (const declineSpeed of [1, 5, 10]) {
      const driver = career({ declineSpeed });
      for (let season = 1988; season <= 2005; season += 1) {
        const shortfall = 1 - canonicalAbility(canonicalAge(driver, season));
        for (const key of ATTRIBUTES) {
          const raw = PEAK[key] * (1 - shortfall * declineSensitivity[key]);
          const expected = Math.round(Math.min(Math.max(raw, minRating), maxRating));
          if (raw > minRating && raw < maxRating) {
            unclamped += 1;
          }
          expect(ratingsForSeason(driver, season)[key], `${declineSpeed} ${key} ${season}`).toBe(
            expected,
          );
        }
      }
    }
    // Most of the sweep must land inside the range, or the assertion above is
    // mostly comparing the floor with itself and would survive the composition
    // being wrong everywhere it matters.
    expect(unclamped).toBeGreaterThan(3 * (2005 - 1988 + 1) * ATTRIBUTES.length * 0.75);
  });

  it("keeps every rating inside 1–100, whatever the career", () => {
    const brutal = career({ declineSpeed: 10, stepDown: { season: 1995, severity: 1 } });
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
  const FLAT = {
    racing: 90,
    qualifying: 90,
    consistency: 90,
    adaptability: 90,
    composure: 90,
    wetWeather: 90,
  };

  /**
   * Every pair of attributes, read against the sensitivity that separates them:
   * the more sensitive of the two sits lower, and two the table treats alike
   * land on the same number.
   *
   * Derived from the table rather than naming one pair, so it covers all five
   * attributes and cannot go stale when a sensitivity is changed — `racing` and
   * `consistency` are both 1.0 in decline today, and a test that hard-coded
   * `racing < consistency` was asserting a gap the table had stopped claiming.
   */
  function expectProfile(
    ratings: DriverRatings,
    sensitivity: AttributeSensitivity,
    label: string,
  ): void {
    for (const a of ATTRIBUTES) {
      for (const b of ATTRIBUTES) {
        const where = `${label}: ${a} (${sensitivity[a]}) vs ${b} (${sensitivity[b]})`;
        if (sensitivity[a] > sensitivity[b]) {
          expect(ratings[a], where).toBeLessThan(ratings[b]);
        } else if (sensitivity[a] === sensitivity[b]) {
          expect(ratings[a], where).toBe(ratings[b]);
        }
      }
    }
    // A table flattened to one value satisfies every equality above and says
    // nothing. The profile has to actually separate the attributes.
    expect(new Set(ATTRIBUTES.map((key) => ratings[key])).size, label).toBeGreaterThan(1);
  }

  it("makes the young driver quick but wild", () => {
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992, peak: FLAT });
    const young = ratingsForSeason(driver, 1981);
    // The headline claim, in the terms a reader would put it in...
    expect(young.composure).toBeLessThan(young.qualifying);
    expect(young.consistency).toBeLessThan(young.racing);
    // ...and the whole profile, so no pair drifts out of order unnoticed.
    expectProfile(young, AGEING_CONSTANTS.developmentSensitivity, "young");
  });

  it("makes the old driver wise but slow", () => {
    const driver = career({ peak: FLAT });
    const old = ratingsForSeason(driver, peakWindow(driver).end + 8);
    // One-lap pace is the first thing to go and judgement the last, which is
    // what "wise but slow" means. Racing and consistency are level in decline
    // today, so the pair that carries the claim is qualifying against composure.
    expect(old.qualifying).toBeLessThan(old.composure);
    expectProfile(old, AGEING_CONSTANTS.declineSensitivity, "old");
  });

  it("agrees they are the same driver at their peak", () => {
    // The two profiles above must come from the curve, not from the peak
    // ratings quietly differing.
    expect(ratingsForSeason(career({ peak: FLAT }), 1987)).toEqual(FLAT);
  });
});

describe("age and experience are separate axes", () => {
  it("holds the older rookie to the same inexperience as the younger one", () => {
    const young = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    const old = career({ birthYear: 1952, debutSeason: 1980, peakSeason: 1985 });
    const inexperience = (driver: DriverCareer): number =>
      seasonDeficits(driver, 1980).development - (1 - canonicalAbility(canonicalAge(driver, 1980)));
    expect(inexperience(old)).toBeCloseTo(inexperience(young), 9);
  });

  it("still rates the older rookie higher, because he is further up the ability curve", () => {
    const young = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    const old = career({ birthYear: 1955, debutSeason: 1980, peakSeason: 1985 });
    expect(total(ratingsForSeason(old, 1980))).toBeGreaterThan(
      total(ratingsForSeason(young, 1980)),
    );
  });

  it("has always spent the inexperience penalty by the peak season", () => {
    // Otherwise a driver who peaks in his second season can never be rated what
    // he is authored at, and the authored peak stops being reachable at all.
    // The slowest learner is the one that catches it.
    for (const gap of [0, 1, 2]) {
      const driver = career({ debutSeason: 1987 - gap, developmentSpeed: 1 });
      expect(ratingsForSeason(driver, 1987), `debut ${1987 - gap}`).toEqual(PEAK);
    }
  });

  it("rates the experienced driver above an identical rookie of the same age", () => {
    // Same birth year, same peak, same traits: the only difference is that one
    // of them has been doing this for four years.
    const rookie = career({ birthYear: 1958, debutSeason: 1982 });
    const experienced = career({ birthYear: 1958, debutSeason: 1978 });
    expect(total(ratingsForSeason(experienced, 1982))).toBeGreaterThan(
      total(ratingsForSeason(rookie, 1982)),
    );
  });
});

describe("authored career events", () => {
  it("costs a driver something extra in their debut season", () => {
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    const withRookie = seasonDeficits(driver, 1980).development;
    const withoutRookie = seasonDeficits({ ...driver, debutSeason: 1975 }, 1980).development;
    expect(withRookie).toBeGreaterThan(withoutRookie);
  });

  it("never makes a driver better before their debut than in it", () => {
    // The bug this pins: the rookie penalty landed only on the debut season and
    // the development curve was flat-clamped before it, so a driver's last year
    // out of the sport outrated his first year in it.
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    const debut = total(ratingsForSeason(driver, 1980));
    for (let season = 1979; season >= 1966; season -= 1) {
      expect(total(ratingsForSeason(driver, season)), `${season}`).toBeLessThan(debut);
    }
  });

  it("climbs towards the debut instead of sitting flat", () => {
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    for (let season = 1974; season < 1980; season += 1) {
      expect(
        total(ratingsForSeason(driver, season + 1)),
        `${season} → ${season + 1}`,
      ).toBeGreaterThan(total(ratingsForSeason(driver, season)));
    }
  });

  it("carries the full inexperience penalty into every season before the debut", () => {
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    const inexperience = (season: number): number =>
      seasonDeficits(driver, season).development -
      (1 - canonicalAbility(canonicalAge(driver, season)));
    expect(inexperience(1979)).toBeCloseTo(inexperience(1980), 9);
    expect(inexperience(1981)).toBeLessThan(inexperience(1980));
  });

  it("stops falling away once the population curve bottoms out", () => {
    // Otherwise a late debutant swept from age 18 hits the rating floor and the
    // table becomes a column of 1s.
    const driver = career({ birthYear: 1962, debutSeason: 1980, peakSeason: 1992 });
    expect(seasonDeficits(driver, 1950).development).toBe(seasonDeficits(driver, 1940).development);
  });

  it("applies a step down from its season onward, and never before", () => {
    const driver = career({ stepDown: { season: 1993, severity: 0.8 } });
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

  it("scales a step down by its severity", () => {
    const mild = career({ stepDown: { season: 1993, severity: 0.2 } });
    const severe = career({ stepDown: { season: 1993, severity: 0.9 } });
    expect(total(ratingsForSeason(severe, 1993))).toBeLessThan(total(ratingsForSeason(mild, 1993)));
  });

  it("keeps punishing past a severity of 1, in proportion", () => {
    // Uncapped on purpose, so an author can say "the worst year of his life"
    // and be believed. What is asserted is the proportionality rather than any
    // one drop: at the plateau the whole deficit is the off season, so twice
    // the severity is twice the distance below peak, for every attribute.
    const plain = career({ peakSeasons: 7 });
    const once = career({ peakSeasons: 7, offSeasons: [{ season: 1989, severity: 1 }] });
    const twice = career({ peakSeasons: 7, offSeasons: [{ season: 1989, severity: 2 }] });
    for (const attribute of ATTRIBUTES) {
      const base = ratingsForSeason(plain, 1989)[attribute];
      const one = base - ratingsForSeason(once, 1989)[attribute];
      const two = base - ratingsForSeason(twice, 1989)[attribute];
      expect(one, attribute).toBeGreaterThan(0);
      // Within a point, since every rating is rounded on the way out.
      expect(two, attribute).toBeGreaterThanOrEqual(2 * one - 1);
      expect(two, attribute).toBeLessThanOrEqual(2 * one + 1);
    }
  });

  it("floors an absurd off season at the minimum rather than running away", () => {
    const ruined = career({ peakSeasons: 7, offSeasons: [{ season: 1989, severity: 40 }] });
    for (const attribute of ATTRIBUTES) {
      expect(ratingsForSeason(ruined, 1989)[attribute], attribute).toBe(AGEING_CONSTANTS.minRating);
    }
    // And a negative severity is a typo, not a good year.
    const typo = career({ peakSeasons: 7, offSeasons: [{ season: 1989, severity: -3 }] });
    expect(total(ratingsForSeason(typo, 1989))).toBe(
      total(ratingsForSeason(career({ peakSeasons: 7 }), 1989)),
    );
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
  const shared = { birthYear: 1962, debutSeason: 1980, peakSeason: 1992 } as const;

  it("reaches the rookie season itself, not just the years after it", () => {
    // The bug this replaces: rookie level was set by the gap between debut and
    // plateau alone, so a driver authored at 10 debuted exactly as far below
    // peak as one authored at 1. Both halves of the fix are in play here — the
    // warp puts the fast developer further up the ability curve, and the relief
    // takes most of the inexperience penalty off him.
    const fast = ratingsForSeason(career({ ...shared, developmentSpeed: 10 }), 1980);
    const slow = ratingsForSeason(career({ ...shared, developmentSpeed: 1 }), 1980);
    expect(total(fast)).toBeGreaterThan(total(slow));
  });

  it("gives the slow developer the bigger jump out of his rookie season", () => {
    // "Some drivers have a big jump from their rookie season to their second,
    // but not all." The fast developer arrives already close to his plateau, so
    // there is less of a jump left to make.
    const jump = (developmentSpeed: number): number =>
      total(ratingsForSeason(career({ ...shared, developmentSpeed }), 1981)) -
      total(ratingsForSeason(career({ ...shared, developmentSpeed }), 1980));
    expect(jump(1)).toBeGreaterThan(jump(10));
  });

  it("puts the fast developer ahead of the slow one all the way up", () => {
    const fast = career({ ...shared, developmentSpeed: 9 });
    const slow = career({ ...shared, developmentSpeed: 2 });
    for (let season = 1980; season < peakWindow(fast).start; season += 1) {
      expect(total(ratingsForSeason(fast, season)), `${season}`).toBeGreaterThan(
        total(ratingsForSeason(slow, season)),
      );
    }
    // Both still arrive at the same plateau — speed shapes when, not what.
    expect(ratingsForSeason(fast, 1992)).toEqual(ratingsForSeason(slow, 1992));
  });

  it("clears the inexperience penalty sooner for the fast learner", () => {
    const inexperience = (developmentSpeed: number, season: number): number => {
      const driver = career({ ...shared, developmentSpeed });
      return (
        seasonDeficits(driver, season).development -
        (1 - canonicalAbility(canonicalAge(driver, season)))
      );
    };
    expect(inexperience(10, 1982)).toBeCloseTo(0, 9);
    expect(inexperience(1, 1982)).toBeGreaterThan(0);
  });
});

describe("decline speed", () => {
  it("decides when a driver falls away, not how hard", () => {
    // A durable driver is still near peak at an age that finishes a brittle one,
    // but neither ever falls faster than the population curve allows — which is
    // the property that stops an ordinary career collapsing in its thirties.
    const durable = career({ declineSpeed: 1 });
    const brittle = career({ declineSpeed: 10 });
    const at = (driver: DriverCareer, season: number): number =>
      ratingsForSeason(driver, season).racing / PEAK.racing;
    expect(at(durable, 2001)).toBeGreaterThan(0.9);
    expect(at(brittle, 2001)).toBeLessThan(at(durable, 2001));
  });

  it("costs the durable driver less every season past the plateau", () => {
    const durable = career({ declineSpeed: 2 });
    const brittle = career({ declineSpeed: 9 });
    for (let season = peakWindow(durable).end + 1; season <= 2005; season += 1) {
      expect(total(ratingsForSeason(durable, season)), `${season}`).toBeGreaterThan(
        total(ratingsForSeason(brittle, season)),
      );
    }
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
