/**
 * *Keep the first season's teams* — a year's entry list when every
 * year of an era has the teams its first year had.
 *
 * Each team of the first year enters every year, with as many cars as it had
 * then. A team history still has that year races its real car with its real
 * drivers; a team history has dropped is a **ghost entry**, racing its last
 * real car. Teams new in history never appear, and their drivers are free.
 * What is left is seats with nobody in them — a ghost's, and a **short seat**
 * where history ran fewer cars than the first year — and the run's
 * `EmptySeatRules` say who takes them.
 *
 * Two steps, because the drivers are ranked on the cars the run *races*, and
 * *Chassis performance* rolls those cars in between:
 *
 * 1. `keptYear` — the cars, history's drivers, and last year's drivers carried
 *    back into the seats history left empty;
 * 2. `fillSeats` — whatever is still empty, best car first, from the strongest
 *    free drivers.
 *
 * `seatedSeason` then makes the season that is raced. No dice anywhere: who
 * fills a seat is the ranking rule's answer, so the same inputs give the same
 * grid.
 */

import { byOverall, teamsByCar } from "./arrange.js";
import type { RatingMode } from "./buildField.js";
import { strongestOf } from "./carryOver.js";
import { latestEngineSpec } from "./engines.js";
import { drivers as driverPool } from "./index.js";
import { applyDraft, type DraftSeat, type LineupDraft, seatedDriverIds } from "./lineup.js";
import { matchesFilters, type SigningPool, signingFilters } from "./people.js";
import { seasons } from "./seasons/index.js";
import type { Driver, SeasonEntry, SeasonSeed } from "./types.js";

/**
 * Who takes an empty seat: last year's driver, then the strongest free one
 * (`last`); or the strongest free one, picked fresh every year (`best`).
 */
export const SEAT_FILLS = ["last", "best"] as const;
export type SeatFill = (typeof SEAT_FILLS)[number];

/**
 * Who takes an empty seat: the fill, and the run's signing pool. The pool's
 * ages are read against a driver's real age in the season: last year's driver
 * past `maxAge` leaves the seat — their retirement from it — and nobody outside
 * the band is signed for one. A driver placed by hand is never barred.
 */
export interface EmptySeatRules extends SigningPool {
  readonly fill: SeatFill;
}

/** A year as *Keep the first season's teams* enters it, before its empty seats are filled. */
export interface KeptYear {
  /**
   * The season's calendar, points and factors, with the first year's teams on
   * this year's cars. Each entry's `drivers` are its filled seats only. Its
   * engines are the year's, plus any a ghost's car needs that the year does
   * not rate.
   */
  readonly season: SeasonSeed;
  /** Every seat, an empty one `null`; each team has its first-year seat count. */
  readonly seats: LineupDraft;
  /** The ghost entries: team id to the season whose car it races. */
  readonly ghosts: Readonly<Record<string, number>>;
}

/** Everything the kept grid reads besides the seasons and the rules. */
export interface KeptGridOptions {
  readonly pool?: readonly Driver[];
  /** The ratings drivers are ranked on: `aged`, as an era always runs. */
  readonly mode?: RatingMode;
  /** The authored season for a year, or undefined. Defaults to the seed data. */
  readonly history?: (year: number) => SeasonSeed | undefined;
}

/**
 * A ghost's last real entry: the latest season before `year` that has the team.
 * The run's first year has every kept team, so the search always ends.
 */
function lastEntry(
  teamId: string,
  year: number,
  start: SeasonSeed,
  history: (year: number) => SeasonSeed | undefined,
): { readonly season: SeasonSeed; readonly entry: SeasonEntry } {
  for (let before = year - 1; before >= start.year; before--) {
    const season = before === start.year ? start : history(before);
    const entry = season?.entries.find((candidate) => candidate.teamId === teamId);
    if (season !== undefined && entry !== undefined) {
      return { season, entry };
    }
  }
  throw new Error(`Team "${teamId}" has no entry from ${start.year} to ${year - 1}`);
}

/**
 * Year N with the first year's teams: their cars, history's drivers, and —
 * unless the rule is `best` — last year's drivers back in the seats history
 * left empty.
 *
 * - **A team history has this year** takes its car and its authored drivers.
 *   Given more cars than the first year, the weakest drop out
 *   (`strongestOf`).
 * - **A ghost entry** races its last real car — chassis, engine and paint, but
 *   no `developmentTrend`, which describes that one year. Its engine has this
 *   year's values if the year rates it; if not, its latest authored values are
 *   added to the year's engines.
 * - **Last year's driver keeps an empty seat** at the team they drove for last
 *   year *in this run*, unless history has seated them elsewhere this year —
 *   history always wins — or they are outside the age band. More of them than
 *   seats, and the strongest stay. A driver history moved to a team with no
 *   room for them is a leftover, and can return to last year's seat.
 *
 * `previous` is the grid last year raced, by team.
 */
export function keptYear(
  start: SeasonSeed,
  season: SeasonSeed,
  previous: LineupDraft,
  rules: EmptySeatRules,
  options: KeptGridOptions = {},
): KeptYear {
  const {
    pool = driverPool,
    mode = "aged",
    history = (year: number) => seasons.get(year),
  } = options;
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  const real = new Map(season.entries.map((entry) => [entry.teamId, entry]));

  const engines = [...season.engines];
  const entries: SeasonEntry[] = [];
  const seats: Record<string, readonly string[]> = {};
  const ghosts: Record<string, number> = {};
  for (const first of start.entries) {
    const { teamId } = first;
    const now = real.get(teamId);
    if (now !== undefined) {
      entries.push(now);
      seats[teamId] = strongestOf(now.drivers, first.drivers.length, byId, season.year, mode);
      continue;
    }
    const last = lastEntry(teamId, season.year, start, history);
    const { developmentTrend: _trend, ...car } = last.entry;
    if (!engines.some((engine) => engine.engineId === car.engineId)) {
      // The ghost raced it in `last`, which rates it, so the search always ends.
      const spec = latestEngineSpec(car.engineId, season.year, last.season.year, (year) =>
        year === last.season.year ? last.season : history(year),
      );
      if (spec === undefined) {
        throw new Error(
          `Engine "${car.engineId}" has no ratings from ${last.season.year} to ${season.year}`,
        );
      }
      engines.push(spec);
    }
    entries.push({ ...car, drivers: [] });
    seats[teamId] = [];
    ghosts[teamId] = last.season.year;
  }

  const seated = new Set(Object.values(seats).flat());
  const band = signingFilters({ ...rules, activeOnly: false });
  const draft: Record<string, readonly DraftSeat[]> = {};
  for (const first of start.entries) {
    const { teamId } = first;
    const count = first.drivers.length;
    const held = seats[teamId] ?? [];
    // Nobody held two seats last year, so no driver can be carried twice.
    const carried =
      rules.fill === "best"
        ? []
        : strongestOf(
            (previous[teamId] ?? []).filter((driverId): driverId is string => {
              const driver = driverId === null ? undefined : byId.get(driverId);
              return (
                driver !== undefined &&
                !seated.has(driver.id) &&
                matchesFilters(driver, season.year, band, "aged")
              );
            }),
            count - held.length,
            byId,
            season.year,
            mode,
          );
    const filling = [...held, ...carried];
    draft[teamId] = Array.from({ length: count }, (_, seat) => filling[seat] ?? null);
  }

  return { season: applyDraft({ ...season, engines, entries }, draft), seats: draft, ghosts };
}

/**
 * The empty seats signed from the signing pool.
 *
 * Best car first (`teamsByCar` over `season`, the cars the run races), each
 * seat takes the strongest driver who holds none, inside the age band and —
 * under `activeOnly` — whose real career spans the season. A seat nobody
 * qualifies for stays `null`; `seatedSeason` drops it.
 */
export function fillSeats(
  season: SeasonSeed,
  seats: LineupDraft,
  signing: SigningPool,
  options: KeptGridOptions = {},
): LineupDraft {
  const { pool = driverPool, mode = "aged" } = options;
  const seated = new Set(seatedDriverIds(seats));
  const filters = signingFilters(signing);
  const free = byOverall(
    pool.filter(
      (driver) => !seated.has(driver.id) && matchesFilters(driver, season.year, filters, "aged"),
    ),
    season.year,
    mode,
  );

  let next = 0;
  const filled: Record<string, readonly DraftSeat[]> = { ...seats };
  for (const teamId of teamsByCar(season)) {
    const row = seats[teamId];
    if (row?.includes(null)) {
      filled[teamId] = row.map((seat) => seat ?? free[next++]?.id ?? null);
    }
  }
  return filled;
}

/**
 * The season that is raced: every filled seat entered, every empty one left
 * out, and a team with no driver at all sitting the year out.
 */
export function seatedSeason(season: SeasonSeed, seats: LineupDraft): SeasonSeed {
  const seated = applyDraft(season, seats);
  return { ...seated, entries: seated.entries.filter((entry) => entry.drivers.length > 0) };
}
