/**
 * The career panel behind a name, on the champions screen and every table of a
 * season.
 *
 * Two levels, because the panel itself is a Radix popover and Radix does not
 * render one while it is shut — the same limit `web-testing.md` records. So what a
 * panel *says* is tested where it is decided, in `lib/history.ts`, against
 * worlds that were actually simulated; and what a screen *offers* is tested in
 * the markup, by asking whether a name became a control.
 *
 * Nothing here asserts an authored number or what a seed produced: every
 * expectation is a relationship between two derivations of the same results.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eraChampions } from "../lib/era.js";
import {
  figuresLine,
  isTitle,
  lineupOf,
  ordinal,
  placeLabel,
  seasonHistories,
  type TeamSeason,
} from "../lib/history.js";
import type { CareerSpell, RankedRecord } from "../lib/records.js";
import { careerRecords, rankBy } from "../lib/records.js";
import { teamRounds } from "../lib/results.js";
import { revealYear } from "../lib/reveal.js";
import { seasonSeed } from "../lib/seasons.js";
import { createWorld, type EraRun, type World } from "../store/season.js";
import { YEAR } from "../test-support.js";
import { CareerStatistics, RecordRow } from "./CareerStatistics.js";
import { CompactStandings } from "./CompactStandings.js";
import { EraChampions, InProgressRow, RollOfHonour } from "./EraChampions.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceByRace } from "./RaceByRace.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonCalendar } from "./SeasonCalendar.js";
import { SeasonHistoryProvider } from "./SeasonHistory.js";
import { SeasonOverview } from "./SeasonOverview.js";
import { StandingsTable } from "./StandingsTable.js";

/** A run of consecutive seasons, the same fixture shape the era tests use. */
function runTo(last: number, length: number): EraRun {
  const seasons: World[] = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    seasons.push(createWorld(offset + 1, last - offset));
  }
  return { startYear: last - length + 1, seasons };
}

const noop = () => {};

const run = runTo(YEAR + 3, 4);
const histories = seasonHistories(run.seasons);

describe("a career, season by season", () => {
  it("gives every driver of the run a line per season they appear in", () => {
    // Two walks of the same results have no excuse to disagree about who was
    // there: the panel's years must be exactly the years the championship
    // tables name them in, in the order they were raced.
    for (const world of run.seasons) {
      for (const standing of championshipStandings(world.season, world.points)) {
        const career = histories.drivers.get(standing.driverId);
        expect(career?.some((season) => season.year === world.year)).toBe(true);
      }
    }
    for (const [driverId, career] of histories.drivers) {
      const years = run.seasons
        .filter((world) =>
          championshipStandings(world.season, world.points).some(
            (standing) => standing.driverId === driverId,
          ),
        )
        .map((world) => world.year)
        .sort((a, b) => a - b);
      expect(career.map((season) => season.year)).toEqual(years);
    }
  });

  it("carries that season's own figures, and the team it was driven for", () => {
    for (const world of run.seasons) {
      const table = championshipStandings(world.season, world.points);
      table.forEach((standing, index) => {
        const season = histories.drivers
          .get(standing.driverId)
          ?.find((each) => each.year === world.year);
        expect(season).toEqual({
          year: world.year,
          teamId: standing.teamId,
          position: index + 1,
          points: standing.points,
          wins: standing.wins,
          podiums: standing.podiums,
          poles: standing.poles,
          afterRound: null,
        });
      });
    }
  });

  it("agrees with the roll of honour about who won each year", () => {
    // First place on a panel and the champion on the row above it are the same
    // fact, and a panel that disagreed with the screen it opened from would be
    // the one bug nobody would think to look for.
    for (const crowned of eraChampions(run.seasons)) {
      const driver = histories.drivers
        .get(crowned.driver?.driverId ?? "")
        ?.find((season) => season.year === crowned.year);
      expect(driver?.position).toBe(1);
      const team = histories.teams
        .get(crowned.team?.teamId ?? "")
        ?.find((season) => season.year === crowned.year);
      expect(team?.position).toBe(1);
    }
  });
});

describe("a team's season", () => {
  it("lists the drivers who scored for it that year, in championship order", () => {
    for (const world of run.seasons) {
      const table = championshipStandings(world.season, world.points);
      for (const standing of constructorStandings(world.season, world.points)) {
        const season = histories.teams
          .get(standing.teamId)
          ?.find((each) => each.year === world.year);
        // The team's own drivers, taken out of the drivers' table rather than
        // out of the panel — same results, other walk.
        const expected = table
          .filter((each) => each.teamId === standing.teamId)
          .map((each) => ({
            driverId: each.driverId,
            position: table.indexOf(each) + 1,
            points: each.points,
          }));
        expect(season?.drivers).toEqual(expected);
        expect(season?.drivers.length).toBeGreaterThan(0);
      }
    }
  });

  it("names every driver with where they finished the drivers' championship", () => {
    const season = [...histories.teams.values()].flat().find((each) => each.drivers.length > 1);
    if (season === undefined) {
      throw new Error("the fixture run has no team that entered two cars");
    }
    const lineup = lineupOf(season);
    expect(lineup).toHaveLength(season.drivers.length);
    lineup.forEach((driver, index) => {
      expect(driver.label).toContain(ordinal(season.drivers[index]?.position ?? 0));
    });
  });

  it("marks the drivers' champion, and nobody else", () => {
    // The same accent the team's own titles take in the column above — one
    // idea meaning "won the thing", not a second one for the same fact.
    const crowned = eraChampions(run.seasons)[0];
    const season = histories.teams
      .get(crowned?.driver?.teamId ?? "")
      ?.find((each) => each.year === crowned?.year);
    if (season === undefined) {
      throw new Error("the champion's team has no season in its own history");
    }
    const lineup = lineupOf(season);
    expect(lineup.filter((driver) => driver.champion)).toHaveLength(1);
    expect(lineup.find((driver) => driver.champion)?.label).toContain("1st");
    // And nobody else, anywhere in the run: the accent means first, not near it.
    for (const each of [...histories.teams.values()].flat()) {
      lineupOf(each).forEach((driver, index) => {
        expect(driver.champion).toBe(each.drivers[index]?.position === 1);
      });
    }
  });

  it("says nothing about a lineup it does not have", () => {
    const empty: TeamSeason = {
      year: 1980,
      position: 4,
      points: 10,
      wins: 0,
      podiums: 0,
      poles: 0,
      afterRound: null,
      drivers: [],
    };
    expect(lineupOf(empty)).toEqual([]);
  });
});

describe("a year still being written", () => {
  // The run's crowned years, then a year cut halfway through its calendar —
  // what the frame hands the panels while the reader is mid-season.
  const live = createWorld(7, YEAR + 4);
  const halfway = Math.floor(live.season.races.length / 2);
  const years = [...run.seasons, revealYear(live, { kind: "race", round: halfway - 1 })];

  it("crowns nobody: titles add up to the finished years only", () => {
    const { drivers, teams } = careerRecords(years);
    const titles = (list: typeof drivers) => list.reduce((sum, each) => sum + each.titles, 0);
    expect(titles(drivers)).toBe(run.seasons.length);
    expect(titles(teams)).toBe(run.seasons.length);
  });

  it("marks every place in it as a place so far, and no finished one", () => {
    const histories = seasonHistories(years);
    const all = [...histories.drivers.values(), ...histories.teams.values()].flat();
    expect(all.some((season) => season.year === live.year)).toBe(true);
    for (const season of all) {
      expect(season.afterRound).toBe(season.year === live.year ? halfway : null);
      if (season.year === live.year) {
        expect(isTitle(season)).toBe(false);
      }
    }
    for (const season of [...histories.teams.values()].flat()) {
      if (season.year === live.year) {
        expect(lineupOf(season).some((driver) => driver.champion)).toBe(false);
      }
    }
  });

  it("says how far through a lead is", () => {
    const base = { year: 1980, position: 1, points: 9, wins: 1, podiums: 1, poles: 0 };
    expect(placeLabel({ ...base, afterRound: null })).toBe("1st");
    expect(placeLabel({ ...base, afterRound: 3 })).toBe("1st after round 3");
    expect(isTitle({ ...base, afterRound: null })).toBe(true);
    expect(isTitle({ ...base, afterRound: 3 })).toBe(false);
  });
});

describe("a season's figures on one line", () => {
  it("always states the points, and states nothing that did not happen", () => {
    // The panel is mostly ordinary seasons. "0 wins · 0 podiums · 0 poles" over
    // and over buries the four lines it was opened for.
    const quiet = figuresLine({
      year: 1980,
      position: 9,
      points: 4,
      wins: 0,
      podiums: 0,
      poles: 0,
      afterRound: null,
    });
    expect(quiet).toBe("4 pts");
    const loud = figuresLine({
      year: 1980,
      position: 1,
      points: 55,
      wins: 4,
      podiums: 7,
      poles: 3,
      afterRound: null,
    });
    expect(loud).toBe("55 pts · 4 wins · 7 podiums · 3 poles");
  });

  it("counts one of a thing in the singular", () => {
    const one = figuresLine({
      year: 1980,
      position: 5,
      points: 9,
      wins: 1,
      podiums: 1,
      poles: 1,
      afterRound: null,
    });
    expect(one).toBe("9 pts · 1 win · 1 podium · 1 pole");
  });

  it("writes a place the way it is read out", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "101st",
      "111th",
    ]);
  });
});

/** Every `<button>` of a render, opening tag onwards. */
function buttons(markup: string): string[] {
  return markup.split("<button").slice(1);
}

/** The ones Radix marked as opening a panel. */
function panelTriggers(markup: string): string[] {
  return buttons(markup).filter((button) => button.includes('aria-haspopup="dialog"'));
}

describe("the champions screen", () => {
  // Inside the provider the run's frame puts around every page.
  const screen = renderToStaticMarkup(
    <SeasonHistoryProvider seasons={run.seasons}>
      <EraChampions run={run} />
    </SeasonHistoryProvider>,
  );

  it("opens a panel from both champions of every crowned year", () => {
    // One for the driver, one for the team, on every row of the roll of honour
    // — plus however many the record cards below it draw.
    const roll = screen.slice(0, screen.indexOf("Driver statistics"));
    expect(panelTriggers(roll)).toHaveLength(run.seasons.length * 2);
  });

  it("opens one from every name on every record card", () => {
    const cards = screen.slice(screen.indexOf("Driver statistics"));
    const records = careerRecords(run.seasons);
    const named = (["titles", "wins", "podiums", "poles"] as const).flatMap((metric) => [
      ...rankBy(records.drivers, metric).slice(0, 10),
      ...rankBy(records.teams, metric).slice(0, 10),
    ]);
    expect(panelTriggers(cards)).toHaveLength(named.length);
  });

  it("draws no panel at all outside a run", () => {
    // The provider is the whole of "is there a history behind this name": a
    // component rendered on its own shows plain text rather than a control
    // that opens an empty panel. Every DOM-less test in this app relies on it.
    const loose = renderToStaticMarkup(<RollOfHonour seasons={eraChampions(run.seasons)} />);
    expect(panelTriggers(loose)).toHaveLength(0);
    expect(renderToStaticMarkup(<CareerStatistics seasons={run.seasons} />)).not.toContain(
      'aria-haspopup="dialog"',
    );
  });
});

describe("a record row that both expands and opens a panel", () => {
  /**
   * A lineage that scored under two names, built rather than searched for.
   *
   * The seed data's renames are real but sparse, and whether a *scoring* team
   * has one inside any given run depends on the years and on the seed. What
   * this test is about is the arrangement of two controls on one row, which is
   * a rule about the component — so the career is synthetic and only the id is
   * taken off the run, since the panel behind the name has to have something
   * in it.
   */
  const teamId = constructorStandings(
    run.seasons[0]?.season ?? { races: [] },
    run.seasons[0]?.points ?? [],
  )[0]?.teamId;
  if (teamId === undefined) {
    throw new Error("the fixture run entered no teams");
  }

  const spell = (name: string, from: number, to: number): CareerSpell => ({
    name,
    firstYear: from,
    lastYear: to,
    segments: [{ from, to }],
    scored: { titles: null, wins: to, podiums: null, poles: null },
    titles: 0,
    wins: 5,
    podiums: 5,
    poles: 0,
    points: 50,
    seasons: 1 + to - from,
  });

  const ranked: RankedRecord = {
    record: {
      id: teamId,
      lastYear: 1994,
      titles: 0,
      wins: 10,
      podiums: 10,
      poles: 0,
      points: 100,
      seasons: 10,
      spells: [spell("Tolerance", 1985, 1989), spell("Persistence", 1990, 1994)],
    },
    value: 10,
    position: 1,
    shared: false,
  };

  const markup = renderToStaticMarkup(
    <SeasonHistoryProvider seasons={run.seasons}>
      <table>
        <tbody>
          <RecordRow ranked={ranked} kind="team" metric="wins" open={false} onToggle={noop} />
        </tbody>
      </table>
    </SeasonHistoryProvider>,
  );

  it("keeps the expansion the row already had", () => {
    // The chevron cannot be folded into the name any more: a name that opens a
    // panel is already a button, and a button inside a button is not a thing.
    // Losing the breakdown by name to the new panel is the failure here — and
    // `aria-expanded` alone does not prove it survived, because Radix marks
    // its own trigger with that too.
    expect(markup).toContain("under 2 names");
    const expander = buttons(markup).filter((button) => !button.includes('aria-haspopup="dialog"'));
    expect(expander).toHaveLength(1);
    expect(expander[0]).toContain('aria-expanded="false"');
  });

  it("puts the career panel on the name beside it", () => {
    expect(panelTriggers(markup)).toHaveLength(1);
  });

  it("gives the two controls one job each, and names the one with no text in it", () => {
    // Two tab stops and no third: the chevron, and the name. Radix marks its
    // own trigger `aria-expanded` too, so the chevron is told apart by *not*
    // opening a panel rather than by carrying that attribute.
    expect(buttons(markup)).toHaveLength(2);
    const expander = buttons(markup).filter((button) => !button.includes('aria-haspopup="dialog"'));
    expect(expander).toHaveLength(1);
    // Its text went with the name, so it has to say what it is out loud.
    expect(expander[0]).toContain("aria-label=");
  });
});

/**
 * The season's own tables, each inside the provider the run's frame supplies.
 *
 * One world, finished, so every name on every table has a career behind it.
 * Each count is taken off the results the table draws — rows, entries, poles
 * and winners — never written down.
 */
describe("names open their panel everywhere", () => {
  const world = run.seasons.at(-1);
  if (world === undefined) {
    throw new Error("the fixture run has no seasons");
  }
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("the fixture season has no races");
  }
  const calendar = seasonSeed(world.year).calendar;
  const drivers = championshipStandings(world.season, world.points);
  const teams = constructorStandings(world.season, world.points);
  const inRun = (node: React.ReactNode) =>
    renderToStaticMarkup(<SeasonHistoryProvider seasons={[world]}>{node}</SeasonHistoryProvider>);

  /** The buttons that open something in place rather than a panel. */
  const expanders = (markup: string) =>
    buttons(markup).filter((button) => !button.includes('aria-haspopup="dialog"'));

  it("gives every row of a championship table a name and a chevron", () => {
    for (const [standings, nameColumn] of [
      [drivers, "Driver"],
      [teams, "Team"],
    ] as const) {
      const markup = inRun(
        <StandingsTable
          title="Championship"
          description=""
          nameColumn={nameColumn}
          standings={standings}
          season={world.season}
          points={world.points}
          calendar={calendar}
        />,
      );
      expect(panelTriggers(markup), nameColumn).toHaveLength(standings.length);
      // The race-by-race survived the name becoming a panel, and says what it is.
      expect(expanders(markup), nameColumn).toHaveLength(standings.length);
      for (const expander of expanders(markup)) {
        expect(expander).toContain("aria-label=");
      }
    }
  });

  it("opens one from every name in the sidebar", () => {
    for (const standings of [drivers, teams]) {
      const markup = inRun(<CompactStandings title="Championship" standings={standings} />);
      const rows = markup.split("<tr").length - 1;
      expect(panelTriggers(markup)).toHaveLength(rows);
    }
  });

  it("opens one from every car on the classification and the grid", () => {
    expect(
      panelTriggers(inRun(<RaceClassification race={race} points={world.points} />)),
    ).toHaveLength(race.entries.length);
    expect(panelTriggers(inRun(<QualifyingResults race={race} />))).toHaveLength(
      race.entries.length,
    );
  });

  it("opens one from every pole-sitter and winner on the calendar", () => {
    const teamFor = new Map(world.field.map((entrant) => [entrant.driverId, entrant.teamId]));
    const named = world.season.races.reduce(
      (sum, each) => sum + 1 + (each.winnerDriverId === null ? 0 : 1),
      0,
    );
    const markup = inRun(
      <SeasonCalendar
        season={world.season}
        calendar={calendar}
        points={world.points}
        teamFor={teamFor}
      />,
    );
    expect(panelTriggers(markup)).toHaveLength(named);
  });

  it("opens one from every driver of a team's race by race", () => {
    const teamId = teams[0]?.teamId ?? "";
    const rounds = teamRounds(world.season, world.points, teamId);
    const markup = inRun(<RaceByRace rounds={rounds} calendar={calendar} showDriver />);
    expect(panelTriggers(markup)).toHaveLength(rounds.length);
  });

  it("opens one from both champions' cards on the season page", () => {
    const page = (html: string) => html.slice(0, html.indexOf("<table"));
    const overview = (
      <SeasonOverview world={revealYear(world, { kind: "summary" })} finished tab="calendar" />
    );
    // The cards come before the first table, whose names open panels of their own.
    expect(panelTriggers(page(inRun(overview)))).toHaveLength(2);
    expect(panelTriggers(page(renderToStaticMarkup(overview)))).toHaveLength(0);
  });

  it("opens one from both leaders of the year in progress", () => {
    // After the first race: leaders, but nobody crowned.
    const live = revealYear(world, { kind: "race", round: 0 });
    const markup = renderToStaticMarkup(
      <SeasonHistoryProvider seasons={[live]}>
        <table>
          <tbody>
            <InProgressRow world={live} />
          </tbody>
        </table>
      </SeasonHistoryProvider>,
    );
    expect(panelTriggers(markup)).toHaveLength(2);
  });
});
