/**
 * Run settings: the what-ifs chosen in the settings dialog, beside the luck on the day,
 * and fixed for the whole run once it is under way.
 *
 * **Every setting's historical answer is null**, the way a null `lineup` is the
 * grid history had: "is this a what-if?" is a property of the value rather than
 * a comparison somebody has to remember to make, and an all-historical run is
 * exactly the run it was before settings existed.
 *
 * Recorded on each `World` (`settings`), so the recipe picks them up with the
 * rest of a world's inputs, and remembered between visits like the luck on the day. Both
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
  flatTrends,
  randomChassis,
  randomEngines,
  randomTrends,
  type SeasonChassis,
  type SeasonEngineRatings,
  type SeasonSeed,
  type SeasonTrends,
  variedChassis,
  variedEngines,
} from "@alt-hist/data";
import { type Breakdowns, createRng, deriveSeed, type PointsScale } from "@alt-hist/engine";
import { isPlayable, PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

/** What a setup screen's settings are fixed for, which is what their copy says. */
export type RunUnit = "season" | "era";

/** The Mechanical failures answers that are what-ifs; Realistic is null. */
export type FewerBreakdowns = Exclude<Breakdowns, "realistic">;

/** How far *Random factor is added* may move a chassis or an engine, either way: the stops it offers. */
export const CAR_VARIATION_SPREADS = [2, 5, 10, 20, 30] as const;
export type CarVariationSpread = (typeof CAR_VARIATION_SPREADS)[number];

/**
 * What *Random factor is added* moves a chassis or an engine off: **real**,
 * that year's authored one, re-rolled every season; or **last**, the one raced
 * the year before in this run (a walk), era only.
 */
export const CAR_VARIATION_BASES = ["real", "last"] as const;
export type CarVariationBase = (typeof CAR_VARIATION_BASES)[number];

/**
 * The *Chassis performance* and *Engine performance* what-ifs, one answer each;
 * Historical is null. **varied** (*Random factor is added*) moves each team's
 * chassis, or each engine, by up to `spread` either way, off the one `from`
 * names; **random** (*Totally random*) draws each rating anywhere between the
 * season's weakest and strongest. An engine is rolled once for every team that
 * runs it.
 */
export type CarPerformance =
  | {
      readonly kind: "varied";
      readonly spread: CarVariationSpread;
      readonly from: CarVariationBase;
    }
  | { readonly kind: "random" };

/** The *In-season development* what-ifs: a random trend for every car, or none at all. */
export type Development = "random" | "none";

export interface RunSettings {
  /**
   * Whether the chassis are as authored, varied about them, or random —
   * *Chassis performance* on screen. On both setup screens. Reaches the cars
   * through `rolledChassisOf`.
   */
  readonly carPerformance: CarPerformance | null;
  /**
   * The same answers for the engines — *Engine performance* — rolled per
   * engine, so every team running one moves together. Reaches them through
   * `rolledEnginesOf`.
   */
  readonly enginePerformance: CarPerformance | null;
  /**
   * Which way each car's year runs: as authored, a random trend for every car,
   * or none (`trendsOf`). On both setup screens.
   */
  readonly development: Development | null;
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
   * base of its first season in the run (`firstYearInRun` in `@alt-hist/data`).
   * **Era only**, like `careerEvents`.
   */
  readonly teamNames: "first" | null;
  /**
   * Whether teams are painted as they were each year, or each keeps the livery
   * of its first season in the run, by the same rule as the name. Display
   * only. **Era only**.
   */
  readonly liveries: "first" | null;
  /**
   * Whether teams run the engine history gave them each year, or each keeps
   * the supplier of its first season in the run (`withFirstEngines` in
   * `@alt-hist/data`). **Era only**.
   */
  readonly engineSuppliers: "first" | null;
  /**
   * Whether every year has the teams history gave it, or the run's first year's
   * teams at their first-year seat counts, with the rules for the seats that
   * leaves empty (`keptGrid.ts` in `@alt-hist/data`). **Era only**, like
   * `careerEvents`.
   */
  readonly teamsAndSeats: EmptySeatRules | null;
}

/** Every setting on its historical answer: the run as it happened. */
export const HISTORICAL_SETTINGS: RunSettings = {
  carPerformance: null,
  enginePerformance: null,
  development: null,
  breakdowns: null,
  reliability: null,
  points: null,
  careerEvents: null,
  teamNames: null,
  liveries: null,
  engineSuppliers: null,
  teamsAndSeats: null,
};

/**
 * The settings that change a run: *Cars as reliable as* only sets how often
 * cars break down, so under *Mechanical failures: None* it is dropped. The setup screen keeps the
 * reader's choice (greyed out) so switching back restores it; a world records
 * only what is in force.
 */
export function settingsInForce(settings: RunSettings): RunSettings {
  return settings.breakdowns === "none" && settings.reliability !== null
    ? { ...settings, reliability: null }
    : settings;
}

/** A value as JSON with every object's keys sorted, so two equal settings print alike. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Whether two sets of settings give the same answers, however their objects were built. */
export function sameSettings(a: RunSettings, b: RunSettings): boolean {
  return canonical(a) === canonical(b);
}

/** The era-only settings, which a standalone season never shows and never runs. */
const ERA_ONLY = [
  "careerEvents",
  "teamNames",
  "liveries",
  "engineSuppliers",
  "teamsAndSeats",
] as const;

/** Whether a roll walks from the previous year's: the one answer that reads the year before. */
function walks(roll: CarPerformance | null): boolean {
  return roll?.kind === "varied" && roll.from === "last";
}

/** A walk varied off the real one instead, for a season with no year before it in the run. */
function offTheReal(roll: CarPerformance | null): CarPerformance | null {
  return roll?.kind === "varied" && roll.from === "last" ? { ...roll, from: "real" } : roll;
}

/**
 * The settings a standalone season runs: the era-only ones dropped, and a
 * chassis or an engine walking from the previous year's varied off the real
 * one instead, since a season has no last year in the run. One remembered set
 * serves both setup screens, so the reader's era choice is kept there while a
 * season records only what it offers.
 */
export function seasonSettings(settings: RunSettings): RunSettings {
  if (
    ERA_ONLY.every((key) => settings[key] === null) &&
    !walks(settings.carPerformance) &&
    !walks(settings.enginePerformance)
  ) {
    return settings;
  }
  return {
    ...settings,
    carPerformance: offTheReal(settings.carPerformance),
    enginePerformance: offTheReal(settings.enginePerformance),
    careerEvents: null,
    teamNames: null,
    liveries: null,
    engineSuppliers: null,
    teamsAndSeats: null,
  };
}

/**
 * The settings a screen offers, back on their historical answers: the settings
 * dialog's Restore defaults. A season's screen keeps the era-only answers it
 * does not show, as its form passes them through untouched.
 */
export function historicalSettings(settings: RunSettings, eraSettings: boolean): RunSettings {
  if (eraSettings) {
    return HISTORICAL_SETTINGS;
  }
  return {
    ...HISTORICAL_SETTINGS,
    careerEvents: settings.careerEvents,
    teamNames: settings.teamNames,
    liveries: settings.liveries,
    engineSuppliers: settings.engineSuppliers,
    teamsAndSeats: settings.teamsAndSeats,
  };
}

/**
 * The settings to remember after a standalone season's own were changed on its
 * grid: the season's answers, over the era-only ones already remembered, which
 * the season never showed and so must not erase. A chassis or engine roll the
 * season only *read* as its own — an era's walk, which a season races off the
 * real one — stays as remembered.
 */
export function rememberedAfterSeason(stored: RunSettings, season: RunSettings): RunSettings {
  const read = seasonSettings(stored);
  const kept = (key: "carPerformance" | "enginePerformance") =>
    JSON.stringify(read[key]) === JSON.stringify(season[key]) ? stored[key] : season[key];
  return {
    ...season,
    carPerformance: kept("carPerformance"),
    enginePerformance: kept("enginePerformance"),
    careerEvents: stored.careerEvents,
    teamNames: stored.teamNames,
    liveries: stored.liveries,
    engineSuppliers: stored.engineSuppliers,
    teamsAndSeats: stored.teamsAndSeats,
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

/** The key Chassis performance's stream is derived under, apart from the races' own. */
export const CAR_PERFORMANCE_STREAM = "car-performance";

/** The key Engine performance's stream is derived under, apart from the chassis roll and the races. */
export const ENGINE_PERFORMANCE_STREAM = "engine-performance";

/** The key In-season development's stream is derived under, apart from every other roll. */
export const DEVELOPMENT_STREAM = "development";

/**
 * A run's own chassis for a season, or null for the authored ones: the one
 * place Chassis performance reaches the cars, as `driverPoolOf` is for drivers.
 *
 * Rolled from its own stream (`deriveSeed`), never the races', so the same
 * seed races the same dice under any answer, and Historical draws nothing.
 * A function of the season, the settings, the seed and `lastRaced` alone:
 * `createWorld` calls it once and keeps the result on the world.
 *
 * `lastRaced` is each team's chassis as raced the year before in this run,
 * which a walk (*from previous season's car*) moves off; every other answer ignores
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
 * A run's own engine ratings for a season, or null for the authored ones: the
 * one place Engine performance reaches the engines. Per engine, so every team
 * running one moves together. On its own stream, so turning it on moves no
 * chassis and no race; `lastRaced` is each engine as raced the year before,
 * which a walk moves off.
 */
export function rolledEnginesOf(
  season: SeasonSeed,
  settings: RunSettings,
  seed: number,
  lastRaced: SeasonEngineRatings | null = null,
): SeasonEngineRatings | null {
  const roll = settings.enginePerformance;
  if (roll === null) {
    return null;
  }
  const rng = createRng(deriveSeed(seed, ENGINE_PERFORMANCE_STREAM));
  if (roll.kind === "random") {
    return randomEngines(season, rng);
  }
  return variedEngines(season, roll.spread, rng, roll.from === "last" ? lastRaced : null);
}

/**
 * A run's own development trends for a season, or null for the authored ones:
 * the one place In-season development reaches the cars. Random draws on its
 * own stream; Off draws nothing.
 */
export function trendsOf(
  season: SeasonSeed,
  settings: RunSettings,
  seed: number,
): SeasonTrends | null {
  switch (settings.development) {
    case null:
      return null;
    case "none":
      return flatTrends(season);
    case "random":
      return randomTrends(season, createRng(deriveSeed(seed, DEVELOPMENT_STREAM)));
  }
}

/**
 * What *Keep the first season's teams: Yes* opens on: last year's driver first, at the
 * grid editor's default racing ages, drivers active that year only.
 */
export const OPENING_SEAT_RULES: EmptySeatRules = {
  fill: "last",
  minAge: 18,
  maxAge: 42,
  activeOnly: true,
};

/** The fills the setup screen offers, in its order. */
export const OFFERED_SEAT_FILLS = ["last", "best"] as const;

/** What the reader is shown for each fill on offer. */
export const SEAT_FILL_LABELS: Readonly<Record<(typeof OFFERED_SEAT_FILLS)[number], string>> = {
  last: "Last year's driver, if possible",
  best: "The best available driver",
};

/** Whether a run's chassis walk from the previous year's. */
export function walksFromLastYear(settings: RunSettings): boolean {
  return walks(settings.carPerformance);
}

/** Whether a run's engines walk from the previous year's. */
export function enginesWalkFromLastYear(settings: RunSettings): boolean {
  return walks(settings.enginePerformance);
}

/** What the reader is shown for a Chassis or Engine performance answer: `noun` is which. */
export function carPerformanceLabel(roll: CarPerformance, noun: "chassis" | "engine"): string {
  if (roll.kind === "random") {
    return "Totally random";
  }
  return roll.from === "last"
    ? `Random factor ±${roll.spread} from previous season's ${noun}`
    : `Random factor ±${roll.spread}`;
}

/** What the reader is shown for each In-season development answer. */
export const DEVELOPMENT_LABELS: Readonly<Record<Development, string>> = {
  random: "Random",
  none: "Off",
};

/** What the reader is shown for each Mechanical failures answer. */
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
 * authored ones, a year with no season, a Chassis or Engine performance answer,
 * spread or base this build does not offer, a Mechanical failures, In-season
 * development, Driver career events, Team name, Livery or Engine supplier
 * changes answer that is not a what-if, or *Keep the first season's teams*
 * rules this build does not offer. Takes `unknown` because both callers read
 * storage the reader controls.
 */
export function parseRunSettings(raw: unknown): RunSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  if (
    !(
      "carPerformance" in raw &&
      "enginePerformance" in raw &&
      "development" in raw &&
      "points" in raw &&
      "breakdowns" in raw &&
      "reliability" in raw &&
      "careerEvents" in raw &&
      "teamNames" in raw &&
      "liveries" in raw &&
      "engineSuppliers" in raw &&
      "teamsAndSeats" in raw
    )
  ) {
    return null;
  }
  const carPerformance = parseCarPerformance(raw.carPerformance);
  const enginePerformance = parseCarPerformance(raw.enginePerformance);
  const points = parsePoints(raw.points);
  const breakdowns = parseFewerBreakdowns(raw.breakdowns);
  const reliability = parseReliability(raw.reliability);
  const teamsAndSeats = parseTeamsAndSeats(raw.teamsAndSeats);
  const { careerEvents, teamNames, liveries, engineSuppliers, development } = raw;
  if (
    carPerformance === undefined ||
    enginePerformance === undefined ||
    points === undefined ||
    breakdowns === undefined ||
    reliability === undefined ||
    teamsAndSeats === undefined ||
    (careerEvents !== null && careerEvents !== "none") ||
    (teamNames !== null && teamNames !== "first") ||
    (liveries !== null && liveries !== "first") ||
    (engineSuppliers !== null && engineSuppliers !== "first") ||
    (development !== null && development !== "random" && development !== "none")
  ) {
    return null;
  }
  return {
    carPerformance,
    enginePerformance,
    development,
    breakdowns,
    reliability,
    points,
    careerEvents,
    teamNames,
    liveries,
    engineSuppliers,
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

/** One line per setting that is not historical, in one fixed order. */
export function whatIfsOf(settings: RunSettings): readonly Setting[] {
  const lines: Setting[] = [];
  if (settings.breakdowns !== null) {
    lines.push({ name: "Mechanical failures", value: BREAKDOWNS_LABELS[settings.breakdowns] });
  }
  if (settings.reliability !== null) {
    lines.push({ name: "Cars as reliable as", value: String(settings.reliability) });
  }
  if (settings.points !== null) {
    lines.push({ name: "Points system", value: pointsValues(settings.points) });
  }
  if (settings.carPerformance !== null) {
    lines.push({
      name: "Chassis performance",
      value: carPerformanceLabel(settings.carPerformance, "chassis"),
    });
  }
  if (settings.enginePerformance !== null) {
    lines.push({
      name: "Engine performance",
      value: carPerformanceLabel(settings.enginePerformance, "engine"),
    });
  }
  if (settings.development !== null) {
    lines.push({ name: "In-season development", value: DEVELOPMENT_LABELS[settings.development] });
  }
  if (settings.careerEvents !== null) {
    lines.push({ name: "Driver career events", value: "No" });
  }
  if (settings.teamNames !== null) {
    lines.push({ name: "Team name changes", value: "No" });
  }
  if (settings.liveries !== null) {
    lines.push({ name: "Livery changes", value: "No" });
  }
  if (settings.engineSuppliers !== null) {
    lines.push({ name: "Engine supplier changes", value: "No" });
  }
  if (settings.teamsAndSeats !== null) {
    lines.push({
      name: "Keep the first season's teams",
      value: teamsAndSeatsLabel(settings.teamsAndSeats),
    });
  }
  return lines;
}

/** What the reader is shown for a *Keep the first season's teams* answer. */
export function teamsAndSeatsLabel(rules: EmptySeatRules): string {
  const fill = rules.fill === "best" ? "best available driver" : "last year's driver first";
  const active = rules.activeOnly ? " · real-grid drivers only" : "";
  return `Yes · ${fill} · ages ${rules.minAge}–${rules.maxAge}${active}`;
}
