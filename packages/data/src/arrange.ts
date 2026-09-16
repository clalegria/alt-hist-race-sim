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
 * - the **drivers**, ranked by the same overall the grid prints, best first — or
 *   shuffled, for `random`.
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
import { carOverall, driverOverall } from "./rating.js";
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
  /** Whether drivers without a seat may take one. See `arrangeable`. */
  readonly includeUnemployed: boolean;
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
 * Whether a driver with no seat may be given one.
 *
 * The same judgement `defaultDriverFilters` makes in the web app, and made here
 * for the same reason `CARRY_OVER_AGES` lives in `carryOver.ts`: a bulk
 * operation needs one documented rule of its own rather than whatever the pool
 * list happens to be narrowed to, or an era that re-applies it every year would
 * depend on a panel nobody was looking at.
 *
 * In **`aged`** mode it is the drivers whose real careers covered the season.
 * They are the only ones the mode has anything to say about anyway — the ageing
 * curve clamps a driver evaluated thirty years before their debut to the bottom
 * of the scale — and without the rule a randomised grid would be twenty-eight
 * names nobody has heard of, rated 1.
 *
 * In **`peak`** mode it is everybody. A grid built from authored peaks is
 * already out of time, and the field of all-time greats is the thing that mode
 * exists for; enforcing a chronology it has set aside would be the app arguing
 * with itself.
 *
 * Nothing here *bars* anyone from a seat — a driver this leaves out can still be
 * put in a car by hand, one name at a time, which is what the rest of the editor
 * is for.
 */
export function arrangeable(driver: Driver, seasonYear: number, mode: RatingMode): boolean {
  return mode === "peak" || (driver.debutSeason <= seasonYear && driver.finalSeason >= seasonYear);
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
 * Team id breaks a tie, so two cars on the same overall cannot trade places
 * between two presses of the same button.
 */
function seatsToFill(
  season: SeasonSeed,
  current: LineupDraft,
  kind: ArrangementKind,
): readonly SeatRef[] {
  const ranked = season.entries
    .map((entry) => ({
      teamId: entry.teamId,
      overall: carOverall(entry.chassis, engineSpecOf(season, entry.engineId)),
    }))
    .sort((a, b) => b.overall - a.overall || a.teamId.localeCompare(b.teamId));
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
  includeUnemployed: boolean,
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
  if (!includeUnemployed) {
    return seated;
  }
  const free = [...byId.values()].filter(
    (driver) => !held.has(driver.id) && arrangeable(driver, season.year, mode),
  );
  return [...seated, ...free];
}

/**
 * Best first, and the same "best" the grid prints beside each name.
 *
 * Name then id breaks a tie, for the reason the sort switch on the grid does it:
 * ratings are integers on a 1-100 scale, so two drivers on 78 is ordinary, and a
 * pairing that changed between two identical presses would be inexplicable.
 */
function byOverall(
  drivers: readonly Driver[],
  seasonYear: number,
  mode: RatingMode,
): readonly Driver[] {
  return drivers
    .map((driver) => ({
      driver,
      overall: driverOverall(driverRatingsFor(driver, seasonYear, mode)),
    }))
    .sort(
      (a, b) =>
        b.overall - a.overall ||
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
  const cast = candidates(season, current, arrangement.includeUnemployed, byId, mode);
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
