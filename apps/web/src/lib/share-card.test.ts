/**
 * The share cards' data. The rules — tie order, the one-sentence rest, the
 * abbreviations — are tested on synthetic titles and names; the cards
 * themselves on real seasons, by shape and against the standings they are
 * read from, never against who won.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { createWorld, type World } from "../store/season.js";
import { findWorld, YEAR } from "../test-support.js";
import { PLAYABLE_SEASONS } from "./seasons.js";
import {
  CONSTRUCTORS_SHOWN,
  cardFileName,
  championOfChampionsCard,
  driverCodes,
  finalStandingsCard,
  headingLine,
  LAST_CHAMPIONS_SHOWN,
  lastChampionsCard,
  lineageName,
  OTHER_CHAMPIONS_SHOWN,
  restOfChampions,
  type ShareOffer,
  STANDINGS_SHOWN,
  shareCardsOf,
  type TitleTally,
  tallyTitles,
  WIDE_ROUNDS_FROM,
  winnerColumns,
  worldChampionCard,
} from "./share-card.js";

/** One title each for `id`, in the years given, all with the same team. */
function won(id: string, ...years: number[]) {
  return years.map((year) => ({ id, title: { year, teamId: `${id}-team` } }));
}

function tally(id: string, count: number): TitleTally {
  return { id, titles: Array.from({ length: count }, (_, i) => ({ year: 2000 + i, teamId: "t" })) };
}

/** A season scored so that every finisher scores. */
function everyFinisherScores(world: World): World {
  return { ...world, points: Array.from({ length: 50 }, () => 1) };
}

/** A season scored so that nobody does. */
function nobodyScores(world: World): World {
  return { ...world, points: [] };
}

/** Consecutive seasons off the data, each its own world. */
function era(length: number): readonly World[] {
  return PLAYABLE_SEASONS.slice(0, length).map((year, index) => createWorld(index + 1, year));
}

describe("headingLine", () => {
  it("reads an era as its span and a count of seasons", () => {
    expect(headingLine({ span: "1980–1984", seasons: 5 })).toEqual({
      title: "My 1980–1984",
      detail: "5 seasons",
    });
    expect(headingLine({ span: "1980", seasons: 1 }).detail).toBe("1 season");
  });

  it("reads a season as its year and a count of rounds", () => {
    expect(headingLine({ year: 1986, rounds: 16 })).toEqual({
      title: "My 1986",
      detail: "16 rounds",
    });
  });
});

describe("tallyTitles", () => {
  it("puts the most titles first and breaks a tie for whoever won first", () => {
    const tallies = tallyTitles([
      ...won("b", 1990, 1991),
      ...won("a", 1992, 1993),
      ...won("c", 1989),
    ]);
    expect(tallies.map(({ id }) => id)).toEqual(["b", "a", "c"]);
  });

  it("orders each champion's titles oldest first, whatever order they arrive in", () => {
    const [only] = tallyTitles([...won("a", 1995), ...won("a", 1985), ...won("a", 1990)]);
    expect(only?.titles.map(({ year }) => year)).toEqual([1985, 1990, 1995]);
  });

  it("does not depend on the order the titles arrive in", () => {
    const titles = [...won("a", 1980, 1990), ...won("b", 1985, 1986), ...won("c", 1970)];
    expect(tallyTitles([...titles].reverse())).toEqual(tallyTitles(titles));
  });
});

describe("restOfChampions", () => {
  it("names each count of two or more, most first, and counts the one-title champions", () => {
    const rest = restOfChampions([
      tally("a", 3),
      tally("b", 2),
      tally("c", 2),
      tally("d", 1),
      tally("e", 1),
    ]);
    expect(rest).toEqual({
      named: [
        { titles: 3, driverIds: ["a"] },
        { titles: 2, driverIds: ["b", "c"] },
      ],
      once: 2,
    });
  });

  it("names nobody when no one has two titles", () => {
    expect(restOfChampions([tally("a", 1), tally("b", 1)])).toEqual({ named: [], once: 2 });
  });

  it("is empty with nobody left", () => {
    expect(restOfChampions([])).toEqual({ named: [], once: 0 });
  });
});

describe("driverCodes", () => {
  const codesOf = (...names: string[]) => [
    ...driverCodes(new Map(names.map((name) => [name, name]))).values(),
  ];

  it("takes the first three letters of the surname", () => {
    expect(codesOf("Ayrton Senna", "Alain Prost")).toEqual(["SEN", "PRO"]);
  });

  it("gives drivers who would share one their initial and two letters of the surname", () => {
    expect(codesOf("Michael Schumacher", "Ralf Schumacher", "Kimi Räikkönen")).toEqual([
      "MSC",
      "RSC",
      "RAI",
    ]);
  });

  it("reads past accents, particles and suffixes", () => {
    expect(codesOf("Sergio Pérez", "Nyck de Vries", "Nelson Piquet Jr.")).toEqual([
      "PER",
      "DEV",
      "PIQ",
    ]);
  });

  it("keeps the surname's letters where the initials clash too", () => {
    expect(codesOf("Mick Schumacher", "Michael Schumacher")).toEqual(["SCH", "SCH"]);
  });

  it("codes a one-word name off that word, clash or not", () => {
    expect(codesOf("Pelé", "Pedro Peláez")).toEqual(["PEL", "PPE"]);
  });
});

describe("lineageName", () => {
  /** An invented lineage renamed in 2000 and again in 2010. */
  const nameIn = (_: string, year: number) =>
    year < 2000 ? "Alpha" : year < 2010 ? "Beta" : "Gamma";

  it("joins the names the team had at each title, oldest first", () => {
    expect(lineageName({ teamId: "x", years: [1995, 2005, 2015] }, nameIn)).toBe(
      "Alpha/Beta/Gamma",
    );
  });

  it("names a team once for titles under the same name", () => {
    expect(lineageName({ teamId: "x", years: [2001, 2002, 2011] }, nameIn)).toBe("Beta/Gamma");
    expect(lineageName({ teamId: "x", years: [2001, 2002] }, nameIn)).toBe("Beta");
  });

  it("skips names it held without a title", () => {
    expect(lineageName({ teamId: "x", years: [1995, 2015] }, nameIn)).toBe("Alpha/Gamma");
  });
});

describe("the era cards", () => {
  const seasons = era(LAST_CHAMPIONS_SHOWN + 5);

  it("count every crowned season once, between the champion, the others and the rest", () => {
    const card = championOfChampionsCard(seasons);
    if (card === null) throw new Error("no champion");
    const { champion, others, rest } = card;
    const named = rest.named.reduce(
      (sum, { titles, driverIds }) => sum + titles * driverIds.length,
      0,
    );
    const titles = [champion, ...others].reduce((sum, { titles }) => sum + titles.length, 0);
    expect(titles + named + rest.once).toBe(seasons.length);
    expect(card.heading.seasons).toBe(seasons.length);
  });

  it("list champions in order, the others capped and the rest beyond them", () => {
    const card = championOfChampionsCard(seasons);
    if (card === null) throw new Error("no champion");
    const counts = [card.champion, ...card.others].map(({ titles }) => titles.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(card.others.length).toBeLessThanOrEqual(OTHER_CHAMPIONS_SHOWN);
    const restCount = card.rest.named.reduce((sum, { driverIds }) => sum + driverIds.length, 0);
    if (restCount + card.rest.once > 0) {
      expect(card.others).toHaveLength(OTHER_CHAMPIONS_SHOWN);
      expect(card.rest.named.every(({ titles }) => titles <= (counts.at(-1) ?? 0))).toBe(true);
    }
  });

  it("drive the champion's last title's car and name each of their teams once", () => {
    const card = championOfChampionsCard(seasons);
    if (card === null) throw new Error("no champion");
    const { champion } = card;
    expect(champion.car).toEqual(champion.titles.at(-1));
    const teams = champion.teams.map(({ teamId }) => teamId);
    expect(new Set(teams).size).toBe(teams.length);
    for (const { teamId, years } of champion.teams) {
      expect(years).toEqual(
        champion.titles.filter((title) => title.teamId === teamId).map(({ year }) => year),
      );
    }
    expect(champion.teams.flatMap(({ years }) => years)).toHaveLength(champion.titles.length);
  });

  it("give the Constructors' title winners by count, each named at their last title", () => {
    const card = championOfChampionsCard(seasons);
    if (card === null) throw new Error("no champion");
    expect(card.constructors.length).toBeLessThanOrEqual(CONSTRUCTORS_SHOWN);
    for (const { team } of card.constructors) {
      const world = seasons.find(({ year }) => year === team.year);
      if (world === undefined) throw new Error(`no ${team.year}`);
      expect(constructorStandings(world.season, world.points)[0]?.teamId).toBe(team.teamId);
    }
  });

  it("list the last champions newest first, numbering each one's titles in the run", () => {
    const card = lastChampionsCard(seasons);
    if (card === null) throw new Error("no champion");
    expect(card.rows).toHaveLength(LAST_CHAMPIONS_SHOWN);
    expect(card.rows[0]?.year).toBe(seasons.at(-1)?.year);
    expect(card.car).toEqual({ teamId: card.rows[0]?.teamId, year: card.rows[0]?.year });
    for (const row of card.rows) {
      const upTo = seasons.filter(({ year }) => year <= row.year);
      const titles = upTo.filter(
        (world) => championshipStandings(world.season, world.points)[0]?.driverId === row.driverId,
      );
      expect(row.title, `${row.year}`).toBe(titles.length);
    }
  });

  it("make an era of one season one champion with one title, and list it", () => {
    const one = era(1);
    const card = championOfChampionsCard(one);
    expect(card?.champion.titles).toHaveLength(1);
    expect(card?.others).toEqual([]);
    expect(card?.rest).toEqual({ named: [], once: 0 });
    expect(card?.constructors).toHaveLength(1);
    expect(lastChampionsCard(one)?.rows.map(({ title }) => title)).toEqual([1]);
  });

  it("are null with no season crowned yet", () => {
    expect(championOfChampionsCard([])).toBeNull();
    expect(lastChampionsCard([])).toBeNull();
  });
});

describe("winnerColumns", () => {
  it("keeps 8 columns up to the threshold and takes 12 from it", () => {
    expect(winnerColumns(WIDE_ROUNDS_FROM - 1)).toBe(8);
    expect(winnerColumns(WIDE_ROUNDS_FROM)).toBe(12);
  });
});

describe("the season cards", () => {
  const world = createWorld(1, YEAR);
  const standings = championshipStandings(world.season, world.points);

  it("name the champion off the standings, with the margin to second", () => {
    const card = worldChampionCard(world);
    const [first, second] = standings;
    expect(card?.champion.driverId).toBe(first?.driverId);
    expect(card?.runnerUpId).toBe(second?.driverId);
    expect(card?.margin).toBe((first?.points ?? 0) - (second?.points ?? 0));
    expect(card?.podium.map(({ driverId }) => driverId)).toEqual(
      standings.slice(0, 3).map(({ driverId }) => driverId),
    );
    expect(card?.constructors.length).toBeLessThanOrEqual(CONSTRUCTORS_SHOWN);
  });

  it("list every round's winner, the champion's wins marked", () => {
    const card = worldChampionCard(world);
    if (card === null) throw new Error("no champion");
    expect(card.winners).toHaveLength(world.season.races.length);
    card.winners.forEach((round, index) => {
      expect(round.round).toBe(index + 1);
      expect(round.winner?.driverId ?? null).toBe(world.season.races[index]?.winnerDriverId);
      expect(round.winner?.code).toMatch(/^[A-Z]{3}$/);
    });
    expect(card.winners.filter(({ champion }) => champion)).toHaveLength(card.champion.wins);
  });

  it("list everyone who scored, in order, up to the cap", () => {
    const big = findWorld(
      (each) =>
        championshipStandings(each.season, everyFinisherScores(each).points).filter(
          ({ points }) => points > 0,
        ).length > STANDINGS_SHOWN,
      { year: PLAYABLE_SEASONS.at(-1) ?? YEAR },
    );
    for (const each of [world, everyFinisherScores(big)]) {
      const scorers = championshipStandings(each.season, each.points).filter(
        ({ points }) => points > 0,
      );
      const card = finalStandingsCard(each);
      expect(card?.rows.map(({ driverId }) => driverId)).toEqual(
        scorers.slice(0, STANDINGS_SHOWN).map(({ driverId }) => driverId),
      );
      expect(card?.rows.map(({ position }) => position)).toEqual(
        card?.rows.map((_, index) => index + 1),
      );
      expect(card?.car).toEqual({ teamId: scorers[0]?.teamId, year: each.year });
    }
  });

  it("are null where nobody scored", () => {
    expect(worldChampionCard(nobodyScores(world))).toBeNull();
    expect(finalStandingsCard(nobodyScores(world))).toBeNull();
  });
});

describe("shareCardsOf", () => {
  const world = createWorld(1, YEAR);
  const seasons = era(3);

  it("gives a season its world champion, then its final standings", () => {
    expect(shareCardsOf({ mode: "season", world })).toEqual([
      { kind: "world-champion", card: worldChampionCard(world) },
      { kind: "final-standings", card: finalStandingsCard(world) },
    ]);
  });

  it("gives an era its champion of champions, then its last champions", () => {
    expect(shareCardsOf({ mode: "era", seasons })).toEqual([
      { kind: "champion-of-champions", card: championOfChampionsCard(seasons) },
      { kind: "last-champions", card: lastChampionsCard(seasons) },
    ]);
  });

  it("leaves out a card with nothing to show", () => {
    expect(shareCardsOf({ mode: "season", world: nobodyScores(world) })).toEqual([]);
    expect(shareCardsOf({ mode: "era", seasons: [] })).toEqual([]);
  });
});

describe("cardFileName", () => {
  it("names each card's PNG after the run and the card, never two alike", () => {
    const offers: readonly ShareOffer[] = [
      { mode: "season", world: createWorld(1, YEAR) },
      { mode: "era", seasons: era(3) },
    ];
    const names = offers.flatMap((offer) => shareCardsOf(offer).map(cardFileName));
    expect(names).toContain(`my-${YEAR}-world-champion.png`);
    expect(names).toContain(`my-${YEAR}-final-standings.png`);
    const [first, , last] = PLAYABLE_SEASONS;
    expect(names).toContain(`my-${first}-${last}-champion-of-champions.png`);
    expect(names).toContain(`my-${first}-${last}-last-champions.png`);
    expect(new Set(names).size).toBe(names.length);
  });
});
