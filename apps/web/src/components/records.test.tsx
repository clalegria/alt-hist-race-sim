/**
 * The career statistics under the roll of honour: who won the *era*.
 *
 * Everything here takes props, so it renders through `renderToStaticMarkup`
 * with no DOM and no store. The cards' own `Show all` is therefore only ever
 * seen shut — opening it is a click — but a **row** is controlled, exactly as
 * `ChampionRow` is, so both states of a lineage opening into its names render
 * on their own.
 *
 * The synthetic careers are deliberate: what a card does must not depend on how
 * many wins anybody actually took, since ratings and seeds both move.
 */

import { teamsById } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STANDOUT_POSITION, STANDOUT_ROW } from "../lib/highlight.js";
import { liveryFor } from "../lib/livery.js";
import { driverName, entryName, teamName } from "../lib/names.js";
import {
  type CareerRecord,
  type CareerSpell,
  careerRecords,
  labelsFor,
  type RankedRecord,
  rankBy,
} from "../lib/records.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { createWorld, type World } from "../store/season.js";
import { textOf } from "../test-support.js";
import { CareerStatistics, RecordCard, RecordRow } from "./CareerStatistics.js";
import { TEAM_LINE } from "./DriverName.js";
import { BADGE_SHAPE, badgeBackground } from "./TeamBadge.js";

/** A run of a few seasons — the years off the data, the seeds arbitrary. */
const seasons: readonly World[] = PLAYABLE_SEASONS.slice(0, 3).map((year, index) =>
  createWorld(index + 1, year),
);
const records = careerRecords(seasons);
const html = renderToStaticMarkup(<CareerStatistics seasons={seasons} />);

const noop = () => {};

/** Every `<tr>` of a rendered card. */
function rows(markup: string): string[] {
  return markup.split("<tr").slice(1);
}

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

/** Twelve careers, so the cut at ten has something to cut. */
const many: readonly CareerRecord[] = Array.from({ length: 12 }, (_, index) =>
  career(`driver-${index}`, { wins: 12 - index }),
);

const card = (records: readonly CareerRecord[], kind: "driver" | "team" = "driver") =>
  renderToStaticMarkup(
    <RecordCard title="Race wins" records={records} metric="wins" kind={kind} />,
  );

describe("the career statistics", () => {
  it("gives drivers and teams the same four cards", () => {
    for (const heading of ["Driver statistics", "Team statistics"]) {
      expect(html).toContain(heading);
    }
    for (const title of ["Championships", "Race wins", "Podiums", "Pole positions"]) {
      // Once per half of the screen.
      expect(html.split(`>${title}<`)).toHaveLength(3);
    }
  });

  it("heads each card one level under its half's heading", () => {
    expect(html.split("<h2").length - 1).toBe(2);
    expect(html.split("<h3").length - 1).toBe(8);
  });

  it("names the drivers and the teams of the era", () => {
    const best = (list: readonly CareerRecord[]) => rankBy(list, "wins")[0]?.record;
    const driver = best(records.drivers);
    const team = best(records.teams);
    expect(driver).toBeDefined();
    expect(team).toBeDefined();
    expect(textOf(html)).toContain(driverName(driver?.id ?? ""));
    expect(html).toContain(labelsFor(records.teams, teamName).get(team?.id ?? "")?.name);
  });

  it("names a team as itself, not as an entry", () => {
    // "Williams-Ford" names an *entry*, and an entry is a season; a career
    // crosses engine deals, so the hyphen has no year to be true in. Searched
    // rather than named, because who supplied whom is data that moves.
    const supplied = records.teams.flatMap((record) => {
      const world = seasons.find((season) => season.year === record.lastYear);
      const engineId = world?.field.find((entrant) => entrant.teamId === record.id)?.engineId;
      const entry = entryName(record.id, engineId, record.lastYear);
      return entry === teamName(record.id, record.lastYear) ? [] : [entry];
    });
    expect(supplied.length, "no team in the fixture ran someone else's engine").toBeGreaterThan(0);
    for (const entry of supplied) {
      expect(html, entry).not.toContain(entry);
    }
  });

  it("carries no champion's accent", () => {
    // One accented row per view is the rule, and this screen spends it on the
    // season just finished. Eight cards each accenting their own leader would
    // turn "the thing you just watched" into decoration.
    expect(html).not.toContain(STANDOUT_ROW);
    expect(html).not.toContain(STANDOUT_POSITION);
  });

  it("flies a flag beside every name, as every other table does", () => {
    const flags = (markup: string) => (markup.match(/<svg/g) ?? []).length;
    const drawn = card(records.drivers);
    expect(flags(drawn)).toBe(rows(drawn).length);
  });
});

describe("a driver on a record card", () => {
  const drawn = card(records.drivers);

  it("is named alone — no team, and no badge", () => {
    // A career total is the whole of a driver's era, and most of them drove for
    // several teams in it: labelling the row with the last one attributes a
    // decade of somebody else's cars to whoever was running them at the end.
    // `TEAM_LINE` is the marker for the second line, `BADGE_SHAPE` for the
    // livery disc — the same way every other test here asks about a badge.
    expect(drawn).not.toContain(TEAM_LINE);
    expect(drawn).not.toContain(BADGE_SHAPE);
  });

  it("never opens into anything", () => {
    // People are not renamed, so a driver's row has one spell and no chevron.
    expect(drawn).not.toContain("aria-expanded");
  });
});

/** The 1954-55 works team, and the lineage that races as Mercedes today. */
const worksMercedes = career("mercedes", {
  wins: 5,
  lastYear: 1955,
  spells: [spell("Mercedes", { wins: 5, firstYear: 1954, lastYear: 1955 })],
});
const modernMercedes = career("tyrrell", {
  wins: 90,
  lastYear: 2026,
  spells: [
    spell("Tyrrell", { wins: 10, firstYear: 1970, lastYear: 1998 }),
    spell("Mercedes", { wins: 80, firstYear: 2010, lastYear: 2026 }),
  ],
});

/**
 * A lineage that was repainted without being renamed, and two seasons of it in
 * different colours.
 *
 * Searched rather than named, because which team changed livery when is data.
 * It is the shape the rule needs: one name, two liveries, so "the colours of
 * the year it scored" and "the colours of the year it stopped" differ.
 */
const repainted = (() => {
  for (const id of teamsById().keys()) {
    let earliest: number | null = null;
    for (const year of PLAYABLE_SEASONS) {
      if (earliest === null || teamName(id, year) !== teamName(id, earliest)) {
        earliest = year;
        continue;
      }
      const early = liveryFor(id, earliest);
      const late = liveryFor(id, year);
      if (
        early !== undefined &&
        late !== undefined &&
        badgeBackground(early) !== badgeBackground(late)
      ) {
        // The backgrounds travel with the years, so the test never has to ask
        // again whether a livery it has already found exists.
        return {
          id,
          early: earliest,
          late: year,
          earlyBackground: badgeBackground(early),
          lateBackground: badgeBackground(late),
        };
      }
    }
  }
  throw new Error("no team in the seed data was repainted without being renamed");
})();

describe("the colours a record is drawn in", () => {
  it("uses the livery of the season the figure was scored in", () => {
    // Not the livery of the last season under the name: `toleman` raced as
    // Renault until 2020 and won its title in the middle of that, and the row
    // wearing the later colours is a record shown in a livery that never won
    // anything.
    const scored = { titles: repainted.early, wins: repainted.early, podiums: null, poles: null };
    const drawn = card(
      [
        career(repainted.id, {
          wins: 6,
          lastYear: repainted.late,
          spells: [
            spell(teamName(repainted.id, repainted.early), {
              wins: 6,
              firstYear: repainted.early,
              lastYear: repainted.late,
              scored,
            }),
          ],
        }),
      ],
      "team",
    );
    expect(drawn).toContain(repainted.earlyBackground);
    expect(drawn).not.toContain(repainted.lateBackground);
  });
});

describe("naming a lineage on a card", () => {
  it("uses the name it won the most under, not the one it goes by now", () => {
    // `tyrrell` is called Mercedes today, so a card of a statistic it took as
    // Tyrrell must say Tyrrell — the row is about the record, not the badge on
    // the garage this year.
    const titles = career("tyrrell", {
      titles: 3,
      lastYear: 2026,
      spells: [
        spell("Tyrrell", { titles: 3, firstYear: 1970, lastYear: 1998 }),
        spell("Mercedes", { titles: 0, firstYear: 2010, lastYear: 2026 }),
      ],
    });
    const drawn = renderToStaticMarkup(
      <RecordCard title="Championships" records={[titles]} metric="titles" kind="team" />,
    );
    expect(drawn).toContain(teamName("tyrrell", 1998));
    expect(drawn).not.toContain(teamName("tyrrell", 2026));
  });

  it("gives a lineage the same name and colours on every card", () => {
    // Its titles taken under the first name, most of its wins under the
    // second: a card per figure would otherwise name it twice, as two teams.
    const split = career(repainted.id, {
      titles: 1,
      wins: 6,
      podiums: 6,
      poles: 6,
      lastYear: repainted.late,
      spells: [
        spell("First", {
          titles: 1,
          wins: 1,
          firstYear: repainted.early,
          lastYear: repainted.early,
          scored: { titles: repainted.early, wins: repainted.early, podiums: null, poles: null },
        }),
        spell("Second", {
          wins: 5,
          podiums: 6,
          poles: 6,
          firstYear: repainted.late,
          lastYear: repainted.late,
          scored: {
            titles: null,
            wins: repainted.late,
            podiums: repainted.late,
            poles: repainted.late,
          },
        }),
      ],
    });
    for (const metric of ["titles", "wins", "podiums", "poles"] as const) {
      const drawn = renderToStaticMarkup(
        <RecordCard title={metric} records={[split]} metric={metric} kind="team" />,
      );
      expect(drawn, metric).toContain(teamName(repainted.id, repainted.early));
      expect(drawn, metric).toContain(repainted.earlyBackground);
      expect(drawn, metric).not.toContain(repainted.lateBackground);
    }
  });

  it("tells two teams of the same name apart by their years", () => {
    // Two lineages of one name in the same run, and a card listing both is
    // otherwise the same word twice.
    const name = teamName("mercedes", 1955);
    const [first, second] = rows(card([modernMercedes, worksMercedes], "team"));
    expect(first).toContain(name);
    expect(first).toContain("(2010–2026)");
    expect(second).toContain(name);
    expect(second).toContain("(1954–1955)");
  });

  it("shows the years even when the other holder is nowhere on the card", () => {
    // The other Mercedes won nothing, so the wins card leaves it out — but it
    // raced in the run under that name, and a bare "Mercedes" is one of two.
    const winless = career("mercedes", {
      lastYear: 1955,
      spells: [spell("Mercedes", { firstYear: 1954, lastYear: 1955 })],
    });
    const drawn = card([modernMercedes, winless], "team");
    expect(rows(drawn)).toHaveLength(1);
    expect(drawn).toContain("(2010–2026)");
  });

  it("leaves the years off a name no other lineage of the run held", () => {
    // Whoever else held it in the database, the reader never met them here.
    const drawn = card([modernMercedes], "team");
    expect(drawn).toContain(teamName("tyrrell", 2026));
    expect(drawn).not.toContain("(2010–2026)");
  });
});

describe("a team that raced under more than one name", () => {
  const ranked: RankedRecord = {
    record: career("tyrrell", {
      wins: 100,
      lastYear: 2026,
      spells: [
        spell("Tyrrell", { wins: 10, firstYear: 1970, lastYear: 1998 }),
        spell("BAR", { wins: 1, firstYear: 1999, lastYear: 2004 }),
        spell("Honda", { wins: 0, firstYear: 2006, lastYear: 2008 }),
        spell("Brawn", { wins: 9, firstYear: 2009, lastYear: 2009 }),
        spell("Mercedes", { wins: 80, firstYear: 2010, lastYear: 2026 }),
      ],
    }),
    value: 100,
    position: 1,
    shared: false,
  };
  const row = (open: boolean): string =>
    renderToStaticMarkup(
      <table>
        <tbody>
          <RecordRow ranked={ranked} kind="team" metric="wins" open={open} onToggle={noop} />
        </tbody>
      </table>,
    );
  const shut = row(false);
  const wide = row(true);

  it("shows the total under the name it goes by now", () => {
    expect(shut).toContain(teamName("tyrrell", 2026));
    expect(shut).toContain(">100<");
  });

  it("says on the shut row that the total is more than one name", () => {
    // The chevron alone does not say what is behind it, and an aggregate that
    // did not announce itself would quietly claim a Tyrrell decade for a name
    // that did not exist for it. Four, not five: a name that won nothing is not
    // one of the names it was won under.
    expect(shut).toContain("under 4 names");
    expect(shut).toContain('aria-expanded="false"');
    expect(wide).toContain('aria-expanded="true"');
  });

  it("breaks the total down by name when it is opened, biggest first", () => {
    const spells = rows(wide).slice(1);
    expect(spells.map((row) => row.match(/as ([A-Za-z ]+?) </)?.[1])).toEqual([
      "Mercedes",
      "Tyrrell",
      "Brawn",
      "BAR",
    ]);
    expect(wide).toContain("(2010–2026)");
    // A single season is one year, not a span of it to itself.
    expect(wide).toContain("(2009)");
    // The parts add up to the row above them.
    const figures = spells.map((row) => Number(row.match(/>(\d+)<\/td>/)?.[1]));
    expect(figures.reduce((sum, figure) => sum + figure, 0)).toBe(ranked.value);
  });

  it("writes a name that was taken back as its stretches", () => {
    // One row, because a name taken back is the same name — but the years it
    // spent called something else belong to another row of the expansion.
    const march = renderToStaticMarkup(
      <table>
        <tbody>
          <RecordRow
            ranked={{
              record: career("march", {
                wins: 9,
                lastYear: 1996,
                spells: [
                  spell("March", {
                    wins: 6,
                    firstYear: 1970,
                    lastYear: 1996,
                    segments: [
                      { from: 1970, to: 1989 },
                      { from: 1992, to: 1996 },
                    ],
                  }),
                  spell("Leyton House", { wins: 3, firstYear: 1990, lastYear: 1991 }),
                ],
              }),
              value: 9,
              position: 1,
              shared: false,
            }}
            kind="team"
            metric="wins"
            open
            onToggle={noop}
          />
        </tbody>
      </table>,
    );
    expect(march).toContain("under 2 names");
    expect(march).toContain("(1970–1989, 1992–1996)");
    expect(march).toContain("(1990–1991)");
  });

  it("keeps the breakdown out of the shut row, and badges nothing inside it", () => {
    // A badge marks the row you can see, not the panel it opens.
    expect(shut).not.toContain("as ");
    expect(rows(shut)).toHaveLength(1);
    expect(wide.split(BADGE_SHAPE)).toHaveLength(2);
  });

  it("leaves a lineage that only ever had one name shut", () => {
    const only: RankedRecord = {
      record: career("ferrari", { wins: 5, spells: [spell("Ferrari", { wins: 5 })] }),
      value: 5,
      position: 2,
      shared: false,
    };
    const drawn = renderToStaticMarkup(
      <table>
        <tbody>
          <RecordRow ranked={only} kind="team" metric="wins" open onToggle={noop} />
        </tbody>
      </table>,
    );
    expect(drawn).not.toContain("aria-expanded");
    expect(drawn).not.toContain("names");
    expect(rows(drawn)).toHaveLength(1);
  });
});

describe("one record card", () => {
  const shut = card(many);

  it("shows the top ten and hides the rest behind a button", () => {
    expect(rows(shut)).toHaveLength(10);
    expect(shut).toContain(`Show all ${many.length}`);
    expect(shut).toContain('aria-expanded="false"');
  });

  it("offers nothing to open when everyone already fits", () => {
    const short = card(many.slice(0, 4));
    expect(rows(short)).toHaveLength(4);
    expect(short).not.toContain("Show all");
  });

  it("numbers the places, and marks a shared one", () => {
    const tied = card([
      career("a", { wins: 4 }),
      career("b", { wins: 4 }),
      career("c", { wins: 2 }),
    ]);
    const places = [...tied.matchAll(/>(=?\d+)</g)].map((match) => match[1]);
    // Position then figure, row by row: two firsts, then third.
    expect(places).toEqual(["=1", "4", "=1", "4", "3", "2"]);
  });

  it("says so rather than drawing a blank panel when nobody qualifies", () => {
    const empty = card([career("a"), career("b")]);
    expect(empty).toContain("Nobody has one yet.");
    expect(rows(empty)).toHaveLength(0);
  });
});
