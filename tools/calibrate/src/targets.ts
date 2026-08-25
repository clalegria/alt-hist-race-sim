/**
 * Calibration targets: what a season actually produced.
 *
 * These are the numbers the seed ratings are tuned against. Each is a 14- or
 * 15-race sample, so they carry real sampling noise — a team whose true win
 * probability is 15% can easily win 3 of 14. The goal is for the observed
 * season to be a *plausible* draw from the model, not for the model's expected
 * values to reproduce it exactly. Chasing an exact match would be overfitting
 * to one season.
 *
 * One record per authored year, keyed by year, because the tuner takes
 * `--year` like every other tool here. A season with no targets cannot be
 * tuned, and says so rather than falling back to somebody else's numbers.
 */

/** The car attributes the tuner is allowed to move. */
export type CarField = "racing" | "qualifying" | "consistency" | "reliability";

/** The engine attributes it is allowed to move. Engines have no consistency. */
export type EngineField = "racing" | "qualifying" | "reliability";

export interface SeasonTargets {
  readonly year: number;
  /** Rounds actually run, which is what every count below is out of. */
  readonly races: number;
  /** Race winners. The most reliable record a season has. */
  readonly driverWins: Readonly<Record<string, number>>;
  /** Constructor wins, derived from the same record. */
  readonly teamWins: Readonly<Record<string, number>>;
  /**
   * Pole distribution. Less reliable than the win record — treat these as the
   * shape of the season rather than exact counts, and note they are weighted
   * more gently in the objective for that reason.
   */
  readonly teamPoles: Readonly<Record<string, number>>;
  /** Share of starters that failed to see the flag. */
  readonly retirementRate: number;
  /**
   * Which cars are worth tuning, and on which attributes.
   *
   * Deliberately not the whole grid: a car that never wins under any rating in
   * range contributes nothing to the objective but noise, so moving it is
   * fitting noise. The tail still matters to the retirement rate, and that is
   * reached through the *engine* knobs, which move every customer at once.
   */
  readonly tunedCars: ReadonlyArray<readonly [string, readonly CarField[]]>;
  /**
   * Which drivers the tuner may move, on the `--drivers` flag only.
   *
   * Off by default and deliberately so: driver ratings are the author's, and
   * whether to fit them at all is still an open decision (`docs/DECISIONS.md`).
   */
  readonly tunedDrivers: ReadonlyArray<readonly [string, readonly ("racing" | "qualifying")[]]>;
}

/**
 * 1980 — 14 races.
 *
 * Wins: Jones 5, Piquet 3, Arnoux 2, Reutemann 1, Laffite 1, Pironi 1,
 * Jabouille 1. Poles are approximate: the shape is Renault's turbo as the
 * qualifying weapon, Ligier and Williams next, and Giacomelli's Alfa Romeo
 * stealing one.
 */
const TARGETS_1980: SeasonTargets = {
  year: 1980,
  races: 14,
  driverWins: { jones: 5, piquet: 3, arnoux: 2, reutemann: 1, laffite: 1, pironi: 1, jabouille: 1 },
  teamWins: { williams: 6, brabham: 3, renault: 3, ligier: 2 },
  teamPoles: { renault: 6, ligier: 3, williams: 3, brabham: 1, alfa_romeo: 1 },
  // Roughly 40-45% of a 1980 field failed to see the flag.
  retirementRate: 0.42,
  tunedCars: [
    ["williams", ["racing", "qualifying", "reliability"]],
    ["ligier", ["racing", "qualifying", "reliability"]],
    ["brabham", ["racing", "qualifying", "reliability"]],
    ["renault", ["racing", "qualifying", "reliability"]],
    ["alfa_romeo", ["qualifying"]],
  ],
  tunedDrivers: [
    ["jones", ["racing", "qualifying"]],
    ["reutemann", ["racing", "qualifying"]],
    ["piquet", ["racing", "qualifying"]],
    ["arnoux", ["racing", "qualifying"]],
    ["jabouille", ["racing", "qualifying"]],
    ["laffite", ["racing"]],
    ["pironi", ["racing"]],
  ],
};

/**
 * 1981 — 15 races.
 *
 * Wins: Piquet 3, Prost 3, Jones 2, Reutemann 2, Villeneuve 2, Laffite 2,
 * Watson 1 — a genuinely split season, which is why no single car should
 * dominate the model's distribution the way Williams does in 1980.
 *
 * Poles: Renault 6 (Arnoux 4, Prost 2), Brabham 4, Williams 2, and one each for
 * Ferrari, Ligier and Patrese's Arrows at Long Beach. Same caveat as 1980 — the
 * shape is what matters, and the shape is that the turbos owned Saturday while
 * Sunday was anybody's.
 *
 * **The retirement target is 1980's, not a measurement of 1981.** No separate
 * figure has been established for the year, and inventing one would put a made-
 * up number where the honest answer is "the era curve is an open decision" —
 * see `mechanicalDnfEraScale` in `docs/DECISIONS.md`. This is the one target
 * here that is inherited rather than observed.
 */
const TARGETS_1981: SeasonTargets = {
  year: 1981,
  races: 15,
  driverWins: {
    piquet: 3,
    prost: 3,
    jones: 2,
    reutemann: 2,
    villeneuve_g: 2,
    laffite: 2,
    watson: 1,
  },
  teamWins: { williams: 4, brabham: 3, renault: 3, ferrari: 2, ligier: 2, mclaren: 1 },
  teamPoles: { renault: 6, brabham: 4, williams: 2, ferrari: 1, ligier: 1, arrows: 1 },
  retirementRate: 0.42,
  tunedCars: [
    ["williams", ["racing", "qualifying", "reliability"]],
    ["brabham", ["racing", "qualifying", "reliability"]],
    ["renault", ["racing", "qualifying", "reliability"]],
    ["ligier", ["racing", "qualifying", "reliability"]],
    ["ferrari", ["racing", "qualifying", "reliability"]],
    ["mclaren", ["racing", "qualifying", "reliability"]],
    ["arrows", ["qualifying"]],
    ["alfa_romeo", ["qualifying"]],
  ],
  tunedDrivers: [
    ["piquet", ["racing", "qualifying"]],
    ["prost", ["racing", "qualifying"]],
    ["jones", ["racing", "qualifying"]],
    ["reutemann", ["racing", "qualifying"]],
    ["villeneuve_g", ["racing", "qualifying"]],
    ["laffite", ["racing"]],
    ["watson", ["racing"]],
  ],
};

const BY_YEAR: ReadonlyMap<number, SeasonTargets> = new Map(
  [TARGETS_1980, TARGETS_1981].map((targets) => [targets.year, targets]),
);

/** The years that can be tuned. Authoring a season does not create targets. */
const TARGET_YEARS: readonly number[] = [...BY_YEAR.keys()].sort((a, b) => a - b);

/**
 * The targets for a year, or a throw.
 *
 * A throw rather than a fallback, for the reason `seasonSeed` throws: tuning
 * 1982's ratings against 1980's results would look like it worked.
 */
export function targetsFor(year: number): SeasonTargets {
  const found = BY_YEAR.get(year);
  if (found === undefined) {
    throw new Error(`No calibration targets for ${year}. Available: ${TARGET_YEARS.join(", ")}`);
  }
  return found;
}

/** A count as a share of the season's races. */
export function share(
  targets: SeasonTargets,
  counts: Readonly<Record<string, number>>,
  key: string,
): number {
  return (counts[key] ?? 0) / targets.races;
}
