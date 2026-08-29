/**
 * Career totals over a run, and the order a record card puts them in.
 *
 * Two halves with two kinds of test. `careerRecords` is checked against a
 * second, independent walk of the same seasons — two derivations of one set of
 * results have no excuse to disagree — and never against a figure anyone won,
 * because who wins depends on every rating in the pool and on the seed.
 * `rankBy` is a pure rule, so it is tested against **synthetic careers**: the
 * same reason `lib/rating.test.ts` invents its drivers.
 */

import { seasonSeed, teamsById } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { createWorld, type World } from "../store/season.js";
import { isSharedTeamName, teamName } from "./names.js";
import {
  type CareerRecord,
  type CareerSpell,
  careerRecords,
  labelsFor,
  type RecordMetric,
  rankBy,
  spellRange,
  spellSpan,
  spellsBy,
} from "./records.js";
import { PLAYABLE_SEASONS } from "./seasons.js";

/** A few consecutive seasons, off the data rather than years written down. */
const YEARS = PLAYABLE_SEASONS.slice(0, 3);
const seasons: readonly World[] = YEARS.map((year, index) => createWorld(index + 1, year));
const records = careerRecords(seasons);

/** The same seasons, added up again by hand — the independent walk. */
function sumOf(metric: RecordMetric | "points", driverId: string): number {
  let total = 0;
  for (const world of seasons) {
    const standings = championshipStandings(world.season, world.points);
    standings.forEach((standing, index) => {
      if (standing.driverId !== driverId) {
        return;
      }
      total += metric === "titles" ? (index === 0 ? 1 : 0) : standing[metric];
    });
  }
  return total;
}

/**
 * A short run of consecutive seasons in which some lineage raced under a name,
 * changed it, and took it back — March, Leyton House, March.
 *
 * Searched in the seed data rather than written down: which team renamed when
 * is history, but *that the data still contains such a case* is what the test
 * below needs, and pinning the years would fail the day another rename lands.
 * Cheap, because it reads the entry lists rather than simulating anything; only
 * the window it returns is ever run.
 */
function renamedBackWindow(): readonly number[] {
  const appearances = new Map<string, { year: number; name: string }[]>();
  for (const year of PLAYABLE_SEASONS) {
    for (const entry of seasonSeed(year).entries) {
      const seen = appearances.get(entry.teamId) ?? [];
      seen.push({ year, name: teamName(entry.teamId, year) });
      appearances.set(entry.teamId, seen);
    }
  }
  for (const seen of appearances.values()) {
    for (let i = 1; i < seen.length; i += 1) {
      const name = seen[i]?.name;
      // The start of a new spell: this year's name differs from last year's.
      if (name === undefined || name === seen[i - 1]?.name) {
        continue;
      }
      // The last year they raced under this name before, if there was one —
      // anything earlier than i - 1 has a different name in between.
      for (let k = i - 2; k >= 0; k -= 1) {
        if (seen[k]?.name === name) {
          const from = seen[k]?.year ?? 0;
          const to = seen[i]?.year ?? 0;
          return PLAYABLE_SEASONS.filter((year) => year >= from && year <= to);
        }
      }
    }
  }
  throw new Error("no lineage in the seed data ever took an old name back");
}

const METRICS: readonly RecordMetric[] = ["titles", "wins", "podiums", "poles"];

function career(id: string, over: Partial<CareerRecord> = {}): CareerRecord {
  return {
    id,
    titles: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    points: 0,
    seasons: 1,
    lastYear: 2000,
    spells: [],
    ...over,
  };
}

/** A synthetic spell, for the breakdown rule. */
function spell(name: string, over: Partial<CareerSpell> = {}): CareerSpell {
  const years = { firstYear: 2000, lastYear: 2000, ...over };
  return {
    name,
    titles: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    points: 0,
    seasons: 1,
    ...over,
    ...years,
    // One stretch unless a test says otherwise, which is every case but the
    // name that was taken back.
    segments: over.segments ?? [{ from: years.firstYear, to: years.lastYear }],
    // Scored on the way out unless a test pins the year down: the fallback is
    // the spell's own end, which is what a career with nothing to say uses.
    scored: over.scored ?? { titles: null, wins: null, podiums: null, poles: null },
  };
}

describe("career records over a run", () => {
  it("gives every driver who raced a career, and each of them once", () => {
    const ids = records.drivers.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const world of seasons) {
      for (const entrant of world.field) {
        expect(ids, entrant.driverId).toContain(entrant.driverId);
      }
    }
  });

  it("adds each figure up across the seasons", () => {
    // Against a second walk of the same results rather than against a number:
    // ratings and seeds move, and "who has 11 wins" moves with them.
    for (const record of records.drivers) {
      for (const metric of [...METRICS, "points" as const]) {
        expect(record[metric], `${record.id} ${metric}`).toBe(sumOf(metric, record.id));
      }
    }
  });

  it("crowns exactly one champion a season, in both lists", () => {
    const titles = (all: readonly CareerRecord[]) =>
      all.reduce((total, record) => total + record.titles, 0);
    expect(titles(records.drivers)).toBe(seasons.length);
    expect(titles(records.teams)).toBe(seasons.length);
  });

  it("counts the seasons a competitor appears in", () => {
    for (const record of records.drivers) {
      const entered = seasons.filter((world) =>
        world.season.races.some((race) =>
          race.entries.some((entry) => entry.driverId === record.id),
        ),
      );
      expect(record.seasons, record.id).toBe(entered.length);
    }
  });

  it("labels a career as of the last season it appears in", () => {
    // A team's name and livery are eras, so a row spanning a decade has to be
    // named as of some year — the last one it raced.
    for (const record of records.drivers) {
      const raced = seasons.filter((world) =>
        world.season.races.some((race) =>
          race.entries.some((entry) => entry.driverId === record.id),
        ),
      );
      expect(record.lastYear, record.id).toBe(raced.at(-1)?.year);
    }
  });

  it("adds a team's cars together, as the constructors' table does", () => {
    for (const record of records.teams) {
      let wins = 0;
      for (const world of seasons) {
        wins +=
          constructorStandings(world.season, world.points).find(
            (standing) => standing.teamId === record.id,
          )?.wins ?? 0;
      }
      expect(record.wins, record.id).toBe(wins);
    }
  });

  it("adds up to nothing over no seasons at all", () => {
    expect(careerRecords([])).toEqual({ drivers: [], teams: [] });
  });
});

describe("ranking a record card", () => {
  it("puts the biggest figure first", () => {
    const ranked = rankBy([career("a", { wins: 2 }), career("b", { wins: 9 })], "wins");
    expect(ranked.map((row) => row.record.id)).toEqual(["b", "a"]);
    expect(ranked.map((row) => row.value)).toEqual([9, 2]);
    expect(ranked.map((row) => row.position)).toEqual([1, 2]);
  });

  it("leaves out anyone who never had one", () => {
    // The difference between a record book and a championship table: an era
    // long enough to read has hundreds of drivers who never took a pole.
    const ranked = rankBy([career("a", { poles: 1 }), career("b"), career("c")], "poles");
    expect(ranked.map((row) => row.record.id)).toEqual(["a"]);
  });

  it("shares a position between equal figures, and skips the next", () => {
    const ranked = rankBy(
      [career("a", { wins: 4 }), career("b", { wins: 4 }), career("c", { wins: 1 })],
      "wins",
    );
    expect(ranked.map((row) => row.position)).toEqual([1, 1, 3]);
    expect(ranked.map((row) => row.shared)).toEqual([true, true, false]);
  });

  it("prints the fuller cabinet first when two are level", () => {
    // The tie-break decides which row is printed first, not who is ahead — so
    // both still hold the position.
    const ranked = rankBy(
      [career("plain", { wins: 3 }), career("champion", { wins: 3, titles: 1 })],
      "wins",
    );
    expect(ranked.map((row) => row.record.id)).toEqual(["champion", "plain"]);
    expect(ranked.map((row) => row.position)).toEqual([1, 1]);
  });

  it("orders the same however the careers arrive", () => {
    // A total order, ending on the id, so a card never depends on the sort
    // implementation or on the order the seasons were walked in.
    const all = [
      career("a", { podiums: 5 }),
      career("b", { podiums: 5 }),
      career("c", { podiums: 5 }),
    ];
    const forwards = rankBy(all, "podiums").map((row) => row.record.id);
    const backwards = rankBy([...all].reverse(), "podiums").map((row) => row.record.id);
    expect(backwards).toEqual(forwards);
  });

  it("ranks every metric off the same careers", () => {
    const all = [career("a", { titles: 1, wins: 1 }), career("b", { poles: 3, podiums: 2 })];
    expect(rankBy(all, "titles").map((row) => row.record.id)).toEqual(["a"]);
    expect(rankBy(all, "poles").map((row) => row.record.id)).toEqual(["b"]);
  });

  it("leaves the careers it was handed alone", () => {
    const all = [career("a", { wins: 1 }), career("b", { wins: 2 })];
    rankBy(all, "wins");
    expect(all.map((record) => record.id)).toEqual(["a", "b"]);
  });
});

describe("the names a career was raced under", () => {
  it("gives a driver exactly one spell, covering their whole run", () => {
    // People are not renamed, which is what lets a card treat both lists the
    // same way and still only ever open a team out.
    for (const record of records.drivers) {
      expect(record.spells, record.id).toHaveLength(1);
      const only = record.spells[0];
      expect(only?.lastYear).toBe(record.lastYear);
      expect(only?.wins).toBe(record.wins);
      expect(only?.seasons).toBe(record.seasons);
    }
  });

  it("splits a team's figures across the names it raced under", () => {
    for (const record of records.teams) {
      const total = (of: (spell: CareerSpell) => number) =>
        record.spells.reduce((sum, spell) => sum + of(spell), 0);
      expect(
        total((spell) => spell.wins),
        record.id,
      ).toBe(record.wins);
      expect(
        total((spell) => spell.titles),
        record.id,
      ).toBe(record.titles);
      expect(
        total((spell) => spell.seasons),
        record.id,
      ).toBe(record.seasons);
      // One spell per name, in the order the names first appeared.
      const names = record.spells.map((spell) => spell.name);
      expect(new Set(names).size, record.id).toBe(names.length);
      const first = record.spells.map((spell) => spell.firstYear);
      expect([...first], record.id).toEqual([...first].sort((a, b) => a - b));
    }
  });

  it("merges a name that was taken back into one record", () => {
    // A lineage that went March, Leyton House, March is **one** March: a name
    // taken back is the same name, and two rows of it in one card is a split
    // nobody reading a record book wants. The interruption survives in the
    // spell's segments, so the row can still say which years those were. The
    // window is searched for in the seed data rather than written down, because
    // who renamed when is data.
    const window = renamedBackWindow();
    const run = window.map((year, index) => createWorld(index + 1, year));
    const teams = careerRecords(run).teams;
    const taken = teams.find((record) => record.spells.some((spell) => spell.segments.length > 1));
    expect(taken, "no lineage in the window took an old name back").toBeDefined();

    for (const record of teams) {
      const names = record.spells.map((spell) => spell.name);
      expect(new Set(names).size, record.id).toBe(names.length);
    }
    const split = taken?.spells.find((spell) => spell.segments.length > 1);
    const segments = split?.segments ?? [];
    // Ordered, and with a gap between them — otherwise it is one stretch.
    for (let i = 1; i < segments.length; i += 1) {
      expect((segments[i]?.from ?? 0) - (segments[i - 1]?.to ?? 0)).toBeGreaterThan(1);
    }
    expect(split?.firstYear).toBe(segments[0]?.from);
    expect(split?.lastYear).toBe(segments.at(-1)?.to);
    // The years it was called something else belong to another spell of the
    // same career, not to this one.
    expect(spellSpan(split ?? spell("none"))).toContain(", ");
  });

  it("remembers the last season each figure was actually scored in", () => {
    // Which is not the last season under the name, and the difference is what
    // the row is coloured by. Checked against a second walk of the same
    // results, the way the totals are.
    for (const record of records.teams) {
      for (const spell of record.spells) {
        const won: number[] = [];
        for (const world of seasons) {
          const standing = constructorStandings(world.season, world.points).find(
            (each) => each.teamId === record.id,
          );
          if (
            standing !== undefined &&
            standing.wins > 0 &&
            teamName(record.id, world.year) === spell.name
          ) {
            won.push(world.year);
          }
        }
        expect(spell.scored.wins, `${record.id} as ${spell.name}`).toBe(won.at(-1) ?? null);
        // A figure of nothing is not a record and never moves the year.
        if (spell.wins === 0) {
          expect(spell.scored.wins, record.id).toBeNull();
        }
      }
    }
  });

  it("orders a breakdown by the figure asked for, and drops the empty spells", () => {
    const record = career("mercedes", {
      wins: 12,
      spells: [
        spell("BAR", { wins: 0, firstYear: 1999, lastYear: 2004 }),
        spell("Brawn", { wins: 4, firstYear: 2009, lastYear: 2009 }),
        spell("Mercedes", { wins: 8, firstYear: 2010, lastYear: 2020 }),
      ],
    });
    const shown = spellsBy(record, "wins");
    expect(shown.map((spell) => spell.name)).toEqual(["Mercedes", "Brawn"]);
    // What is shown still adds up to the row above it.
    expect(shown.reduce((sum, spell) => sum + spell.wins, 0)).toBe(record.wins);
  });

  it("leaves a single-name career with nothing to open", () => {
    const record = career("ferrari", { wins: 3, spells: [spell("Ferrari", { wins: 3 })] });
    expect(spellsBy(record, "wins")).toHaveLength(1);
    expect(spellsBy(record, "titles")).toHaveLength(0);
  });

  it("writes a spell's years as a span, and a single year as itself", () => {
    expect(spellSpan(spell("Brawn", { firstYear: 2009, lastYear: 2009 }))).toBe("2009");
    expect(spellSpan(spell("Tyrrell", { firstYear: 1970, lastYear: 1998 }))).toBe("1970–1998");
  });

  it("writes a name that was taken back as its stretches, and a row as one span", () => {
    // The breakdown is exact — the middle years belong to another row of the
    // same expansion — while the label only has to tell two teams apart.
    const march = spell("March", {
      firstYear: 1970,
      lastYear: 1996,
      segments: [
        { from: 1970, to: 1989 },
        { from: 1992, to: 1996 },
      ],
    });
    expect(spellSpan(march)).toBe("1970–1989, 1992–1996");
    expect(spellRange(march)).toBe("1970–1996");
  });
});

/** A spell whose wins were all taken in 2006, years before it stopped racing. */
const SCORED_2006 = { titles: 2006, wins: 2006, podiums: 2006, poles: 2006 };

describe("what a card calls a row", () => {
  const ranked = (records: readonly CareerRecord[]) => rankBy(records, "wins");
  /** An invented collision, so the rule is tested without the seed data. */
  const shared = (name: string) => name === "Mercedes";
  const label = (records: readonly CareerRecord[], id: string) =>
    labelsFor(ranked(records), "wins", () => "fallback", shared).get(id);

  const modern = career("tyrrell", {
    wins: 90,
    lastYear: 2026,
    spells: [
      spell("Tyrrell", { wins: 10, firstYear: 1970, lastYear: 1998 }),
      spell("Mercedes", { wins: 80, firstYear: 2010, lastYear: 2026 }),
    ],
  });
  const works = career("mercedes", {
    wins: 5,
    lastYear: 1955,
    spells: [spell("Mercedes", { wins: 5, firstYear: 1954, lastYear: 1955 })],
  });

  it("names a lineage by the name it won the most under", () => {
    // Not the most recent, which answers a different question: eighty wins as
    // Mercedes belong at the top of a wins card as Mercedes.
    expect(label([modern], "tyrrell")?.name).toBe("Mercedes");
    // And the other way round, which is the half a "most recent name" rule
    // would get wrong: the same lineage, most of it won under the older name.
    const early = career("tyrrell", {
      wins: 90,
      lastYear: 2026,
      spells: [
        spell("Tyrrell", { wins: 80, firstYear: 1970, lastYear: 1998 }),
        spell("Mercedes", { wins: 10, firstYear: 2010, lastYear: 2026 }),
      ],
    });
    expect(label([early], "tyrrell")?.name).toBe("Tyrrell");
    expect(label([early], "tyrrell")?.year).toBe(1998);
    // And a metric it only ever scored under an older name says that name.
    const titles = labelsFor(
      rankBy(
        [career("tyrrell", { titles: 2, spells: [spell("Tyrrell", { titles: 2 })] })],
        "titles",
      ),
      "titles",
      () => "fallback",
      shared,
    );
    expect(titles.get("tyrrell")?.name).toBe("Tyrrell");
  });

  it("draws the row as of the last season the figure was scored in", () => {
    // The colours of a record are the colours it was won in: a lineage that
    // won as Renault in 2006 and went on racing under that name until 2020
    // must not wear the livery of the years it won nothing. The year resolves
    // the label as well, and stays inside the spell, so the name is unchanged.
    const renault = career("toleman", {
      wins: 20,
      lastYear: 2026,
      spells: [
        spell("Renault", { wins: 20, firstYear: 2002, lastYear: 2020, scored: SCORED_2006 }),
      ],
    });
    expect(label([renault], "toleman")?.year).toBe(2006);
    expect(label([renault], "toleman")?.name).toBe("Renault");
  });

  it("falls back to the end of the spell where nothing says otherwise", () => {
    expect(label([modern], "tyrrell")?.year).toBe(2026);
    expect(label([works], "mercedes")?.year).toBe(1955);
  });

  it("adds the years to a name a second lineage ever held", () => {
    const both = [modern, works];
    expect(label(both, "tyrrell")?.span).toBe("2010–2026");
    expect(label(both, "mercedes")?.span).toBe("1954–1955");
  });

  it("adds them even when the other holder is nowhere on the card", () => {
    // The question is asked of the database, not of the rows on show: the other
    // Mercedes having won nothing does not make this one identifiable, and a
    // reader cannot tell which of the two a bare "Mercedes" is.
    expect(label([modern], "tyrrell")?.span).toBe("2010–2026");
    expect(label([works], "mercedes")?.span).toBe("1954–1955");
  });

  it("leaves them off a name nobody else ever held", () => {
    const ferrari = career("ferrari", {
      wins: 9,
      spells: [spell("Ferrari", { wins: 9, firstYear: 1950, lastYear: 2026 })],
    });
    expect(label([ferrari, modern], "ferrari")?.span).toBeNull();
  });

  it("labels every row of the list it was given", () => {
    const labels = labelsFor(ranked([modern, works]), "wins", () => "fallback", shared);
    expect([...labels.keys()].sort()).toEqual(["mercedes", "tyrrell"]);
  });
});

describe("the names two lineages share", () => {
  // Searched in the seed data rather than written down: which lineages collide
  // is data — `lotus` is Team Lotus while `caterham` and `toleman` both raced
  // as Lotus — and the rule is what a shared name *means*, not who holds one.
  const holders = new Map<string, Set<string>>();
  for (const [id, team] of teamsById()) {
    for (const era of team.identity) {
      holders.set(era.name, (holders.get(era.name) ?? new Set<string>()).add(id));
    }
  }
  const collisions = [...holders].filter(([, ids]) => ids.size > 1);
  const alone = [...holders].filter(([, ids]) => ids.size === 1);

  it("knows every name more than one lineage raced under", () => {
    expect(collisions.length, "no two lineages in the seed data share a name").toBeGreaterThan(0);
    for (const [name] of collisions) {
      expect(isSharedTeamName(name), name).toBe(true);
    }
  });

  it("leaves the names only one lineage ever used alone", () => {
    expect(alone.length).toBeGreaterThan(0);
    for (const [name] of alone) {
      expect(isSharedTeamName(name), name).toBe(false);
    }
  });

  it("says nothing about a name no team ever had", () => {
    expect(isSharedTeamName("Not A Team")).toBe(false);
  });
});
