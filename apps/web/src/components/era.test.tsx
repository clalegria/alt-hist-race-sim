/**
 * The two screens the era mode adds: the year it starts from, and the roll of
 * honour between years.
 *
 * Both take everything as props, so they render through `renderToStaticMarkup`
 * with no DOM and no store — the same split as `MainMenu` and `SeasonView`, and
 * the only level at which the disabled years and an era's last page can be
 * looked at at all.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eraChampions, eraSpan } from "../lib/era.js";
import { STANDOUT_ROW } from "../lib/highlight.js";
import { driverName, entryName, teamName } from "../lib/names.js";
import { revealYear } from "../lib/reveal.js";
import {
  DEFAULT_SEASON_YEAR,
  decadeOf,
  isPlayable,
  nextEraYear,
  PLAYABLE_SEASONS,
  yearsInDecade,
} from "../lib/seasons.js";
import { createWorld, type EraRun, type World } from "../store/season.js";
import { textOf, YEAR } from "../test-support.js";
import { ChampionRow, EraChampions, RESTACK, RollOfHonour } from "./EraChampions.js";
import { EraPicker } from "./SeasonPicker.js";
import { BADGE_SHAPE } from "./TeamBadge.js";

const noop = () => {};

/** The last year an era can reach, off the data rather than written down. */
const LAST_YEAR = PLAYABLE_SEASONS.at(-1) ?? YEAR;

/** A run of consecutive seasons ending at `last`. Any seeds would do. */
function runTo(last: number, length: number): EraRun {
  const seasons: World[] = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    seasons.push(createWorld(offset + 1, last - offset));
  }
  return { startYear: last - length + 1, seasons };
}

const run = runTo(YEAR + 2, 3);
/** One crowned year of it, for the row that opens into its full standings. */
const opened = eraChampions(run.seasons)[1] ?? eraChampions(run.seasons)[0];
if (opened === undefined) {
  throw new Error("the fixture run crowned nothing");
}
const html = renderToStaticMarkup(<EraChampions run={run} />);
/**
 * The roll of honour on its own.
 *
 * The screen is two readings of the same seasons — the record, then the career
 * statistics under it — and the tests below are about the record's table. Once
 * the second half existed, counting rows or flags across the whole screen was
 * counting the wrong thing.
 */
const honour = (seasons: readonly World[]): string =>
  renderToStaticMarkup(<RollOfHonour seasons={eraChampions(seasons)} />);
const roll = honour(run.seasons);

/** The years the fixture run covers, as the header writes them. */
function eraChampionYears(): string {
  return eraSpan(eraChampions(run.seasons));
}

/**
 * A crowned season where the champion team ran an engine it did not build, so
 * its entry name and its team name are two different strings.
 *
 * Searched rather than named: who wins depends on every rating in the pool and
 * on the seed, and both move. What the test below needs is the *shape* — a row
 * where naming the entry and naming the team would give different answers.
 */
const badged = (() => {
  for (const year of PLAYABLE_SEASONS) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const world = createWorld(seed, year);
      const champion = constructorStandings(world.season, world.points)[0];
      if (champion === undefined) {
        continue;
      }
      const engine = world.field.find((entrant) => entrant.teamId === champion.teamId)?.engineId;
      const entry = entryName(champion.teamId, engine);
      if (entry !== teamName(champion.teamId)) {
        return {
          world,
          teamId: champion.teamId,
          entry,
          run: { startYear: year, seasons: [world] },
        };
      }
    }
  }
  throw new Error("no season crowns a team running someone else's engine");
})();

/** Every `<tr>` of the roll of honour, header included. */
function rows(markup: string): string[] {
  return markup.split("<tr").slice(1);
}

/** Who a season crowned, derived the way every other table here derives it. */
function champions(world: World): { driver: string; team: string } {
  const driver = championshipStandings(world.season, world.points)[0];
  const team = constructorStandings(world.season, world.points)[0];
  if (driver === undefined || team === undefined) {
    throw new Error(`${world.year} crowned nobody`);
  }
  return { driver: driverName(driver.driverId), team: teamName(team.teamId) };
}

describe("the roll of honour", () => {
  it("lists every season the era has crowned, in the order they were raced", () => {
    const years = rows(roll)
      .flatMap((row) => [...row.matchAll(/>(\d{4})</g)].map((match) => match[1]))
      .map(Number);
    expect(years).toEqual(run.seasons.map((world) => world.year));
  });

  it("names both champions of each of them", () => {
    for (const world of run.seasons) {
      const won = champions(world);
      expect(textOf(html), `${world.year} drivers`).toContain(won.driver);
      expect(html, `${world.year} teams`).toContain(won.team);
    }
  });

  it("flies a flag beside every name, as every other table does", () => {
    // Two per season: the drivers' champion and the constructors' champion.
    expect((roll.match(/<svg/g) ?? []).length).toBe(run.seasons.length * 2);
  });

  it("accents the season just finished, and only that one", () => {
    // The same accent the summary gave the same two names a click ago: whoever
    // won the thing on screen looks the same wherever you meet them. Exactly
    // one row carries it, which is the rule across every view here.
    const accented = rows(html).filter((row) => row.includes(STANDOUT_ROW));
    expect(accented).toHaveLength(1);
    expect(accented[0]).toContain(`>${run.seasons.at(-1)?.year}<`);
  });

  it("says how far the era has come", () => {
    expect(html).toContain(`${run.seasons.length} seasons run`);
    // The span off the seasons actually crowned, not off the starting year and
    // a count: the two agree today and a later mode could make them disagree.
    expect(html).toContain(`${eraChampionYears()} · `);
  });

  it("counts one season as one, rather than as 1 seasons", () => {
    const single = renderToStaticMarkup(<EraChampions run={runTo(YEAR, 1)} />);
    expect(single).toContain("One season run");
    expect(single).not.toContain("1 seasons");
  });

  it("names the year that comes next", () => {
    const next = nextEraYear(YEAR + 2);
    expect(next).not.toBeNull();
    expect(html).toContain(`Next comes ${next}`);
  });

  it("says so when there is no season left to run", () => {
    // The era stops where the authored data does, so the last page must offer
    // an ending rather than a year that cannot be simulated.
    const ended = renderToStaticMarkup(<EraChampions run={runTo(LAST_YEAR, 2)} />);
    expect(nextEraYear(LAST_YEAR)).toBeNull();
    expect(ended).toContain("the era ends here");
    expect(ended).not.toContain("Next comes");
  });

  it("heads an unfinished era as a tally, and an ended one as the whole record", () => {
    expect(html).toContain("Champions so far");
    const ended = renderToStaticMarkup(<EraChampions run={runTo(LAST_YEAR, 2)} />);
    expect(ended).toContain("All champions");
    expect(ended).not.toContain("Champions so far");
  });

  it("accents no year once the era has ended", () => {
    // The accent marks the year just finished on the way to the next; with no
    // next, the last year is one row of the record like the others.
    const ended = renderToStaticMarkup(<EraChampions run={runTo(LAST_YEAR, 2)} />);
    expect(rows(ended).filter((row) => row.includes(STANDOUT_ROW))).toHaveLength(0);
  });

  it("names each team as the entry it was that season", () => {
    // Every row publishes its **own** season's engine supply, so a team is named
    // as the entry it actually was — "Lotus-Climax", not "Lotus". The roll of
    // honour is the only table in the app that spans more than one year, which
    // is exactly where a missing supply would go unnoticed: most rows would
    // read correctly anyway, because a works team is named after itself.
    //
    // So the fixture is *searched for* rather than assumed: a season whose
    // constructors' champion ran somebody else's engine, which is the only kind
    // of row where the two names differ at all.
    const row = rows(honour(badged.run.seasons)).find((candidate) =>
      candidate.includes(`>${badged.world.year}<`),
    );
    expect(row).toBeDefined();
    expect(badged.entry).not.toBe(teamName(badged.teamId));
    expect(row).toContain(badged.entry);
  });

  it("heads the page with its one h1", () => {
    expect(html.split("<h1").length - 1).toBe(1);
    expect(textOf(html.slice(html.indexOf("<h1"), html.indexOf("</h1>")))).toBe("Champions so far");
  });
});

/** A row's cells a phone hides: cells, not the short labels inside a heading. */
function hiddenCells(row: string): number {
  return [...row.matchAll(/<t[hd] [^>]*class="([^"]*)"/g)].filter(([, classes = ""]) =>
    classes.split(" ").includes(RESTACK.wins),
  ).length;
}

describe("the roll of honour on a phone", () => {
  it("restacks every row rather than scrolling, header included", () => {
    // As React writes the attribute, with the child combinators escaped.
    expect(roll).toContain(RESTACK.table.replaceAll("&", "&amp;").replaceAll(">", "&gt;"));
    for (const row of rows(roll)) {
      expect(row).toContain(RESTACK.row);
    }
  });

  it("sets each champion over the other, with their points beside them", () => {
    for (const row of rows(roll)) {
      for (const cell of [RESTACK.driver, RESTACK.driverPoints, RESTACK.team, RESTACK.teamPoints]) {
        expect(row.split(cell).length - 1).toBe(1);
      }
    }
  });

  it("leaves both wins columns to wider screens", () => {
    for (const row of rows(roll)) {
      expect(hiddenCells(row)).toBe(2);
    }
  });

  it("restacks the year in progress the same way", () => {
    const year = revealYear(createWorld(5, YEAR + 3), { kind: "race", round: 0 });
    const markup = renderToStaticMarkup(
      <RollOfHonour seasons={eraChampions(run.seasons)} inProgress={year} />,
    );
    const last = rows(markup).at(-1) ?? "";
    expect(last).toContain(RESTACK.row);
    expect(hiddenCells(last)).toBe(2);
  });
});

describe("a year opened out of the roll of honour", () => {
  // Controlled, so both states render on their own — a click is exactly what
  // this level of test cannot make.
  const row = (open: boolean): string =>
    renderToStaticMarkup(
      <table>
        <tbody>
          <ChampionRow season={opened} latest={false} open={open} onToggle={noop} />
        </tbody>
      </table>,
    );
  const shut = row(false);
  const wide = row(true);

  it("offers the year itself as the control", () => {
    // The same affordance the championship tables and the calendar use: the
    // name is the button, with a chevron, rather than a second tab stop.
    expect(shut).toContain('aria-expanded="false"');
    expect(shut).toContain("▶");
    expect(wide).toContain('aria-expanded="true"');
  });

  it("badges both champions on the row, and nothing inside the expansion", () => {
    // Two on a crowned row — the drivers' champion and the constructors' — and
    // none in what the click reveals, which is the rule everywhere: an
    // expansion repeating the screen above it is noise rather than detail.
    const badges = (html: string) => html.split(BADGE_SHAPE).length - 1;
    expect(badges(shut)).toBe(2);
    expect(badges(wide)).toBe(2);
  });

  it("marks the opened panel, so the stripes skip it", () => {
    // The stripe rule in `index.css` counts rows `:not([data-expansion])`;
    // without the mark, opening a year would flip every stripe below it.
    expect(shut).not.toContain("data-expansion");
    expect(wide.split("data-expansion").length - 1).toBe(1);
    // And the tables inside it stripe their own rows.
    const bodies = wide.split("<tbody").slice(2);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.slice(0, body.indexOf(">"))).toContain("striped");
    }
  });

  it("shows both championships of that year when it is open", () => {
    expect(wide).toContain("Drivers’ Championship");
    expect(wide).toContain("Constructors’ Championship");
  });

  it("shows the whole classification, not a top few", () => {
    // Every driver who took a seat that year has a row, however far down they
    // finished — this is the season's final table, the same one its summary
    // ended on.
    for (const entrant of opened.world.field) {
      expect(textOf(wide), entrant.driverId).toContain(driverName(entrant.driverId));
    }
  });

  it("shows that year's season and nobody else's", () => {
    // The panel is handed one world out of many, and every year of an era looks
    // plausible in the others' clothes — so the check is a driver who raced in
    // a different year of this run and not in this one.
    const elsewhere = run.seasons.find((world) => world.year !== opened.year);
    const outsider = elsewhere?.field
      .map((entrant) => entrant.driverId)
      .find((driverId) => !opened.world.field.some((entrant) => entrant.driverId === driverId));
    if (outsider === undefined) {
      throw new Error("the fixture years enter exactly the same drivers");
    }
    expect(textOf(wide)).not.toContain(driverName(outsider));
  });

  it("keeps all of it out of the closed row", () => {
    expect(shut).not.toContain("Championship");
    expect(shut).not.toContain(">Poles<");
    // The champion is still named on the row itself, open or shut.
    expect(textOf(shut)).toContain(champions(opened.world).driver);
  });
});

describe("the era picker", () => {
  const picker = renderToStaticMarkup(<EraPicker onStart={noop} />);

  it("asks for the year the era starts from", () => {
    expect(picker).toContain("Simulate an era");
    expect(picker).toContain("Pick the year to start from");
  });

  it("says where the era can run to, off the data rather than a fixed year", () => {
    expect(picker).toContain(`until ${LAST_YEAR}`);
  });

  it("offers exactly the years an era can be started from", () => {
    // The same rule as the season picker, because it is the same picker: an era
    // cannot start in a year nobody has authored. Only the open decade is drawn
    // now, so the count is that decade's, derived rather than written down.
    const open = yearsInDecade(decadeOf(DEFAULT_SEASON_YEAR));
    const buttons = picker.split("<button").slice(1);
    for (const year of open.filter(isPlayable)) {
      expect(picker, `${year}`).toContain(`aria-label="Start an era in ${year}"`);
    }
    const drawn = buttons.filter((button) => open.some((year) => button.includes(`>${year}<`)));
    expect(drawn).toHaveLength(open.length);
  });

  it("commits on its own button, which says an era rather than a season", () => {
    // The era and the season share one component, so the one thing that must
    // not be shared is the sentence on the button that starts the run.
    expect(picker).toContain(`Begin an era from ${DEFAULT_SEASON_YEAR}`);
    expect(picker).not.toContain("Begin the");
  });
});
