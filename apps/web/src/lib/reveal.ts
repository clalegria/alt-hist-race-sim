/**
 * The gate: a run as far as the reader has got, and nothing past it.
 *
 * The whole year is simulated the moment a seed is drawn, so the store holds
 * results nobody has read yet. Every page inside `/run` reads through
 * `revealed(run)` rather than the store's `Run`, so a page *cannot* show a
 * result past the cursor — it is never handed one. The type is what holds it:
 * `RevealedWorld` is not something a raw `World` can be passed as, so a page
 * handed the ungated world fails `pnpm typecheck`.
 *
 * The cut is by session, not by round. On a qualifying beat the round's race
 * has been run but not revealed, and `RaceResult` carries both halves, so the
 * gate passes a qualifying sheet copied field by field: the finishing order
 * does not exist in what the page receives.
 *
 * Pure, so the whole of it is property-tested without a store or a DOM.
 */

import type { RaceEntryResult, RaceResult, RaceWeather, SeasonResult } from "@alt-hist/engine";
import { crowned, cursorPlace, type EraRun, type Run, type World } from "../store/season.js";
import type { Beat, Place } from "./timeline.js";

/** One car's qualifying: where it lined up, and nothing about the race. */
export type QualifyingEntry = Pick<
  RaceEntryResult,
  "driverId" | "teamId" | "gridPosition" | "started" | "qualifyingScore" | "qualifyingGapToPole"
>;

/** A round's qualifying, without its race. A `RaceResult` is one, structurally. */
export interface QualifyingSheet {
  readonly entries: readonly QualifyingEntry[];
  readonly poleDriverId: string;
  readonly nonQualifiers: number;
  /** The weather belongs to the whole weekend, so qualifying says it too. */
  readonly weather: RaceWeather;
}

/**
 * A season as far as the reader has got through it.
 *
 * Still a `SeasonResult` — `races` is every round whose race has been revealed
 * — so every standings call reads it unchanged, and a shorter list of results
 * is simply an earlier table.
 */
export interface SeasonSoFar extends SeasonResult {
  /** How many rounds the season has. Never `races.length`, which stops at the cursor. */
  readonly rounds: number;
  /** The round whose qualifying is revealed and whose race is not, or null. */
  readonly qualifying: { readonly round: number; readonly sheet: QualifyingSheet } | null;
}

/** A year of the run, cut at the reader's cursor: what every page is handed. */
export type RevealedWorld = Omit<World, "season"> & { readonly season: SeasonSoFar };

/**
 * What a career tally reads of one year: a whole `World` or a `RevealedWorld`
 * both are one. `rounds` is present only on a year the gate has cut.
 */
export interface TalliedYear {
  readonly year: number;
  readonly points: World["points"];
  readonly season: SeasonResult & { readonly rounds?: number };
}

/**
 * Whether every race of the year has been revealed. A year cut before its last
 * race is still being written: its leader is not its champion, and a place in
 * it is a place *so far*. A whole world, which carries no `rounds`, is complete.
 */
export function isComplete(year: TalliedYear): boolean {
  const { rounds } = year.season;
  return rounds === undefined || year.season.races.length >= rounds;
}

/** A run, cut at the reader's cursor. */
export interface RevealedRun {
  readonly cursor: Place;
  /**
   * Every year the run has reached, earliest first; the cursor's own last, and
   * cut. A pending year is not among them: it has no world until it is filled.
   */
  readonly years: readonly RevealedWorld[];
  /** An era's crowned years, each whole; null for a one-year run, which has none. */
  readonly crowned: EraRun | null;
}

/** A round's qualifying, copied so that no part of its race comes with it. */
function sheetOf(race: RaceResult): QualifyingSheet {
  return {
    entries: race.entries.map((entry) => ({
      driverId: entry.driverId,
      teamId: entry.teamId,
      gridPosition: entry.gridPosition,
      started: entry.started,
      qualifyingScore: entry.qualifyingScore,
      qualifyingGapToPole: entry.qualifyingGapToPole,
    })),
    poleDriverId: race.poleDriverId,
    nonQualifiers: race.nonQualifiers,
    weather: race.weather,
  };
}

/** How many races a reader at `beat` has seen the result of. */
function racesSeen(beat: Beat, rounds: number): number {
  switch (beat.kind) {
    case "grid":
      return 0;
    case "qualifying":
      return beat.round;
    case "race":
      return beat.round + 1;
    case "summary":
    case "review":
      return rounds;
  }
}

/** One year of the run as a reader at `beat` of it has seen it. */
export function revealYear(world: World, beat: Beat): RevealedWorld {
  const { races } = world.season;
  const qualifying =
    beat.kind === "qualifying" && races[beat.round] !== undefined
      ? { round: beat.round, sheet: sheetOf(races[beat.round] as RaceResult) }
      : null;
  return {
    ...world,
    season: {
      races: races.slice(0, racesSeen(beat, races.length)),
      rounds: races.length,
      qualifying,
    },
  };
}

/**
 * The run as far as the reader has got: every year before the cursor's whole,
 * the cursor's own cut at the cursor — or, waiting on the reader, every year
 * built, whole.
 */
export function revealed(run: Run): RevealedRun {
  const past = run.kind === "season" ? [] : run.run.seasons;
  return {
    cursor: cursorPlace(run),
    years: [
      ...past.map((world) => revealYear(world, { kind: "summary" })),
      // A pending year has no world yet, so nothing of it to reveal.
      ...(run.kind === "pending" ? [] : [revealYear(run.world, run.cursor)]),
    ],
    crowned: run.kind === "season" ? null : crowned(run),
  };
}

/**
 * The qualifying of `round`: the sheet on the cursor's own round, or the
 * whole round's result once its race has been revealed too.
 */
export function qualifyingOf(season: SeasonSoFar, round: number): QualifyingSheet | undefined {
  return season.qualifying?.round === round ? season.qualifying.sheet : season.races[round];
}
