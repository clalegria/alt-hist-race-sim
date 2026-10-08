/**
 * Last season's drivers, over this season's grid.
 *
 * The editor's one bulk operation: take the year before, put everybody back
 * where they were, and leave the reader to sort out what does not fit. It is
 * how an era diverges deliberately rather than one swap at a time — 1982 with
 * 1981's driver market, and then whatever the reader wants to change about it.
 *
 * **Teams and seats are fixed.** This moves drivers and nothing else. The
 * entry list is this season's — a team the previous year had and this one does
 * not is simply not written to, and a team that is new keeps whoever the season
 * authored into it. Engines are not touched either: who supplies whom is the
 * other half of the editor and a separate question. A rename is invisible here
 * by construction, because a team is its id and its name is an era.
 *
 * The rule, in priority order, for every driver:
 *
 * 1. **their seat last season**, if this season's grid has that team;
 * 2. **a car at the team they already drive for**, if (1) left one;
 * 3. **nothing** — they join the pool.
 *
 * Nobody can hold two seats, so (1) beating (2) is what makes seats fall
 * vacant: a driver pulled back to last year's team leaves whoever this season
 * authored into their old seat still there, but leaves *their own* new seat
 * open. Those holes are the point — `filledLineup` refuses to apply a grid with
 * one, so the reader has to say who drives the car.
 *
 * Two adjustments where the seat count moved:
 *
 * - **more seats than last year** — the previous drivers take the first ones
 *   and the rest go to whoever this season put at the team, under (2);
 * - **fewer** — the strongest of last year's drivers are carried over, by the
 *   same overall the grid prints, and the others fall to (2) or (3) like
 *   anybody else.
 */

import { driverRatingsFor, type RatingMode } from "./buildField.js";
import { drivers as driverPool } from "./index.js";
import { authoredLineup, type DraftSeat, type LineupDraft, type SeasonLineup } from "./lineup.js";
import { compareByRating, driverOverall } from "./rating.js";
import type { Driver, SeasonSeed } from "./types.js";

/**
 * The ages a driver can be carried into a season at.
 *
 * The one thing here that is a judgement rather than bookkeeping: a grid full
 * of last year's drivers should not quietly include somebody who has aged out
 * of racing since. It is deliberately wide — wider than any real grid — because
 * this is a floor and a ceiling on plausibility, not a claim about who is quick.
 * Outside it a driver is not carried; they are not *barred* from the season, and
 * the reader can still put them in a seat by hand.
 *
 * Read against the driver's real age in the season being edited, never their
 * peak age: this is a question about the calendar, not about ratings, so it
 * gives the same answer in both rating modes.
 */
export const CARRY_OVER_AGES = { min: 16, max: 55 } as const;

function eligible(driver: Driver, year: number): boolean {
  const age = year - driver.birthYear;
  return age >= CARRY_OVER_AGES.min && age <= CARRY_OVER_AGES.max;
}

/**
 * The strongest `seats` of a team's drivers, kept in the order they came in.
 *
 * Strongest is `compareByRating`, the app's one ranking rule: the overall the
 * grid prints, with racing settling a tie, because two team-mates on the same
 * rounded overall is exactly the case a team losing a car is decided by. The
 * order the drivers came in has the final word, so an otherwise dead heat keeps
 * the driver the team itself had first; it is also the order handed back, so a
 * team that dropped a car keeps its lead driver and one that kept both keeps
 * them the way round they were. Shared with `keptGrid.ts`, which trims a team
 * that history gave more cars than the run's first year did.
 */
export function strongestOf(
  driverIds: readonly string[],
  seats: number,
  byId: ReadonlyMap<string, Driver>,
  year: number,
  mode: RatingMode,
): readonly string[] {
  if (driverIds.length <= seats) {
    return driverIds;
  }
  const rated = driverIds.map((driverId, seat) => {
    const driver = byId.get(driverId);
    const ratings = driver === undefined ? null : driverRatingsFor(driver, year, mode);
    return {
      driverId,
      seat,
      overall: ratings === null ? 0 : driverOverall(ratings),
      racing: ratings === null ? 0 : ratings.racing,
    };
  });
  return rated
    .sort((a, b) => compareByRating(a, b) || a.seat - b.seat)
    .slice(0, seats)
    .sort((a, b) => a.seat - b.seat)
    .map((entry) => entry.driverId);
}

/** Last season's drivers for one team, trimmed to the seats this season has. */
function carriedInto(
  previous: readonly string[],
  seats: number,
  byId: ReadonlyMap<string, Driver>,
  year: number,
  mode: RatingMode,
): readonly string[] {
  const available = previous.filter((driverId) => {
    const driver = byId.get(driverId);
    return driver !== undefined && eligible(driver, year);
  });
  return strongestOf(available, seats, byId, year, mode);
}

/** Everything the carry-over reads besides the two seasons. */
export interface CarryOverOptions {
  /**
   * The previous season's grid as it was actually raced, or `null` for the one
   * it was entered with. In an era the reader may have rewritten last year, and
   * copying the grid they watched is what "last season" means to them.
   */
  readonly previousLineup?: SeasonLineup | null;
  /** Which ratings decide who is strongest when a team loses a seat. */
  readonly mode?: RatingMode;
  readonly pool?: readonly Driver[];
}

/**
 * This season's grid with last season's drivers put back where they were.
 *
 * `current` is what the reader is editing — the draft on screen, or the applied
 * lineup, or the authored one. It is what supplies rule (2): where a seat is
 * not claimed by somebody's previous team, whoever is in it now stays in it.
 *
 * Returns a draft, and usually one with holes: an open seat is the honest
 * answer to "two drivers want this car", and the editor makes the reader
 * resolve each before the season can be run.
 */
export function carryOverLineup(
  season: SeasonSeed,
  previous: SeasonSeed,
  current: LineupDraft,
  options: CarryOverOptions = {},
): LineupDraft {
  const { previousLineup = null, mode = "peak", pool = driverPool } = options;
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  const before = previousLineup ?? authoredLineup(previous);

  const seatCount = new Map(season.entries.map((entry) => [entry.teamId, entry.drivers.length]));
  const carried: Record<string, readonly string[]> = {};
  // (1) Everybody back to the team they drove for last year. Nobody can appear
  // twice, because nobody held two seats last year either.
  for (const [teamId, seats] of seatCount) {
    const last = before[teamId];
    carried[teamId] = last === undefined ? [] : carriedInto(last, seats, byId, season.year, mode);
  }
  const claimed = new Set(Object.values(carried).flat());

  const next: Record<string, readonly DraftSeat[]> = {};
  for (const [teamId, seats] of seatCount) {
    const taken = carried[teamId] ?? [];
    // (2) Whoever this team has now and nobody carried elsewhere keeps a car
    // here. Per *team*, not per seat index: which of a team's two cars somebody
    // is in is not a fact the sim models, so a driver whose team kept him is
    // kept, wherever in the list the carried-over drivers left room.
    const staying = (current[teamId] ?? []).filter(
      (driverId): driverId is string =>
        driverId !== null && !claimed.has(driverId) && !taken.includes(driverId),
    );
    const filling = [...taken, ...staying];
    // (3) Anyone left over is unemployed, and any seat left over is open.
    next[teamId] = Array.from({ length: seats }, (_, seat) => filling[seat] ?? null);
  }
  return next;
}
