/**
 * One competitor's era, season by season.
 *
 * The third reading of the same finished worlds. The roll of honour says who
 * won each year and `lib/records.ts` says who won the era; this says what *one*
 * name did in every year of it — the panel behind a driver's or a team's name
 * on the champions screen.
 *
 * Derived on render like both of the others, off `championshipStandings` and
 * `constructorStandings`, because **results are the source of truth and
 * statistics are derived**. Nothing here is stored, and a run loaded from a
 * save adds up to exactly what it did before.
 *
 * Both lists are built in **one walk of the seasons** rather than per name on
 * demand: a panel is opened from a screen that already draws forty rows, and
 * re-tallying seventy-odd seasons per click would be forty-odd tallies of the
 * same worlds. `SeasonHistory.tsx` makes the walk once and hands it down.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { driverName } from "./names.js";
import { isComplete, type TalliedYear } from "./reveal.js";

/** What both panels write on a line: where they finished, and with what. */
export interface SeasonFigures {
  readonly year: number;
  /**
   * Place in that year's championship table, 1-based.
   *
   * The row's index in the table the engine already ordered — points, then
   * countback, then id — so first place here is the same first place the roll
   * of honour crowns, rather than a second derivation that could disagree with
   * it. Equal totals are therefore *separated* by countback rather than shared,
   * which is what a championship does and the opposite of what a record card's
   * `rankBy` does with the same figures.
   */
  readonly position: number;
  readonly points: number;
  readonly wins: number;
  readonly podiums: number;
  readonly poles: number;
  /**
   * How many rounds the place is after, on a year the reader is still partway
   * through; null on a finished one. A place mid-season is a place *so far*,
   * and "1st" alone would read as a title.
   */
  readonly afterRound: number | null;
}

/** One season of a driver's career: the above, plus who they drove for. */
export interface DriverSeason extends SeasonFigures {
  /**
   * The team of their most recent entry that year, straight off the standing —
   * "who they finished the season with" once a transfer market lets a driver
   * hold two seats in a year.
   */
  readonly teamId: string;
}

/** One driver of a team's season, as the team's panel lists them. */
export interface TeamDriverSeason {
  readonly driverId: string;
  /** Their place in the *drivers'* championship, not within the team. */
  readonly position: number;
  readonly points: number;
}

/**
 * One season of a team's history: its constructors' championship, and the
 * drivers who scored it.
 *
 * The lineup comes off the same drivers' table the panel above it is built
 * from, not off `world.field`: the field is who was *entered*, and a car that
 * never made a round is not part of what the team did that year. It arrives in
 * championship order for free, which is the order the line wants anyway.
 */
export interface TeamSeason extends SeasonFigures {
  readonly drivers: readonly TeamDriverSeason[];
}

/** Every career of a run, both lists, keyed by id. */
export interface SeasonHistories {
  readonly drivers: ReadonlyMap<string, readonly DriverSeason[]>;
  readonly teams: ReadonlyMap<string, readonly TeamSeason[]>;
}

/**
 * No run in scope — what a component rendered on its own gets.
 *
 * The same choice `EntryNames` and `Liveries` make with their empty defaults: a
 * name with no history behind it draws as plain text rather than as a control
 * that opens an empty panel.
 */
export const NO_HISTORIES: SeasonHistories = { drivers: new Map(), teams: new Map() };

function append<T>(lists: Map<string, T[]>, key: string, value: T): void {
  const list = lists.get(key);
  if (list === undefined) {
    lists.set(key, [value]);
  } else {
    list.push(value);
  }
}

/**
 * Every season of every career in a run, earliest first.
 *
 * The seasons are walked in **year order** rather than the order they arrive,
 * so a panel reads down the years however a run was assembled — the same reason
 * `tallyCareers` sorts.
 */
export function seasonHistories(seasons: readonly TalliedYear[]): SeasonHistories {
  const drivers = new Map<string, DriverSeason[]>();
  const teams = new Map<string, TeamSeason[]>();

  for (const world of [...seasons].sort((a, b) => a.year - b.year)) {
    const lineups = new Map<string, TeamDriverSeason[]>();
    const afterRound = isComplete(world) ? null : world.season.races.length;
    championshipStandings(world.season, world.points).forEach((standing, index) => {
      const position = index + 1;
      append(drivers, standing.driverId, {
        year: world.year,
        teamId: standing.teamId,
        position,
        points: standing.points,
        wins: standing.wins,
        podiums: standing.podiums,
        poles: standing.poles,
        afterRound,
      });
      append(lineups, standing.teamId, {
        driverId: standing.driverId,
        position,
        points: standing.points,
      });
    });

    constructorStandings(world.season, world.points).forEach((standing, index) => {
      append(teams, standing.teamId, {
        year: world.year,
        position: index + 1,
        points: standing.points,
        wins: standing.wins,
        podiums: standing.podiums,
        poles: standing.poles,
        afterRound,
        drivers: lineups.get(standing.teamId) ?? [],
      });
    });
  }

  return { drivers, teams };
}

/** A championship place as it is read out: "1st", "2nd", "11th", "23rd". */
export function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) {
    return `${position}th`;
  }
  return `${position}${["th", "st", "nd", "rd"][position % 10] ?? "th"}`;
}

/**
 * Where a season ended, as read out: "1st", or "1st after round 5" on a year
 * still being written — a lead, not a title.
 */
export function placeLabel(figures: SeasonFigures): string {
  return figures.afterRound === null
    ? ordinal(figures.position)
    : `${ordinal(figures.position)} after round ${figures.afterRound}`;
}

/** Whether the season was won outright: first, and finished. */
export function isTitle(figures: SeasonFigures): boolean {
  return figures.afterRound === null && figures.position === 1;
}

/** "1 win", "4 wins" — a figure nobody has to read past a wrong plural. */
export function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/**
 * A season's figures as one line: points always, the rest only when they
 * happened.
 *
 * A career panel is mostly ordinary seasons, and "12 pts · 0 wins · 0 podiums ·
 * 0 poles" repeated forty times buries the four lines the panel was opened for.
 * A zero is not a record — the same rule the record cards apply when they leave
 * a career off a card altogether.
 */
export function figuresLine(figures: SeasonFigures): string {
  const parts = [`${figures.points} pts`];
  if (figures.wins > 0) {
    parts.push(count(figures.wins, "win", "wins"));
  }
  if (figures.podiums > 0) {
    parts.push(count(figures.podiums, "podium", "podiums"));
  }
  if (figures.poles > 0) {
    parts.push(count(figures.poles, "pole", "poles"));
  }
  return parts.join(" · ");
}

/** One driver on a team's line: what it says, and whether it is the champion. */
export interface LineupEntry {
  readonly label: string;
  /** Won the drivers' championship that year, and takes the accent for it. */
  readonly champion: boolean;
}

/**
 * Who drove for a team that year, in championship order — empty for a season
 * whose entries never made a round.
 *
 * Each name carries where *they* finished, which is the answer to the question
 * the line raises: a team third in the constructors' says nothing about whether
 * one car scored all of it. Parts rather than one string, because a drivers'
 * champion is marked in the panel exactly as the team's own titles are, and an
 * accent cannot be applied to the middle of a sentence the component was handed
 * pre-joined.
 */
export function lineupOf(season: TeamSeason): readonly LineupEntry[] {
  return season.drivers.map((driver) => ({
    label: `${driverName(driver.driverId)} ${ordinal(driver.position)}`,
    champion: season.afterRound === null && driver.position === 1,
  }));
}
