/**
 * What an era adds up to, one competitor at a time.
 *
 * The roll of honour says who won each year; this says who won the *era*. Same
 * data, read down the other axis — **results are the source of truth and
 * statistics are derived**, so a career total is a walk of the seasons already
 * in hand rather than a counter kept as the run goes. Nothing here is stored,
 * and a run loaded from a save file adds up to exactly what it did before.
 *
 * Drivers and teams are the same tally keyed differently, exactly as the two
 * championship tables are in the engine, so the two lists cannot drift apart.
 * The one thing that differs is that a team's **name is an era**: the lineage
 * that won as Tyrrell also won as BAR, as Brawn and as Mercedes, and a total
 * that hid that would be a record book with the interesting part left out. So a
 * career carries its **spells** as well as its figures — and, because two
 * lineages can hold one name, what a card *calls* a row is a question with its
 * own answer here rather than a `teamName` call at the point of drawing.
 */

import type { ConstructorStanding, DriverStanding } from "@alt-hist/engine";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { driverName, teamName } from "./names.js";
import { isComplete, type TalliedYear } from "./reveal.js";

/** The figures a career and each of its spells both accumulate. */
interface RecordTotals {
  /** Seasons they finished top of the table. */
  readonly titles: number;
  readonly wins: number;
  readonly podiums: number;
  readonly poles: number;
  readonly points: number;
  /** Seasons they appear in at all, entered or merely attempted. */
  readonly seasons: number;
}

/** One unbroken stretch of seasons, for a name that was used more than once. */
export interface YearRange {
  readonly from: number;
  readonly to: number;
}

/**
 * Everything a career did under one name.
 *
 * **One spell per name, not per stretch.** `march` raced as March, then as
 * Leyton House, then as March again, and the two Marches are one record: a name
 * taken back is the same name, and splitting the row would put the same team
 * twice in the same card for a reason nobody reading a record book cares about.
 * The interruption is not lost — `segments` keeps the stretches, so the row can
 * still say "1970–1989, 1992–1996" rather than claiming years the team spent
 * called something else.
 */
export interface CareerSpell extends RecordTotals {
  readonly name: string;
  /** The first and last season *of the run* raced under this name. */
  readonly firstYear: number;
  readonly lastYear: number;
  /** The stretches it covers, earliest first. One, unless the name came back. */
  readonly segments: readonly YearRange[];
  /**
   * The last season each figure was actually *scored* in under this name, or
   * null for one it never scored.
   *
   * Which is not the same as the last season under the name, and that gap is
   * visible on screen: `toleman` raced as Renault from 2002 to 2011 and again
   * from 2016 to 2020, and won its championship in the middle of the first
   * stretch. Drawn as of 2020 the row wears the yellow-and-black of a team that
   * won nothing, and the colours of a record are the colours it was won in.
   */
  readonly scored: ScoredYears;
}

/** The last season a figure was scored in, one per metric. */
export type ScoredYears = { readonly [M in RecordMetric]: number | null };

/** One competitor's whole era. Never stored — see the module note. */
export interface CareerRecord extends RecordTotals {
  /** A driver id or a team id, depending on which list this is. */
  readonly id: string;
  /**
   * The last year of the run they appear in.
   *
   * A team's name and livery are eras, so a career row spanning 1980 to 1994
   * has to be labelled as of *some* year, and the last one it raced is the one
   * a reader has most recently seen it under.
   */
  readonly lastYear: number;
  /**
   * Every name they raced under — **one spell each**, in the order the names
   * first appeared. A driver's list is always one spell, since people are not
   * renamed, which is what lets a card treat both lists identically and still
   * only ever open a team out.
   */
  readonly spells: readonly CareerSpell[];
}

/** The four things a record card can be ordered on. */
export type RecordMetric = "titles" | "wins" | "podiums" | "poles";

/** One row of a record card: the career, the figure, and where it places. */
export interface RankedRecord {
  readonly record: CareerRecord;
  readonly value: number;
  /**
   * 1-based, and **shared by equal figures** — the second of two on five wins
   * is second, and whoever comes next is fourth.
   */
  readonly position: number;
  /** Whether somebody else holds this position too, so the row can say "=2". */
  readonly shared: boolean;
}

/** Both lists of an era, each unordered — `rankBy` decides what a card shows. */
export interface CareerRecords {
  readonly drivers: readonly CareerRecord[];
  readonly teams: readonly CareerRecord[];
}

/** Mutable accumulators; the exported shapes are readonly. */
interface MutableTotals {
  titles: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  seasons: number;
}

interface MutableSpell extends MutableTotals {
  name: string;
  firstYear: number;
  lastYear: number;
  segments: { from: number; to: number }[];
  scored: { -readonly [M in RecordMetric]: number | null };
}

interface Tally extends MutableTotals {
  id: string;
  lastYear: number;
  spells: MutableSpell[];
  /** The name of last season's spell, which is what a segment continues. */
  current: string | null;
}

function zeroed(): MutableTotals {
  return { titles: 0, wins: 0, podiums: 0, poles: 0, points: 0, seasons: 0 };
}

/** One season's table row, reduced to what a career total needs from it. */
interface SeasonRow {
  readonly id: string;
  readonly points: number;
  readonly wins: number;
  readonly podiums: number;
  readonly poles: number;
}

/**
 * Notes the season against every figure it actually moved.
 *
 * Walked in year order, so the last assignment wins and each metric ends up
 * holding the most recent season it was scored in. A figure of nothing is not a
 * record and must not move the year — that is the whole point of it.
 */
function markScored(
  scored: { -readonly [M in RecordMetric]: number | null },
  row: SeasonRow,
  champion: boolean,
  year: number,
): void {
  if (champion) {
    scored.titles = year;
  }
  if (row.wins > 0) {
    scored.wins = year;
  }
  if (row.podiums > 0) {
    scored.podiums = year;
  }
  if (row.poles > 0) {
    scored.poles = year;
  }
}

/** Adds one season into a tally or into a spell — the same six figures. */
function add(totals: MutableTotals, row: SeasonRow, champion: boolean): void {
  totals.titles += champion ? 1 : 0;
  totals.wins += row.wins;
  totals.podiums += row.podiums;
  totals.poles += row.poles;
  totals.points += row.points;
  totals.seasons += 1;
}

/**
 * Adds the seasons up, one table at a time.
 *
 * **The champion is the first row**, which is the same thing `lib/era.ts` reads
 * off the same call — the engine orders both tables by points and then by
 * countback, so first place is a fact about the table rather than a second
 * derivation that could disagree with the roll of honour.
 *
 * The seasons are walked in **year order** rather than in the order they
 * arrive, because a spell's segments are run-length stretches over that
 * sequence: a run handed over backwards would report a lineage as having
 * started under its last name, and its years as one gapless span.
 */
function tallyCareers(
  seasons: readonly TalliedYear[],
  rowsOf: (world: TalliedYear) => readonly SeasonRow[],
  nameOf: (id: string, year: number) => string,
): readonly CareerRecord[] {
  const tallies = new Map<string, Tally>();
  for (const world of [...seasons].sort((a, b) => a.year - b.year)) {
    // A year still being written has a leader, not a champion.
    const complete = isComplete(world);
    rowsOf(world).forEach((row, index) => {
      const champion = complete && index === 0;
      let tally = tallies.get(row.id);
      if (tally === undefined) {
        tally = { id: row.id, lastYear: world.year, spells: [], current: null, ...zeroed() };
        tallies.set(row.id, tally);
      }
      add(tally, row, champion);
      tally.lastYear = world.year;

      const name = nameOf(row.id, world.year);
      let spell = tally.spells.find((each) => each.name === name);
      if (spell === undefined) {
        spell = {
          name,
          firstYear: world.year,
          lastYear: world.year,
          segments: [],
          scored: { titles: null, wins: null, podiums: null, poles: null },
          ...zeroed(),
        };
        tally.spells.push(spell);
      }
      spell.lastYear = world.year;
      // A stretch continues only while the name does; anything else — a rename
      // and a rename back — starts another one under the same spell.
      const stretch = spell.segments.at(-1);
      if (stretch === undefined || tally.current !== name) {
        spell.segments.push({ from: world.year, to: world.year });
      } else {
        stretch.to = world.year;
      }
      tally.current = name;
      add(spell, row, champion);
      markScored(spell.scored, row, champion, world.year);
    });
  }
  return [...tallies.values()];
}

function driverRow(standing: DriverStanding): SeasonRow {
  return {
    id: standing.driverId,
    points: standing.points,
    wins: standing.wins,
    podiums: standing.podiums,
    poles: standing.poles,
  };
}

function teamRow(standing: ConstructorStanding): SeasonRow {
  return {
    id: standing.teamId,
    points: standing.points,
    wins: standing.wins,
    podiums: standing.podiums,
    poles: standing.poles,
  };
}

/**
 * Every career of a run, both lists, derived from its seasons — whole worlds,
 * or years cut at the cursor, the last of which may still be in progress and
 * then crowns nobody.
 *
 * `teamNameOf` names a team's row in a year, which is what splits a lineage
 * into spells: as history had it by default, or the run's kept names, under
 * which a team has one name and so one spell.
 */
export function careerRecords(
  seasons: readonly TalliedYear[],
  teamNameOf: (id: string, year: number) => string = teamName,
): CareerRecords {
  return {
    drivers: tallyCareers(
      seasons,
      (world) => championshipStandings(world.season, world.points).map(driverRow),
      (id) => driverName(id),
    ),
    teams: tallyCareers(
      seasons,
      (world) => constructorStandings(world.season, world.points).map(teamRow),
      teamNameOf,
    ),
  };
}

/**
 * The order the other three figures break a tie in, after the one being ranked.
 *
 * A record card is a leaderboard, so two careers level on its own figure are
 * separated by the rest of the cabinet — titles first, then wins, podiums,
 * poles, and points last. They still *share* a position: the tie-break decides
 * which row is printed first, not who is ahead.
 */
const TIE_BREAK: readonly RecordMetric[] = ["titles", "wins", "podiums", "poles"];

/**
 * One record card's rows: everyone with at least one, best first.
 *
 * **A zero is left out rather than listed**, which is the difference between a
 * record book and a championship table — nobody wants the 34 drivers who never
 * took a pole under the ones who did, and an era long enough to be worth
 * reading has hundreds of them.
 *
 * The order is total, ending on the id, so a card never depends on the sort
 * implementation or on the order the seasons happened to be walked in.
 */
export function rankBy(
  records: readonly CareerRecord[],
  metric: RecordMetric,
): readonly RankedRecord[] {
  const ordered = records
    .filter((record) => record[metric] > 0)
    .sort((a, b) => {
      for (const key of [metric, ...TIE_BREAK]) {
        const difference = b[key] - a[key];
        if (difference !== 0) {
          return difference;
        }
      }
      return b.points - a.points || (a.id < b.id ? -1 : 1);
    });

  const counts = new Map<number, number>();
  for (const record of ordered) {
    counts.set(record[metric], (counts.get(record[metric]) ?? 0) + 1);
  }

  let position = 0;
  let previous: number | null = null;
  return ordered.map((record, index) => {
    const value = record[metric];
    if (value !== previous) {
      position = index + 1;
      previous = value;
    }
    return { record, value, position, shared: (counts.get(value) ?? 0) > 1 };
  });
}

/**
 * How one career's figure breaks down by the names it was won under, biggest
 * first — the rows behind "Mercedes, 100 wins".
 *
 * **Spells that contributed nothing are left out**, for the reason a career
 * with none of the thing counted is: a line reading "as BAR, 0" is not a
 * record. What is left therefore still adds up to the total on the row above
 * it, and a lineage that won everything under one name comes back as a single
 * spell — which is how a card knows there is nothing to expand.
 */
export function spellsBy(record: CareerRecord, metric: RecordMetric): readonly CareerSpell[] {
  return record.spells
    .filter((spell) => spell[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || b.lastYear - a.lastYear);
}

/** One stretch of years — "1980", or "1980–1994". */
function rangeSpan(range: YearRange): string {
  return range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`;
}

/**
 * A spell's years, as the breakdown writes them — "1970–1989, 1992–1996".
 *
 * Every stretch, because a name that came back left a gap under another name
 * and a single span across it would be a claim about years that belong to a
 * different row of the same expansion.
 */
export function spellSpan(spell: CareerSpell): string {
  return spell.segments.map(rangeSpan).join(", ");
}

/**
 * The same years, end to end — "1970–1996".
 *
 * What a *row* is labelled with, where the point is to tell two teams of the
 * same name apart rather than to be exact about the middle of one career.
 */
export function spellRange(spell: CareerSpell): string {
  return rangeSpan({ from: spell.firstYear, to: spell.lastYear });
}

/** The order a lineage's spells are ranked in to find its most successful name. */
const SUCCESS: readonly RecordMetric[] = ["titles", "wins", "podiums", "poles"];

/**
 * The name a lineage is *known* by on every card: its most successful one.
 *
 * Titles first, then wins, podiums and poles, and on a full tie the more recent
 * name. **One answer per lineage, not one per card**: a row reading "Renault" on
 * the championships card and "Benetton" on the wins card is the same team
 * twice under two names, which reads as two teams. Null for a career with no
 * spells, which `careerRecords` never makes.
 */
export function bestSpell(record: CareerRecord): CareerSpell | null {
  const ordered = [...record.spells].sort((a, b) => {
    for (const metric of SUCCESS) {
      const difference = b[metric] - a[metric];
      if (difference !== 0) {
        return difference;
      }
    }
    return b.lastYear - a.lastYear;
  });
  return ordered[0] ?? null;
}

/**
 * The season a spell is drawn as of: the last one it scored the figure that
 * made it the best — its last title, else its last win, and so on — or the
 * spell's own end where it scored nothing.
 *
 * The colours of a record are the colours it was won in. `toleman` raced as
 * Renault until 2020 and took its titles in the middle of that, and drawn as of
 * 2020 the row wears a livery that never won anything. The year stays inside
 * the spell, so the name it resolves to is the same either way.
 */
function drawnAsOf(spell: CareerSpell): number {
  for (const metric of SUCCESS) {
    const year = spell.scored[metric];
    if (year !== null) {
      return year;
    }
  }
  return spell.lastYear;
}

/**
 * The names more than one career of the list raced under.
 *
 * Asked of the **run**, not of the database: a Mercedes is only ambiguous if the
 * reader has met two of them. The list is every team that raced, scorers or
 * not, so the other Mercedes never having won anything still counts — it was
 * on the grid under that name. And it is named by the run's own rule, so under
 * kept names each lineage has one name and collisions are rarer.
 */
export function sharedNames(records: readonly CareerRecord[]): ReadonlySet<string> {
  const holders = new Map<string, Set<string>>();
  for (const record of records) {
    for (const spell of record.spells) {
      holders.set(spell.name, (holders.get(spell.name) ?? new Set<string>()).add(record.id));
    }
  }
  return new Set([...holders].filter(([, ids]) => ids.size > 1).map(([name]) => name));
}

/** How the cards label one lineage: the name, and the years if it needs them. */
export interface RecordLabel {
  readonly name: string;
  /**
   * The years, or null when the name alone is unambiguous. Only the rows that
   * need it carry it: a card is a list of names, and years on every one of them
   * is noise around the collisions that matter.
   */
  readonly span: string | null;
  /** The season the row is drawn as of, which resolves the name and the livery. */
  readonly year: number;
}

/**
 * What each lineage is called on every card, keyed by career id.
 *
 * Takes the **whole list**, not one card's rows, for both halves of the
 * answer: the label is a fact about the lineage, so the four cards agree, and
 * whether a name needs its years depends on who else in the run held it, on a
 * card or not.
 *
 * Nothing here reads the seed data itself — `nameOf` comes in — so the rule is
 * testable against invented names.
 */
export function labelsFor(
  records: readonly CareerRecord[],
  nameOf: (id: string, year: number) => string,
): ReadonlyMap<string, RecordLabel> {
  const shared = sharedNames(records);
  return new Map(
    records.map((record) => {
      const best = bestSpell(record);
      const name = best?.name ?? nameOf(record.id, record.lastYear);
      return [
        record.id,
        {
          name,
          span: best === null || !shared.has(name) ? null : spellRange(best),
          year: best === null ? record.lastYear : drawnAsOf(best),
        },
      ];
    }),
  );
}
