/**
 * What each share card shows, before anything is drawn.
 *
 * Four cards, two per mode: an era's champion of champions and its last
 * champions, a season's world champion and its final standings. Each is a pure
 * function of finished worlds, so the rules — who heads a list, how ties fall,
 * what is cut — are tested here and the card components only lay them out.
 *
 * **Ids and years, never names or colours.** A team is named and painted as it
 * was in a given year, read through the run's kept-names and kept-liveries
 * settings, and those reach a component by context (`EntryNames`, `Liveries`).
 * So every team here travels with the year it is drawn for, and the card
 * resolves the rest exactly as every other screen does.
 *
 * The worlds passed in are finished seasons: Share is offered only once the
 * cursor reaches a season's end, so nothing here handles a year half raced.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import type { World } from "../store/season.js";
import { eraChampions, eraSpan } from "./era.js";
import { count } from "./format.js";
import { driverName, nameParts } from "./names.js";
import type { TalliedYear } from "./reveal.js";
import { seasonSeed } from "./seasons.js";

/** Where every card's footer sends a reader, until *publish it* picks the host. */
export const SHARE_ADDRESS = "race-sim.clalegria.dev";

/** The rows the other champions and the last champions run to. */
export const OTHER_CHAMPIONS_SHOWN = 10;
export const LAST_CHAMPIONS_SHOWN = 20;
/** The final standings list everyone who scored, up to this many. */
export const STANDINGS_SHOWN = 20;
/** The Constructors' line at a panel's foot. */
export const CONSTRUCTORS_SHOWN = 3;
/** From this many rounds the race winners take 12 columns, not 8, so a calendar stays two rows. */
export const WIDE_ROUNDS_FROM = 17;

/** How many columns a season's race winners are laid out in. */
export function winnerColumns(rounds: number): number {
  return rounds >= WIDE_ROUNDS_FROM ? 12 : 8;
}

/** A team as drawn in one year: its name, badge, livery and car that season. */
export interface TeamYear {
  readonly teamId: string;
  readonly year: number;
}

/** One title, as a season mark: two digits over a bar in that year's team colours. */
export type Title = TeamYear;

/** A team a champion won with — the whole lineage, whatever it was called — and when. */
export interface TeamTitles {
  readonly teamId: string;
  /** Oldest first. */
  readonly years: readonly number[];
}

/** A champion's titles in the run, oldest first. `id` is a driver's or a team's. */
export interface TitleTally {
  readonly id: string;
  readonly titles: readonly Title[];
}

/** The heading line of an era card: "My 1950–2026", "77 seasons". */
export interface EraHeading {
  /** `eraSpan`'s phrase: "1980" or "1980–1984". */
  readonly span: string;
  readonly seasons: number;
}

/** The heading line of a season card: "My 1986", "16 rounds". */
export interface SeasonHeading {
  readonly year: number;
  readonly rounds: number;
}

/** A heading line as the card sets it: "My 1986" on the left, "16 rounds" on the right. */
export function headingLine(heading: EraHeading | SeasonHeading): {
  readonly title: string;
  readonly detail: string;
} {
  return "span" in heading
    ? { title: `My ${heading.span}`, detail: count(heading.seasons, "season") }
    : { title: `My ${heading.year}`, detail: count(heading.rounds, "round") };
}

export interface ChampionOfChampionsCard {
  readonly heading: EraHeading;
  /** The most titles, ties to whoever won first. */
  readonly champion: TitleTally & {
    /** Each team they were champion with, in the order they first won with it. */
    readonly teams: readonly TeamTitles[];
    /** Their last title's car. */
    readonly car: TeamYear;
  };
  /** The next champions, in the same order, up to `OTHER_CHAMPIONS_SHOWN`. */
  readonly others: readonly TitleTally[];
  /** Everyone past `others`, in one sentence. */
  readonly rest: RestOfChampions;
  /** The Constructors' title winners, in the same order, up to `CONSTRUCTORS_SHOWN`. */
  readonly constructors: readonly ConstructorTitles[];
}

/**
 * The champions too many to list: those with two titles or more by name,
 * grouped by count from the most down, the one-title champions as a number.
 */
export interface RestOfChampions {
  readonly named: readonly { readonly titles: number; readonly driverIds: readonly string[] }[];
  readonly once: number;
}

export interface ConstructorTitles {
  readonly titles: number;
  /** Named and badged as at its last title. */
  readonly team: TeamYear;
}

export interface LastChampionsCard {
  readonly heading: EraHeading;
  /** The newest champion's car. */
  readonly car: TeamYear;
  /** Newest first, up to `LAST_CHAMPIONS_SHOWN`; a shorter era lists every season. */
  readonly rows: readonly LastChampionRow[];
}

export interface LastChampionRow {
  readonly year: number;
  readonly driverId: string;
  /** The team they drove for that year. */
  readonly teamId: string;
  /** Which of their titles this was, 1 for a first (drawn as nothing). */
  readonly title: number;
}

export interface WorldChampionCard {
  readonly heading: SeasonHeading;
  readonly champion: {
    readonly driverId: string;
    readonly teamId: string;
    readonly wins: number;
    readonly points: number;
  };
  /** Points clear of second; null with nobody second. Zero on a title won on countback. */
  readonly margin: number | null;
  readonly runnerUpId: string | null;
  /** The championship's top three, champion first; fewer only if fewer drivers raced. */
  readonly podium: readonly SeasonPlace[];
  /** Every round, in order. */
  readonly winners: readonly RoundWinner[];
  readonly constructors: readonly { readonly teamId: string; readonly points: number }[];
}

export interface SeasonPlace {
  readonly driverId: string;
  readonly teamId: string;
  readonly points: number;
}

export interface RoundWinner {
  readonly round: number;
  /** The Grand Prix and its country (ISO code), off the year's calendar. */
  readonly name: string;
  readonly country: string | undefined;
  /** Null only for a round every starter retired from. */
  readonly winner: {
    readonly driverId: string;
    readonly teamId: string;
    readonly code: string;
  } | null;
  /** Won by the season's champion: drawn in the accent. */
  readonly champion: boolean;
}

export interface FinalStandingsCard {
  readonly heading: SeasonHeading;
  /** The champion's car. */
  readonly car: TeamYear;
  /** Everyone who scored, in championship order, up to `STANDINGS_SHOWN`. */
  readonly rows: readonly StandingRow[];
}

export interface StandingRow extends SeasonPlace {
  /** One-based. */
  readonly position: number;
  /** Drawn blank for none. */
  readonly wins: number;
}

/**
 * Titles tallied per champion, most first and ties to whoever won first.
 *
 * Each title's `teamId` is the team it was won with; `id` is whoever is being
 * counted, so the same walk counts drivers and constructors. Every champion's
 * first title is a different year, so the order is total.
 */
export function tallyTitles(
  titles: readonly { readonly id: string; readonly title: Title }[],
): readonly TitleTally[] {
  const byId = new Map<string, Title[]>();
  for (const { id, title } of [...titles].sort((a, b) => a.title.year - b.title.year)) {
    const won = byId.get(id) ?? [];
    won.push(title);
    byId.set(id, won);
  }
  return [...byId]
    .map(([id, won]) => ({ id, titles: won }))
    .sort(
      (a, b) =>
        b.titles.length - a.titles.length || (a.titles[0]?.year ?? 0) - (b.titles[0]?.year ?? 0),
    );
}

/** Champions past the listed ones, as the one-sentence summary reads them. */
export function restOfChampions(rest: readonly TitleTally[]): RestOfChampions {
  const named: { titles: number; driverIds: string[] }[] = [];
  let once = 0;
  for (const { id, titles } of rest) {
    if (titles.length < 2) {
      once += 1;
      continue;
    }
    const group = named.at(-1);
    if (group?.titles === titles.length) {
      group.driverIds.push(id);
    } else {
      named.push({ titles: titles.length, driverIds: [id] });
    }
  }
  return { named, once };
}

/** Each team a champion won with, once per lineage, with the years they won with it. */
function teamsOf(titles: readonly Title[]): readonly TeamTitles[] {
  const years = new Map<string, number[]>();
  for (const { teamId, year } of titles) {
    years.set(teamId, [...(years.get(teamId) ?? []), year]);
  }
  return [...years].map(([teamId, won]) => ({ teamId, years: won }));
}

/**
 * One team of a champion's, named as it was at each of their titles with it,
 * each name once, oldest first: "Brawn/Mercedes" for a lineage that changed
 * name between titles, a single name for one that did not. `nameIn` is the
 * screen's own naming (`useTeamNameIn`), so a run keeping its first names
 * reads one name throughout.
 */
export function lineageName(
  { teamId, years }: TeamTitles,
  nameIn: (teamId: string, year: number) => string,
): string {
  return [...new Set(years.map((year) => nameIn(teamId, year)))].join("/");
}

/** An era's crowned seasons, with the champion each one named. */
function crownedSeasons(seasons: readonly World[]) {
  const crowned = eraChampions(seasons);
  return {
    heading: { span: eraSpan(crowned), seasons: crowned.length },
    rows: crowned.flatMap(({ year, driver, team, driverTitle }) =>
      driver === null || team === null ? [] : [{ year, driver, team, driverTitle }],
    ),
  };
}

/** The champion of champions card; null for an era with nobody crowned. */
export function championOfChampionsCard(seasons: readonly World[]): ChampionOfChampionsCard | null {
  const { heading, rows } = crownedSeasons(seasons);
  const drivers = tallyTitles(
    rows.map(({ year, driver }) => ({
      id: driver.driverId,
      title: { year, teamId: driver.teamId },
    })),
  );
  const teams = tallyTitles(
    rows.map(({ year, team }) => ({ id: team.teamId, title: { year, teamId: team.teamId } })),
  );
  const [first, ...others] = drivers;
  const car = first?.titles.at(-1);
  if (first === undefined || car === undefined) {
    return null;
  }
  return {
    heading,
    champion: { ...first, teams: teamsOf(first.titles), car },
    others: others.slice(0, OTHER_CHAMPIONS_SHOWN),
    rest: restOfChampions(others.slice(OTHER_CHAMPIONS_SHOWN)),
    constructors: teams.slice(0, CONSTRUCTORS_SHOWN).flatMap(({ titles }) => {
      const last = titles.at(-1);
      return last === undefined ? [] : [{ titles: titles.length, team: last }];
    }),
  };
}

/** The last champions card; null for an era with nobody crowned. */
export function lastChampionsCard(seasons: readonly World[]): LastChampionsCard | null {
  const { heading, rows } = crownedSeasons(seasons);
  const newest = rows
    .slice(-LAST_CHAMPIONS_SHOWN)
    .reverse()
    .map(({ year, driver, driverTitle }) => ({
      year,
      driverId: driver.driverId,
      teamId: driver.teamId,
      title: driverTitle,
    }));
  const latest = newest[0];
  if (latest === undefined) {
    return null;
  }
  return { heading, car: { teamId: latest.teamId, year: latest.year }, rows: newest };
}

/** Upper-case letters only, accents dropped: "Pérez" → "PEREZ". */
function lettersOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[^\p{L}]/gu, "")
    .toUpperCase();
}

/**
 * Three-letter codes for one season's drivers, by id: the first three letters
 * of the surname, or — for drivers who would share one — the given name's
 * initial and the surname's first two ("MSC", "RSC"). A clash that survives
 * both, which no two drivers in one season have yet, keeps the surname's.
 */
export function driverCodes(names: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const parts = [...names].map(([id, name]) => {
    const { given, surname } = nameParts(name);
    const letters = lettersOf(surname);
    const initial = lettersOf(given).charAt(0);
    const short = letters.slice(0, 3);
    return { id, short, long: initial === "" ? short : `${initial}${letters.slice(0, 2)}` };
  });
  const groups = new Map<string, (typeof parts)[number][]>();
  for (const part of parts) {
    groups.set(part.short, [...(groups.get(part.short) ?? []), part]);
  }
  const codes = new Map<string, string>();
  for (const group of groups.values()) {
    const longs = new Set(group.map(({ long }) => long));
    const resolved = group.length > 1 && longs.size === group.length;
    for (const { id, short, long } of group) {
      codes.set(id, resolved ? long : short);
    }
  }
  return codes;
}

/** Whoever raced in the season, each once. */
function seasonDrivers(world: TalliedYear): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const race of world.season.races) {
    for (const { driverId } of race.entries) {
      names.set(driverId, driverName(driverId));
    }
  }
  return names;
}

function seasonHeading(world: TalliedYear): SeasonHeading {
  return { year: world.year, rounds: world.season.races.length };
}

/** The world champion card; null for a season where nobody scored. */
export function worldChampionCard(world: TalliedYear): WorldChampionCard | null {
  const standings = championshipStandings(world.season, world.points);
  const [champion, second] = standings;
  if (champion === undefined || champion.points === 0) {
    return null;
  }
  const codes = driverCodes(seasonDrivers(world));
  const calendar = seasonSeed(world.year).calendar;
  return {
    heading: seasonHeading(world),
    champion: {
      driverId: champion.driverId,
      teamId: champion.teamId,
      wins: champion.wins,
      points: champion.points,
    },
    margin: second === undefined ? null : champion.points - second.points,
    runnerUpId: second?.driverId ?? null,
    podium: standings
      .slice(0, 3)
      .map(({ driverId, teamId, points }) => ({ driverId, teamId, points })),
    winners: world.season.races.map((race, index) => {
      const entry = race.entries.find(({ driverId }) => driverId === race.winnerDriverId);
      return {
        round: index + 1,
        name: calendar[index]?.name ?? `Round ${index + 1}`,
        country: calendar[index]?.country,
        winner:
          entry === undefined
            ? null
            : {
                driverId: entry.driverId,
                teamId: entry.teamId,
                code: codes.get(entry.driverId) ?? "",
              },
        champion: entry?.driverId === champion.driverId,
      };
    }),
    constructors: constructorStandings(world.season, world.points)
      .slice(0, CONSTRUCTORS_SHOWN)
      .map(({ teamId, points }) => ({ teamId, points })),
  };
}

/** The final standings card; null for a season where nobody scored. */
export function finalStandingsCard(world: TalliedYear): FinalStandingsCard | null {
  const scorers = championshipStandings(world.season, world.points).filter(
    ({ points }) => points > 0,
  );
  const champion = scorers[0];
  if (champion === undefined) {
    return null;
  }
  return {
    heading: seasonHeading(world),
    car: { teamId: champion.teamId, year: world.year },
    rows: scorers.slice(0, STANDINGS_SHOWN).map(({ driverId, teamId, points, wins }, index) => ({
      position: index + 1,
      driverId,
      teamId,
      points,
      wins,
    })),
  };
}

/**
 * What a page offers to share: a finished season, or an era's decided years.
 * The cards are built from it only when the dialog opens.
 */
export type ShareOffer =
  | { readonly mode: "season"; readonly world: TalliedYear }
  | { readonly mode: "era"; readonly seasons: readonly World[] };

/** One card of an offer, with the data it draws. */
export type ShareCardData =
  | { readonly kind: "champion-of-champions"; readonly card: ChampionOfChampionsCard }
  | { readonly kind: "last-champions"; readonly card: LastChampionsCard }
  | { readonly kind: "world-champion"; readonly card: WorldChampionCard }
  | { readonly kind: "final-standings"; readonly card: FinalStandingsCard };

/** The offer's two cards in the dialog's order, leaving out one with nothing to show. */
export function shareCardsOf(offer: ShareOffer): readonly ShareCardData[] {
  const cards: ShareCardData[] = [];
  if (offer.mode === "era") {
    const champions = championOfChampionsCard(offer.seasons);
    const last = lastChampionsCard(offer.seasons);
    if (champions !== null) cards.push({ kind: "champion-of-champions", card: champions });
    if (last !== null) cards.push({ kind: "last-champions", card: last });
  } else {
    const champion = worldChampionCard(offer.world);
    const standings = finalStandingsCard(offer.world);
    if (champion !== null) cards.push({ kind: "world-champion", card: champion });
    if (standings !== null) cards.push({ kind: "final-standings", card: standings });
  }
  return cards;
}

/**
 * A card's PNG, named after the run and the card, so the two of one offer
 * never share a name: "my-1986-world-champion.png", "my-1980-1984-last-champions.png".
 */
export function cardFileName(data: ShareCardData): string {
  const run = headingLine(data.card.heading)
    .title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `${run}-${data.kind}.png`;
}
