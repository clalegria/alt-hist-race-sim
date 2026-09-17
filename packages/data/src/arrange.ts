/**
 * The whole grid, rearranged in one press.
 *
 * Three *rules* rather than three edits: pair the best drivers with the best
 * cars, pair them with the worst, or throw the field in the air. They answer the
 * questions the seat-by-seat editor makes tedious — what would a season look like
 * if talent and machinery agreed, if they were exactly at odds, if neither had
 * anything to do with the other — and they are the fun end of the editor rather
 * than the careful end.
 *
 * Like `carryOver.ts` beside it, this moves drivers and **nothing else**: teams
 * and seat counts are the season's, engines are the other half of the editor,
 * and a rename is invisible because a team is its id.
 *
 * Two orderings, paired index for index:
 *
 * - the **seats**, ranked by the car that sits in them — every seat of the
 *   quickest team before every seat of the second quickest — quickest first, or
 *   slowest first for `fastest-in-slowest`;
 * - the **drivers**, ranked the way the grid on screen ranks them — the overall
 *   it prints, with racing settling a tie — best first, or shuffled for `random`.
 *
 * The cast is whoever holds a seat on the grid being rearranged, plus — if the
 * reader ticked the box — the drivers without a drive, narrowed by the very
 * filters the panel beside the grid is narrowed by. See `arrangeable`.
 *
 * Whoever the pairing runs out of goes without: more drivers than seats and the
 * remainder are unemployed, more seats than drivers and the rest stay open. Only
 * the second can happen from an applied grid, since a full one has exactly as
 * many seated drivers as seats — which is why this returns a `LineupDraft` and
 * not a `SeasonLineup`.
 *
 * It is a rule, not a rating: nothing here is tuned, and the overall it reads is
 * the display heuristic in `rating.ts` — the number on screen beside each name,
 * so the result agrees with what the reader was looking at when they pressed it.
 */

import type { Rng } from "@alt-hist/engine";
import { driverRatingsFor, type RatingMode } from "./buildField.js";
import { engineSpecOf } from "./engines.js";
import { drivers as driverPool } from "./index.js";
import type { DraftSeat, LineupDraft, SeatRef } from "./lineup.js";
import { type DriverFilters, matchesFilters } from "./people.js";
import { carOverall, carRacing, compareByRating, driverOverall } from "./rating.js";
import type { Driver, SeasonSeed } from "./types.js";

/** Which of the three rules to apply. */
export type ArrangementKind = "fastest-in-fastest" | "fastest-in-slowest" | "random";

/** In the order the editor offers them. */
export const ARRANGEMENT_KINDS: readonly ArrangementKind[] = [
  "fastest-in-fastest",
  "fastest-in-slowest",
  "random",
];

/**
 * A rearrangement as the reader chose it: the rule, the pool it draws on, and
 * whether it should happen again next year.
 *
 * Plain data, because it is part of the saved world beside the lineup it
 * produced — the grid on screen is a `SeasonLineup` like any other, and this is
 * the record of *how it came to be*, which is what lets the app say so
 * afterwards and what lets an era do it again.
 */
export interface GridArrangement {
  readonly kind: ArrangementKind;
  /** Whether drivers without a seat may take one at all. */
  readonly includeUnemployed: boolean;
  /**
   * Which of them, when they may: the pool exactly as the reader has narrowed
   * it in the editor's "Without a drive" panel.
   *
   * A snapshot rather than a reference to that panel, because a rule outlives
   * the screen it was pressed on — an era re-applies it to every following
   * year, and "the drivers who were around, aged 18 to 42" has to mean the same
   * thing in 1983 as it did in 1980 without depending on where a slider is
   * sitting three seasons later. It is plain data, so it saves and reloads with
   * the world like the rest of the arrangement.
   */
  readonly filters: DriverFilters;
  /**
   * Whether every following season of an era is arranged the same way.
   *
   * Era mode only — a standalone season has no next year to retain it for — and
   * it is the reader's answer rather than something derived, which is why it
   * rides along in here instead of being a fact about the run.
   */
  readonly retain: boolean;
}

/** Whether a value is one of the three rules — for a lineup read off a save file. */
export function isArrangementKind(value: unknown): value is ArrangementKind {
  return ARRANGEMENT_KINDS.some((kind) => kind === value);
}

/**
 * Whether a driver with no seat may be given one: **the pool filters, and only
 * them.**
 *
 * Deliberately not a rule of this file's own. The reader is already looking at
 * the list of drivers without a drive, already narrowed the way they want it,
 * with both counts printed at the top of it — so "include unemployed drivers"
 * can only sensibly mean *those* drivers. A separate eligibility rule here would
 * be the app quietly disagreeing with the panel next to it: widening the age
 * range to 45 would add three names to the list and none to the grid.
 *
 * That is why the filters travel *inside* the arrangement rather than being read
 * off the screen when a rule is re-run — see `GridArrangement.filters`. It also
 * makes the two rating modes fall out for free, since `defaultDriverFilters`
 * already opens the career filters off in `peak` mode (a grid of authored peaks
 * is out of time on purpose) and on in `aged` mode, and `matchesFilters` reads
 * the age band against `ratedAge`, which is the age the ratings on the row
 * describe in either mode.
 *
 * Nothing here *bars* anyone from a seat — a driver the filters hide can still
 * be put in a car by hand, one name at a time, which is what the rest of the
 * editor is for.
 */
function arrangeable(
  driver: Driver,
  seasonYear: number,
  filters: DriverFilters,
  mode: RatingMode,
): boolean {
  return matchesFilters(driver, seasonYear, filters, mode);
}

/** Everything the rearrangement reads besides the season and the grid on screen. */
export interface ArrangeOptions {
  /** Which ratings decide who is quickest, and which drivers are eligible. */
  readonly mode?: RatingMode;
  /**
   * The dice, for `random` and nothing else.
   *
   * Injected rather than drawn here, so a shuffled grid is reproducible from the
   * seed its season was run on — the same requirement every other roll in the
   * project is under.
   */
  readonly rng?: Rng;
  readonly pool?: readonly Driver[];
}

/** A seat, as a map key. */
function keyOf(ref: SeatRef): string {
  return `${ref.teamId}#${ref.seat}`;
}

/** How many cars a team has on the grid being edited. */
function seatCount(season: SeasonSeed, current: LineupDraft, teamId: string): number {
  const entry = season.entries.find((candidate) => candidate.teamId === teamId);
  return (current[teamId] ?? entry?.drivers ?? []).length;
}

/**
 * Every seat, in the order the rule fills them.
 *
 * Ranked by the car rather than by the seat: both of a team's cars are the same
 * machinery, so they sit together in the ranking and the best pairing on the
 * grid is the best *two* drivers. The engine is folded in through `carOverall`,
 * which means a team given somebody else's engine in the editor is ranked on the
 * car it will actually race.
 *
 * Which car is ahead is `compareByRating` — overall first, racing second — the
 * one rule the grid on screen is ordered by, so the car the reader can see at the
 * front is the car the rule fills first. Team id has the last word, so two cars
 * equal on both cannot trade places between two presses of the same button.
 */
function seatsToFill(
  season: SeasonSeed,
  current: LineupDraft,
  kind: ArrangementKind,
): readonly SeatRef[] {
  const ranked = season.entries
    .map((entry) => {
      const engine = engineSpecOf(season, entry.engineId);
      return {
        teamId: entry.teamId,
        overall: carOverall(entry.chassis, engine),
        racing: carRacing(entry.chassis, engine),
      };
    })
    .sort((a, b) => compareByRating(a, b) || a.teamId.localeCompare(b.teamId));
  if (kind === "fastest-in-slowest") {
    ranked.reverse();
  }
  return ranked.flatMap(({ teamId }) =>
    Array.from({ length: seatCount(season, current, teamId) }, (_, seat) => ({ teamId, seat })),
  );
}

/**
 * Who is in the running: whoever holds a seat on the grid being rearranged,
 * plus — if the reader asked — everyone eligible who holds none.
 *
 * The seated half comes from the grid on screen rather than from the season, so
 * this composes with the swaps already made: a driver the reader has already put
 * in the pool is in the pool, and pressing a rule twice means the same thing the
 * second time.
 */
function candidates(
  season: SeasonSeed,
  current: LineupDraft,
  arrangement: GridArrangement,
  byId: ReadonlyMap<string, Driver>,
  mode: RatingMode,
): readonly Driver[] {
  const seated: Driver[] = [];
  const held = new Set<string>();
  for (const entry of season.entries) {
    for (const driverId of current[entry.teamId] ?? entry.drivers) {
      if (driverId === null || held.has(driverId)) {
        continue;
      }
      held.add(driverId);
      const driver = byId.get(driverId);
      if (driver !== undefined) {
        seated.push(driver);
      }
    }
  }
  if (!arrangement.includeUnemployed) {
    return seated;
  }
  // The seated half is never filtered: they are on the grid, and a filter that
  // could empty a seat would make "include the pool" a way of *shrinking* the
  // field. Only the drivers being brought in are narrowed — which is exactly
  // what the panel beside the grid is showing.
  const free = [...byId.values()].filter(
    (driver) => !held.has(driver.id) && arrangeable(driver, season.year, arrangement.filters, mode),
  );
  return [...seated, ...free];
}

/**
 * Best first, and the same "best" the grid prints beside each name — the shared
 * `compareByRating`, so overall decides and racing settles it.
 *
 * Racing has to settle it, for the reason the sort switch on the grid gives:
 * ratings are integers on a 1-100 scale, so two drivers on 78 is ordinary, and
 * an overall is a rounded average of five of them. Name then id has the last
 * word, so a pairing cannot change between two identical presses.
 */
function byOverall(
  drivers: readonly Driver[],
  seasonYear: number,
  mode: RatingMode,
): readonly Driver[] {
  return drivers
    .map((driver) => {
      const ratings = driverRatingsFor(driver, seasonYear, mode);
      return { driver, overall: driverOverall(ratings), racing: ratings.racing };
    })
    .sort(
      (a, b) =>
        compareByRating(a, b) ||
        a.driver.name.localeCompare(b.driver.name) ||
        a.driver.id.localeCompare(b.driver.id),
    )
    .map((rated) => rated.driver);
}

/**
 * The grid one of the three rules produces.
 *
 * `current` is what is being rearranged — the draft on screen, an applied
 * lineup, or the authored one — and it supplies both the seat counts and, with
 * `includeUnemployed` off, the entire cast. The season supplies the cars.
 *
 * Returns a draft: usually a full one, since an applied grid seats exactly as
 * many drivers as it has seats, but a rule pressed over a grid that already had
 * a hole in it cannot invent somebody to fill it.
 *
 * @throws Error for `random` with no generator — a shuffle has to come from the
 * seeded stream, and silently falling back to an unshuffled grid would look like
 * the button doing nothing.
 */
export function arrangeLineup(
  season: SeasonSeed,
  current: LineupDraft,
  arrangement: GridArrangement,
  options: ArrangeOptions = {},
): LineupDraft {
  const { mode = "peak", rng, pool = driverPool } = options;
  if (arrangement.kind === "random" && rng === undefined) {
    throw new Error("A randomised grid needs a seeded generator to shuffle with");
  }
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  const seats = seatsToFill(season, current, arrangement.kind);
  const cast = candidates(season, current, arrangement, byId, mode);
  const ordered =
    arrangement.kind === "random" && rng !== undefined
      ? rng.shuffle(cast)
      : byOverall(cast, season.year, mode);

  const taken = new Map<string, string>();
  seats.forEach((seat, index) => {
    const driver = ordered[index];
    if (driver !== undefined) {
      taken.set(keyOf(seat), driver.id);
    }
  });

  const arranged: Record<string, readonly DraftSeat[]> = {};
  for (const entry of season.entries) {
    arranged[entry.teamId] = Array.from(
      { length: seatCount(season, current, entry.teamId) },
      (_, seat) => taken.get(keyOf({ teamId: entry.teamId, seat })) ?? null,
    );
  }
  return arranged;
}
