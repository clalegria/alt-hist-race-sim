/**
 * What an era looks like once its seasons are behind it.
 *
 * A run holds finished worlds, not a table of winners — **results are the
 * source of truth and statistics are derived** — so who won a year is a
 * `championshipStandings` call over a season that is already in hand. This
 * module is that call, made once per season and handed to the roll-up screen,
 * rather than a component deriving two championships per row inline.
 *
 * The season itself travels with each row, for two reasons: a team is named as
 * the entry it was that year — "Williams-Ford" comes off the grid as it raced,
 * not off the seed files — and a row opens out into that year's full
 * championship tables, which are another derivation over the same results.
 */

import type { ConstructorStanding, DriverStanding } from "@alt-hist/engine";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import type { World } from "../store/season.js";

/** One finished year of an era, as the roll-up reads it. */
export interface SeasonChampions {
  /** `world.year`, hoisted: it is what identifies the row. */
  readonly year: number;
  /** Null only if nobody scored at all, which a real season never does. */
  readonly driver: DriverStanding | null;
  readonly team: ConstructorStanding | null;
  /**
   * Which title of the run this is for each champion, counting this one: 1 for
   * a first. A team's counts by lineage, as its career record does. 0 where
   * nobody was crowned.
   */
  readonly driverTitle: number;
  readonly teamTitle: number;
  /** The season as it was raced — the grid, the results and the scale. */
  readonly world: World;
}

/** Adds one title to `id`'s tally and returns the new total. */
function crown(tally: Map<string, number>, id: string | undefined): number {
  if (id === undefined) {
    return 0;
  }
  const titles = (tally.get(id) ?? 0) + 1;
  tally.set(id, titles);
  return titles;
}

/**
 * Every crowned season of a run, in the order they were raced, each numbering
 * its champions' titles so far — so a career reads as it builds, row by row.
 */
export function eraChampions(seasons: readonly World[]): readonly SeasonChampions[] {
  const drivers = new Map<string, number>();
  const teams = new Map<string, number>();
  return seasons.map((world) => {
    const driver = championshipStandings(world.season, world.points)[0] ?? null;
    const team = constructorStandings(world.season, world.points)[0] ?? null;
    return {
      year: world.year,
      driver,
      team,
      driverTitle: crown(drivers, driver?.driverId),
      teamTitle: crown(teams, team?.teamId),
      world,
    };
  });
}

/**
 * The years an era covers, as a phrase — "1980", "1980–1984".
 *
 * Off the seasons actually run rather than off the starting year and a count,
 * so it stays right whatever a later mode does with the loop.
 */
export function eraSpan(seasons: readonly SeasonChampions[]): string {
  const first = seasons[0]?.year;
  const last = seasons.at(-1)?.year;
  if (first === undefined || last === undefined) {
    return "";
  }
  return first === last ? `${first}` : `${first}–${last}`;
}
