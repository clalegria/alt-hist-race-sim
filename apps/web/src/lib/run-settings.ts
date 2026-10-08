/**
 * Run settings: the what-ifs chosen on a setup screen, beside Randomness, and
 * fixed for the whole run.
 *
 * **Every setting's historical answer is null**, the way a null `lineup` is the
 * grid history had: "is this a what-if?" is a property of the value rather than
 * a comparison somebody has to remember to make, and an all-historical run is
 * exactly the run it was before settings existed.
 *
 * Recorded on each `World` (`settings`), so the recipe picks them up with the
 * rest of a world's inputs, and remembered between visits like Randomness. Both
 * of those read untrusted storage, so both go through `parseRunSettings`.
 *
 * Pure: no storage here (`preferences.ts` reads and writes it).
 */

import {
  AGE_RANGE,
  type Driver,
  drivers,
  driversWithoutCareerEvents,
  type EmptySeatRules,
  randomChassis,
  type SeasonChassis,
  type SeasonSeed,
  variedChassis,
} from "@alt-hist/data";
import { type Breakdowns, createRng, deriveSeed, type PointsScale } from "@alt-hist/engine";
import { isPlayable, PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

/** What a setup screen's settings are fixed for, which is what their copy says. */
export type RunUnit = "season" | "era";

/** The Breakdowns answers that are what-ifs; Realistic is null. */
export type FewerBreakdowns = Exclude<Breakdowns, "realistic">;

/** How far *Car performance: Varied* may move a car, either way: the stops it offers. */
export const CAR_VARIATION_SPREADS = [2, 5, 10, 20, 30] as const;
export type CarVariationSpread = (typeof CAR_VARIATION_SPREADS)[number];

/**
 * What *Car performance: Varied* moves a car off: **real**, that year's
 * authored car, re-rolled every season; or **last**, the car the team raced
 * the year before in this run (a walk), era only.
 */
export const CAR_VARIATION_BASES = ["real", "last"] as const;
export type CarVariationBase = (typeof CAR_VARIATION_BASES)[number];

/**
 * The Car performance what-ifs; Historical is null. **Varied** moves each
 * team's chassis by up to `spread` either way, off the car `from` names;
 * **Random** draws each chassis rating anywhere between the season's weakest
 * and strongest. Chassis only: an engine is shared by its customers, so
 * rolling one would move several teams at once.
 */
export type CarPerformance =
  | {
      readonly kind: "varied";
      readonly spread: CarVariationSpread;
      readonly from: CarVariationBase;
    }
  | { readonly kind: "random" };

export interface RunSettings {
  /**
   * Whether the cars are as authored, varied about them, or random. On both
   * setup screens. Reaches the cars through `rolledChassisOf`.
   */
  readonly carPerformance: CarPerformance | null;
  /** How often cars break down: fewer, none, or null for as often as each year's did. */
  readonly breakdowns: FewerBreakdowns | null;
  /**
   * The season whose `retirementFactor` every year's cars break down at, or
   * null for each year's own. Driver error keeps the year's own. A playable year.
   */
  readonly reliability: number | null;
  /**
   * The points table every year is scored on, or null for each year's own.
   * Only ever one of `pointsTables()`: the reader picks an authored table,
   * never writes one.
   */
  readonly points: PointsScale | null;
  /**
   * Whether drivers have the career events authored for them — a `stepDown`,
   * `offSeasons` — or none, every career on the plain ageing curve. **Era
   * only**: `seasonSettings` drops it from a standalone season.
   */
  readonly careerEvents: "none" | null;
  /**
   * Whether teams are named as they were each year, or each keeps the name and
   * base of its first season in the run (`identityYear` in `@alt-hist/data`).
   * The livery still follows history. **Era only**, like `careerEvents`.
   */
  readonly teamNames: "first" | null;
  /**
   * Whether every year has the teams history gave it, or the run's first year's
   * teams at their first-year seat counts, with the rules for the seats that
   * leaves empty (`keptGrid.ts` in `@alt-hist/data`). **Era only**, like
   * `careerEvents`. Only the automatic fills are offered: `"reader"` waits for
   * the pending grid.
   */
  readonly teamsAndSeats: EmptySeatRules | null;
}

/** Every setting on its historical answer: the run as it happened. */
export const HISTORICAL_SETTINGS: RunSettings = {
  carPerformance: null,
  breakdowns: null,
  reliability: null,
  points: null,
  careerEvents: null,
  teamNames: null,
  teamsAndSeats: null,
};

/**
 * The settings that change a run: Reliability only sets how often cars break
 * down, so under Breakdowns: None it is dropped. The setup screen keeps the
 * reader's choice (greyed out) so switching back restores it; a world records
 * only what is in force.
 */
export function settingsInForce(settings: RunSettings): RunSettings {
  return settings.breakdowns === "none" && settings.reliability !== null
    ? { ...settings, reliability: null }
    : settings;
}

/**
 * The settings a standalone season runs: the era-only ones dropped, and a car
 * walking from the previous year's varied off the real one instead, since a season has
 * no last year in the run. One remembered set serves both setup screens, so
 * the reader's era choice is kept there while a season records only what it
 * offers.
 */
export function seasonSettings(settings: RunSettings): RunSettings {
  const cars = settings.carPerformance;
  const walks = cars?.kind === "varied" && cars.from === "last";
  if (
    settings.careerEvents === null &&
    settings.teamNames === null &&
    settings.teamsAndSeats === null &&
    !walks
  ) {
    return settings;
  }
  return {
    ...settings,
    carPerformance: walks ? { ...cars, from: "real" } : cars,
    careerEvents: null,
    teamNames: null,
    teamsAndSeats: null,
  };
}

/**
 * The drivers a run's ratings come from: the pool, or the pool without career
 * events. Every data function that rates a driver takes a pool, so this is the
 * one place the setting reaches them.
 */
export function driverPoolOf(settings: RunSettings): readonly Driver[] {
  return settings.careerEvents === "none" ? driversWithoutCareerEvents() : drivers;
}

/** The key Car performance's stream is derived under, apart from the races' own. */
export const CAR_PERFORMANCE_STREAM = "car-performance";

/**
 * A run's own chassis for a season, or null for the authored ones: the one
 * place Car performance reaches the cars, as `driverPoolOf` is for drivers.
 *
 * Rolled from its own stream (`deriveSeed`), never the races', so the same
 * seed races the same dice under any answer, and Historical draws nothing.
 * A function of the season, the settings, the seed and `lastRaced` alone:
 * `createWorld` calls it once and keeps the result on the world.
 *
 * `lastRaced` is each team's chassis as raced the year before in this run,
 * which a walk (*from previous year's car*) moves off; every other answer ignores
 * it, and a team missing from it moves off its own authored car.
 */
export function rolledChassisOf(
  season: SeasonSeed,
  settings: RunSettings,
  seed: number,
  lastRaced: SeasonChassis | null = null,
): SeasonChassis | null {
  const cars = settings.carPerformance;
  if (cars === null) {
    return null;
  }
  const rng = createRng(deriveSeed(seed, CAR_PERFORMANCE_STREAM));
  if (cars.kind === "random") {
    return randomChassis(season, rng);
  }
  return variedChassis(season, cars.spread, rng, cars.from === "last" ? lastRaced : null);
}

/**
 * What *Keep the starting grid* opens on: previous year's drivers first, at the
 * grid editor's default racing ages, drivers active that year only.
 */
export const OPENING_SEAT_RULES: EmptySeatRules = {
  fill: "last",
  minAge: 18,
  maxAge: 42,
  activeOnly: true,
};

/** The fills the setup screen offers, in its order; `"reader"` arrives with the pending grid. */
export const OFFERED_SEAT_FILLS = ["last", "best"] as const;

/** What the reader is shown for each fill on offer. */
export const SEAT_FILL_LABELS: Readonly<Record<(typeof OFFERED_SEAT_FILLS)[number], string>> = {
  last: "Previous year's drivers first",
  best: "Best available",
};

/** Whether a run's cars walk from the previous year's: the one answer that reads the year before. */
export function walksFromLastYear(settings: RunSettings): boolean {
  const cars = settings.carPerformance;
  return cars?.kind === "varied" && cars.from === "last";
}

/** What the reader is shown for a Car performance answer. */
export function carPerformanceLabel(cars: CarPerformance): string {
  if (cars.kind === "random") {
    return "Random";
  }
  return cars.from === "last"
    ? `Varied ±${cars.spread} from previous year's car`
    : `Varied ±${cars.spread}`;
}

/** What the reader is shown for each Breakdowns answer. */
export const BREAKDOWNS_LABELS: Readonly<Record<Breakdowns, string>> = {
  realistic: "Realistic",
  fewer: "Fewer",
  none: "None",
};

/** One line of a run's settings, as `SimulationSettings` draws it. */
export interface Setting {
  readonly name: string;
  readonly value: string;
}

/** A points table the seed data uses, and the years that used it. */
export interface PointsTable {
  readonly scale: PointsScale;
  /** "1950–1959", or "1961–1965, 1980" for a table that came back. */
  readonly years: string;
  /** The years and the values, for the picker. */
  readonly label: string;
}

/** The values alone: "25 18 15 12 10 8 6 4 2 1". */
export function pointsValues(scale: PointsScale): string {
  return scale.join(" ");
}

/** Whether two tables hand out the same points. */
export function samePoints(a: PointsScale, b: PointsScale): boolean {
  return a.length === b.length && a.every((points, index) => points === b[index]);
}

/** Years as runs of consecutive ones: [1950, 1951, 1952, 1980] → "1950–1952, 1980". */
function yearSpans(years: readonly number[]): string {
  const spans: string[] = [];
  let start = years[0];
  let end = start;
  for (const year of [...years.slice(1), undefined]) {
    if (year !== undefined && end !== undefined && year === end + 1) {
      end = year;
      continue;
    }
    if (start !== undefined && end !== undefined) {
      spans.push(start === end ? `${start}` : `${start}–${end}`);
    }
    start = year;
    end = year;
  }
  return spans.join(", ");
}

let tables: readonly PointsTable[] | null = null;

/**
 * The distinct points tables across the playable seasons, oldest first.
 *
 * Read off the seed data rather than listed, so a re-authored or newly
 * authored season's table appears here the moment it exists.
 */
export function pointsTables(): readonly PointsTable[] {
  if (tables !== null) {
    return tables;
  }
  const found: { scale: PointsScale; years: number[] }[] = [];
  for (const year of PLAYABLE_SEASONS) {
    const scale = seasonSeed(year).points;
    const known = found.find((table) => samePoints(table.scale, scale));
    if (known === undefined) {
      found.push({ scale, years: [year] });
    } else {
      known.years.push(year);
    }
  }
  tables = found.map(({ scale, years }) => {
    const span = yearSpans(years);
    return { scale, years: span, label: `${span} · ${pointsValues(scale)}` };
  });
  return tables;
}

/** The table a year was scored on: the one *Same all run* (*From a year*) starts from. */
export function pointsTableOf(year: number): PointsTable | undefined {
  const scale = seasonSeed(year).points;
  return pointsTables().find((table) => samePoints(table.scale, scale));
}

/**
 * The settings `raw` describes, or null when it is not settings this build
 * could have produced: a missing field, a points table that is not one of the
 * authored ones, a year with no season, a Car performance answer, spread or base
 * this build does not offer, or a Breakdowns, Career events or Team names
 * answer that is not a what-if, or Teams and seats rules this build does not
 * offer. Takes `unknown` because both callers read storage the reader controls.
 */
export function parseRunSettings(raw: unknown): RunSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  if (
    !(
      "carPerformance" in raw &&
      "points" in raw &&
      "breakdowns" in raw &&
      "reliability" in raw &&
      "careerEvents" in raw &&
      "teamNames" in raw &&
      "teamsAndSeats" in raw
    )
  ) {
    return null;
  }
  const carPerformance = parseCarPerformance(raw.carPerformance);
  const points = parsePoints(raw.points);
  const breakdowns = parseFewerBreakdowns(raw.breakdowns);
  const reliability = parseReliability(raw.reliability);
  const teamsAndSeats = parseTeamsAndSeats(raw.teamsAndSeats);
  const { careerEvents, teamNames } = raw;
  if (
    carPerformance === undefined ||
    points === undefined ||
    breakdowns === undefined ||
    reliability === undefined ||
    teamsAndSeats === undefined ||
    (careerEvents !== null && careerEvents !== "none") ||
    (teamNames !== null && teamNames !== "first")
  ) {
    return null;
  }
  return {
    carPerformance,
    breakdowns,
    reliability,
    points,
    careerEvents,
    teamNames,
    teamsAndSeats,
  };
}

function parseTeamsAndSeats(rules: unknown): EmptySeatRules | null | undefined {
  if (rules === null) {
    return null;
  }
  if (typeof rules !== "object" || Array.isArray(rules)) {
    return undefined;
  }
  if (!("fill" in rules && "minAge" in rules && "maxAge" in rules && "activeOnly" in rules)) {
    return undefined;
  }
  const fill = OFFERED_SEAT_FILLS.find((offered) => offered === rules.fill);
  const { minAge, maxAge, activeOnly } = rules;
  const age = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= AGE_RANGE.min &&
    value <= AGE_RANGE.max;
  if (
    fill === undefined ||
    !age(minAge) ||
    !age(maxAge) ||
    minAge > maxAge ||
    typeof activeOnly !== "boolean"
  ) {
    return undefined;
  }
  return { fill, minAge, maxAge, activeOnly };
}

function parseCarPerformance(cars: unknown): CarPerformance | null | undefined {
  if (cars === null) {
    return null;
  }
  if (typeof cars !== "object" || Array.isArray(cars) || !("kind" in cars)) {
    return undefined;
  }
  if (cars.kind === "random") {
    return { kind: "random" };
  }
  if (cars.kind !== "varied" || !("spread" in cars) || !("from" in cars)) {
    return undefined;
  }
  const spread = CAR_VARIATION_SPREADS.find((offered) => offered === cars.spread);
  const from = CAR_VARIATION_BASES.find((offered) => offered === cars.from);
  return spread === undefined || from === undefined ? undefined : { kind: "varied", spread, from };
}

/** Each of these is the field's value, or undefined when it is not one this build offers. */
function parsePoints(points: unknown): PointsScale | null | undefined {
  if (points === null) {
    return null;
  }
  if (!Array.isArray(points)) {
    return undefined;
  }
  return pointsTables().find((known) => samePoints(known.scale, points))?.scale;
}

function parseFewerBreakdowns(breakdowns: unknown): FewerBreakdowns | null | undefined {
  return breakdowns === null || breakdowns === "fewer" || breakdowns === "none"
    ? breakdowns
    : undefined;
}

function parseReliability(year: unknown): number | null | undefined {
  if (year === null) {
    return null;
  }
  return typeof year === "number" && Number.isInteger(year) && isPlayable(year) ? year : undefined;
}

/** One line per setting that is not historical, in the order the setup card lists them. */
export function whatIfsOf(settings: RunSettings): readonly Setting[] {
  const lines: Setting[] = [];
  if (settings.breakdowns !== null) {
    lines.push({ name: "Breakdowns", value: BREAKDOWNS_LABELS[settings.breakdowns] });
  }
  if (settings.reliability !== null) {
    lines.push({ name: "Reliability", value: `as in ${settings.reliability}` });
  }
  if (settings.points !== null) {
    lines.push({ name: "Points", value: pointsValues(settings.points) });
  }
  if (settings.carPerformance !== null) {
    lines.push({ name: "Car performance", value: carPerformanceLabel(settings.carPerformance) });
  }
  if (settings.careerEvents !== null) {
    lines.push({ name: "Career events", value: "None" });
  }
  if (settings.teamNames !== null) {
    lines.push({ name: "Team names", value: "Keep the first" });
  }
  if (settings.teamsAndSeats !== null) {
    lines.push({ name: "Teams and seats", value: teamsAndSeatsLabel(settings.teamsAndSeats) });
  }
  return lines;
}

/** What the reader is shown for a Teams and seats answer. */
export function teamsAndSeatsLabel(rules: EmptySeatRules): string {
  const fill = rules.fill === "best" ? "best available" : "previous year's drivers first";
  const active = rules.activeOnly ? " · active drivers only" : "";
  return `Keep the starting grid · ${fill} · ages ${rules.minAge}–${rules.maxAge}${active}`;
}
