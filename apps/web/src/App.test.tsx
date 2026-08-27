/**
 * The reveal flow, stage by stage.
 *
 * `SeasonView` takes the world and the cursor as props, so every stage can be
 * rendered directly with `renderToStaticMarkup` — no DOM, no store, and no need
 * to click through fourteen rounds to see what round fourteen looks like. The
 * buttons are covered separately through `actionsFor`, which is the whole of the
 * navigation logic.
 */

import {
  championshipStandings,
  constructorStandings,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  type SeasonResult,
} from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { actionsFor, eraActionsFor, SeasonScreen } from "./App.js";
import { SeasonView } from "./components/SeasonView.js";
import { STANDOUT_ROW } from "./lib/highlight.js";
import { driverName, teamName } from "./lib/names.js";
import { driverOverall } from "./lib/rating.js";
import { adjacentSeason, PLAYABLE_SEASONS } from "./lib/seasons.js";
import type { EraRun, View, World } from "./store/season.js";
import {
  findWorld,
  OVERSUBSCRIBED_YEAR,
  SEED,
  seededWorld,
  starterCount,
  teamCount,
} from "./test-support.js";

const world = seededWorld();
/** The ends of the authored range, off the data: an era runs between them. */
const FIRST_PLAYABLE = PLAYABLE_SEASONS[0] ?? 0;
const LAST_PLAYABLE = PLAYABLE_SEASONS.at(-1) ?? 0;
const ROUNDS = world.season.races.length;
/** Read off the grid, never written down: the field is going to grow. */
const SEATS = world.field.length;
const TEAMS = teamCount(world);
const STARTERS = starterCount(world);
/** Round names come from the authored calendar, which is being re-authored too. */
const FIRST_ROUND = SEED.calendar[0];
const LAST_ROUND = SEED.calendar.at(-1);
if (FIRST_ROUND === undefined || LAST_ROUND === undefined) {
  throw new Error("the authored season has no calendar");
}

function render(view: View, of: World = world): string {
  return renderToStaticMarkup(<SeasonView world={of} view={view} />);
}

describe("the opening grid", () => {
  const html = render({ kind: "grid" });

  it("shows the teams and their drivers", () => {
    for (const entrant of world.field) {
      expect(html, entrant.driverId).toContain(driverName(entrant.driverId));
      expect(html, entrant.teamId).toContain(teamName(entrant.teamId));
    }
  });

  it("reveals nothing about the season yet", () => {
    // The point of starting here: no results, no standings, no championship.
    expect(html).not.toContain("Championship");
    expect(html).not.toContain("Qualifying");
    expect(html).not.toContain(FIRST_ROUND.name);
    expect(html).not.toContain("Pts");
  });
});

describe("the shortcut to the season next door", () => {
  const label = (year: number) => `Simulate the ${year} season instead`;

  it("offers both neighbours on the grid of a season with one either side", () => {
    // Mid-range, off the playable list: a fixture at either end would draw one
    // button and the test would pass without proving the pair.
    const middle = PLAYABLE_SEASONS[1];
    if (middle === undefined) {
      throw new Error("the fixtures need at least three authored seasons");
    }
    const grid = render({ kind: "grid" }, seededWorld(3, undefined, middle));
    expect(grid).toContain(label(adjacentSeason(middle, -1) ?? 0));
    expect(grid).toContain(label(adjacentSeason(middle, 1) ?? 0));
  });

  it("draws only the one that exists at the end of the range", () => {
    const last = render({ kind: "grid" }, seededWorld(3, undefined, LAST_PLAYABLE));
    expect(last).toContain(label(adjacentSeason(LAST_PLAYABLE, -1) ?? 0));
    expect(last).not.toContain(String(LAST_PLAYABLE + 1));

    const first = render({ kind: "grid" }, seededWorld(3, undefined, FIRST_PLAYABLE));
    expect(first).toContain(label(adjacentSeason(FIRST_PLAYABLE, 1) ?? 0));
    expect(first).not.toContain(String(FIRST_PLAYABLE - 1));
  });

  it("stays off every page after the grid", () => {
    // Switching year past the grid would throw away results already revealed,
    // exactly as switching the ability model would.
    for (const view of [
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "summary" },
    ] as const) {
      expect(render(view), view.kind).not.toContain("Another year");
    }
  });

  it("is not offered inside an era, whose year belongs to the run", () => {
    const inEra = renderToStaticMarkup(
      <SeasonView world={world} view={{ kind: "grid" }} canChooseAbility={false} />,
    );
    expect(inEra).not.toContain("Another year");
    expect(inEra).not.toContain(label(adjacentSeason(world.year, 1) ?? 0));
  });
});

describe("the driver ability toggle", () => {
  const html = render({ kind: "grid" });

  it("offers both modes on the grid, with the world's own marked", () => {
    expect(html).toContain("At their peak");
    expect(html).toContain("At their age");
    // The seeded world is in peak mode, so exactly one button is pressed and it
    // is that one.
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    const fromPressed = html.slice(html.indexOf('aria-pressed="true"'));
    expect(fromPressed.slice(0, fromPressed.indexOf("</button>"))).toContain("At their peak");
  });

  it("says what the chosen mode means, in the season's own year", () => {
    expect(html).toContain("Every driver at the best they ever were");
    expect(html).not.toContain("rookies are raw");
  });

  it("describes the other mode once it is chosen", () => {
    const aged = render({ kind: "grid" }, seededWorld(3, "aged"));
    expect(aged).toContain("rookies are raw");
    expect(aged).toContain(String(world.year));
  });

  it("is not offered at all inside an era, which fixes the ability model", () => {
    // "At their peak" answers a question about one season; an era is the ageing
    // curve's mode by construction, so there is nothing to choose. Both labels,
    // not just the pressed one — a switch drawn with one option greyed out is
    // still a switch.
    const inEra = renderToStaticMarkup(
      <SeasonView world={world} view={{ kind: "grid" }} canChooseAbility={false} />,
    );
    expect(inEra).not.toContain("At their peak");
    expect(inEra).not.toContain("At their age");
    expect(inEra).not.toContain("Driver ability");
    // And the grid it was hiding is still all there: this removes a control,
    // not the page under it.
    for (const entrant of world.field) {
      expect(inEra, entrant.driverId).toContain(driverName(entrant.driverId));
    }
  });

  it("stays off every page after the grid", () => {
    // Switching mid-season would invalidate results already revealed, and the
    // summary ends with a grid that must not offer it either.
    for (const view of [
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "summary" },
    ] as const) {
      expect(render(view), view.kind).not.toContain("At their peak");
    }
  });

  it("ages the grid it is showing", () => {
    // Whoever the curve moves most, rather than a driver named here: the two
    // grids must show different numbers for them.
    const agedWorld = seededWorld(3, "aged");
    const aged = render({ kind: "grid" }, agedWorld);
    const agedOverall = new Map(
      agedWorld.field.map((entrant) => [entrant.driverId, driverOverall(entrant.driver)]),
    );
    const moved = world.field.find(
      (entrant) => agedOverall.get(entrant.driverId) !== driverOverall(entrant.driver),
    );
    if (moved === undefined) {
      throw new Error("no driver on the grid is a different rating at their real age");
    }

    expect(html).toContain(`>${driverOverall(moved.driver)}<`);
    expect(aged).toContain(`>${agedOverall.get(moved.driverId)}<`);
  });
});

describe("a qualifying session", () => {
  const html = render({ kind: "qualifying", round: 0 });

  it("is titled with the round it belongs to", () => {
    expect(html).toContain(FIRST_ROUND.name);
    expect(html).toContain(FIRST_ROUND.circuit);
    expect(html).toContain("Qualifying");
  });

  it("forms up the whole entry list, pole first", () => {
    expect(html).toContain("pole");
    // Everyone who entered gets a slot: those who start, and the DNQs beside.
    expect(html.split("<li").length - 1).toBe(SEATS);
    expect(html.includes("Did not qualify")).toBe(SEATS > STARTERS);
  });

  it("does not leak the race that follows", () => {
    expect(html).not.toContain("Championship");
    expect(html).not.toContain("Retired");
  });
});

describe("a race", () => {
  const html = render({ kind: "race", round: 0 });

  it("shows the classification", () => {
    expect(html).toContain(FIRST_ROUND.name);
    expect(html).toContain("winner");
    const race = world.season.races[0];
    expect(html.includes("Retired")).toBe(race?.entries.some((entry) => entry.retired) === true);
  });

  it("shows both championships as they stand after it", () => {
    expect(html).toContain("Drivers");
    expect(html).toContain("Constructors");
    expect(html).toContain("Championship after 1 round");
  });

  it("says how much of the season is left to run", () => {
    expect(html).toContain(`Championship after 1 round (${ROUNDS - 1} remaining)`);
    expect(render({ kind: "race", round: 3 })).toContain(
      `Championship after 4 rounds (${ROUNDS - 4} remaining)`,
    );
    // Nothing remains after the last one, and "(0 remaining)" reads badly.
    expect(render({ kind: "race", round: ROUNDS - 1 })).not.toContain("remaining");
  });

  it("shows movement arrows from round two onward, never on round one", () => {
    // The contract as a reader meets it, rather than as a prop: on the opening
    // round there is nothing to have moved from.
    expect(html).not.toContain("▲");
    expect(html).not.toContain("▼");

    // A round where the top eight actually reshuffled — searched for, not
    // pinned, since which round that is depends on every rating in the pool.
    const shuffled = (season: SeasonResult, round: number): boolean => {
      const top = (through: number): string[] =>
        championshipStandings({ races: season.races.slice(0, through + 1) }, world.points)
          .slice(0, 8)
          .map((row) => row.driverId);
      const before = top(round - 1);
      return top(round).some((driverId, place) => before[place] !== driverId);
    };
    const round = [...world.season.races.keys()].find(
      (candidate) => candidate > 0 && shuffled(world.season, candidate),
    );
    if (round === undefined) {
      throw new Error("the championship order never changes all season");
    }
    const later = render({ kind: "race", round });
    expect(later).toMatch(/▲|▼/);
  });

  it("counts only the rounds run so far", () => {
    // Standings mid-season are just the championship over fewer results — if
    // this said 14 rounds, the reveal would be showing the finished table.
    expect(render({ kind: "race", round: 4 })).toContain("Championship after 5 rounds");
    expect(render({ kind: "race", round: ROUNDS - 1 })).toContain(
      `Championship after ${ROUNDS} rounds`,
    );
  });

  it("carries points alongside the result, and nothing else", () => {
    // The sidebar exists to be scannable: after one round the full table's
    // wins, podiums and poles are almost all zeroes.
    for (const column of ["Wins", "Pods", "Poles"]) {
      expect(html, `${column} should not be in the race sidebar`).not.toContain(`>${column}<`);
    }
    // The leader's points are on screen, whatever the scale pays for a win.
    const leader = championshipStandings(
      { races: world.season.races.slice(0, 1) },
      world.points,
    )[0];
    expect(leader).toBeDefined();
    expect(html).toContain(`>${leader?.points}<`);
  });

  it("does not show the calendar of races still to come", () => {
    expect(html).not.toContain(LAST_ROUND.circuit);
  });
});

describe("the season summary", () => {
  const html = render({ kind: "summary" });

  it("names both champions", () => {
    expect(html).toContain("Drivers’ champion");
    expect(html).toContain("Constructors’ champion");
    expect(html).toMatch(/points from \d+ wins?\./);
  });

  it("lists every round with its pole and winner", () => {
    for (const race of SEED.calendar) {
      expect(html, race.name).toContain(race.name);
    }
  });

  it("shows the final standings in full, not the compact sidebar", () => {
    expect(html).toContain("Final classification.");
    expect(html).not.toContain("Championship after");
    // The summary is where the full breakdown belongs.
    expect(html).toContain(">Wins<");
    expect(html).toContain(">Poles<");
  });

  it("classifies on results, not on failures", () => {
    // Retirements and non-qualifications are still derived by the engine; the
    // final table just does not report them.
    expect(html).not.toContain(">DNF<");
    expect(html).not.toContain(">DNQ<");
  });

  it("still ends with the grid, in the same simplified form", () => {
    expect(html).toContain("Select any name for its full ratings");
  });
});

describe("flags", () => {
  /** The markup between two landmarks, so a count cannot stray into the next card. */
  const between = (html: string, from: string, to: string): string => {
    const start = html.indexOf(from);
    expect(start, `"${from}" not rendered`).toBeGreaterThan(-1);
    const end = html.indexOf(to, start);
    expect(end, `"${to}" not rendered after "${from}"`).toBeGreaterThan(start);
    return html.slice(start, end);
  };

  it("flies a flag on every name on the race page", () => {
    const html = render({ kind: "race", round: 0 });
    // One for the round, one per car down the classification, then the
    // collapsed sidebar: eight drivers and eight teams.
    expect((html.match(/<svg/g) ?? []).length).toBe(1 + SEATS + 8 + 8);
  });

  it("flies a flag beside every driver in qualifying", () => {
    const html = render({ kind: "qualifying", round: 0 });
    expect((html.match(/<svg/g) ?? []).length).toBe(SEATS + 1); // every car plus the round
  });

  it("keeps the non-qualifiers off the starting grid", () => {
    // Cars outside the cut never form up, so they are listed apart rather than
    // taking a slot that would shift everyone behind them onto the wrong side.
    // A year that actually enters more cars than the grid holds: the fixture
    // season is well inside the starting limit, so nobody misses the cut there.
    const oversubscribed = seededWorld(3, undefined, OVERSUBSCRIBED_YEAR);
    const started = starterCount(oversubscribed);
    expect(started).toBeLessThan(oversubscribed.field.length);
    const html = render({ kind: "qualifying", round: 0 }, oversubscribed);
    const grid = html.slice(0, html.indexOf("Did not qualify"));
    expect(grid.split("<li").length - 1).toBe(started);
  });

  it("flies a flag on both champion cards", () => {
    const html = render({ kind: "summary" });
    const champion = championshipStandings(world.season, world.points)[0];
    const topTeam = constructorStandings(world.season, world.points)[0];
    if (champion === undefined || topTeam === undefined) {
      throw new Error("seeded world crowned nobody");
    }
    // Between the card's label and the name it announces there must be a flag.
    expect(between(html, "Drivers’ champion", driverName(champion.driverId))).toContain("<svg");
    expect(between(html, "Constructors’ champion", teamName(topTeam.teamId))).toContain("<svg");
  });

  it("flies a flag on every row of both championship tables", () => {
    const html = render({ kind: "summary" });
    const drivers = between(html, "Drivers’ Championship", "Constructors’ Championship");
    expect((drivers.match(/<svg/g) ?? []).length).toBe(SEATS);
    const teams = between(html, "Constructors’ Championship", "Grid");
    expect((teams.match(/<svg/g) ?? []).length).toBe(TEAMS);
  });
});

describe("a settled championship", () => {
  /**
   * The first round after which nobody can catch the leader, or null if the
   * title goes to the final round.
   */
  const clinchRound = (of: World, which: "drivers" | "teams"): number | null => {
    const rounds = of.season.races.length;
    for (let round = 0; round < rounds; round += 1) {
      const soFar = { races: of.season.races.slice(0, round + 1) };
      const left = rounds - soFar.races.length;
      const settled =
        which === "drivers"
          ? driversTitleClinchedBy(championshipStandings(soFar, of.points), left, of.points)
          : constructorsTitleClinchedBy(constructorStandings(soFar, of.points), left, of.points);
      if (settled !== null) {
        return round;
      }
    }
    return null;
  };

  /**
   * A season that settles its constructors' title with rounds to spare.
   *
   * Searched for rather than pinned to a seed: whether *this* seed clinches
   * early depends on every rating in the pool, and those move. What the tests
   * below need is the shape, not the number.
   */
  const settled = findWorld((candidate) => {
    const teams = clinchRound(candidate, "teams");
    return (
      teams !== null &&
      teams > 0 &&
      teams < candidate.season.races.length - 1 &&
      clinchRound(candidate, "drivers") !== null
    );
  });
  const teamsClinch = clinchRound(settled, "teams") ?? 0;
  const driversClinch = clinchRound(settled, "drivers") ?? 0;
  const rounds = settled.season.races.length;

  it("says nothing while the title is still live", () => {
    const html = render({ kind: "race", round: teamsClinch - 1 }, settled);
    expect(html).not.toContain("wins the");
  });

  it("announces the clinch on the round it happens", () => {
    const html = render({ kind: "race", round: teamsClinch }, settled);
    expect(html).toContain("wins the Constructors’ Championship");
  });

  it("says it once and then stops", () => {
    // The banner is an event, not a standing notice. Repeating it every
    // remaining round turns the moment the season built to into wallpaper.
    for (let round = teamsClinch + 1; round < rounds; round += 1) {
      expect(render({ kind: "race", round }, settled), `round ${round + 1}`).not.toContain(
        "wins the Constructors’",
      );
    }
  });

  it("gives the champion's row the winner's accent, and keeps it", () => {
    // Scoped to the constructors card, because the champion's name also appears
    // as a team line under every one of their drivers in the table above it.
    const championRow = (html: string): string => {
      const card = html.slice(html.lastIndexOf(">Constructors<"));
      const champion = constructorsTitleClinchedBy(
        constructorStandings(settled.season, settled.points),
        0,
        settled.points,
      );
      if (champion === null) {
        throw new Error("the season crowned no constructor");
      }
      const row = card
        .split("<tr")
        .find((candidate) => candidate.includes(teamName(champion.teamId)));
      if (row === undefined) {
        throw new Error("the champion has no row in the constructors table");
      }
      return row;
    };

    expect(championRow(render({ kind: "race", round: teamsClinch - 1 }, settled))).not.toContain(
      STANDOUT_ROW,
    );
    expect(championRow(render({ kind: "race", round: teamsClinch }, settled))).toContain(
      STANDOUT_ROW,
    );
    // And it stays, rather than marking only the round it happened on.
    expect(championRow(render({ kind: "race", round: teamsClinch + 1 }, settled))).toContain(
      STANDOUT_ROW,
    );
    expect(championRow(render({ kind: "race", round: rounds - 1 }, settled))).toContain(
      STANDOUT_ROW,
    );
  });

  it("announces the drivers' title on the round that settles it", () => {
    const html = render({ kind: "race", round: driversClinch }, settled);
    expect(html).toContain("wins the Drivers’ Championship");
  });

  it("says nothing on a qualifying page", () => {
    // A title is settled by a race result; Saturday cannot decide one.
    const html = render({ kind: "qualifying", round: rounds - 1 }, settled);
    expect(html).not.toContain("wins the");
  });
});

describe("the buttons", () => {
  it("offers a step, a skip and a way back on the grid", () => {
    // Back only here: nothing has been revealed yet, so leaving costs nothing.
    // Past the grid it is "Start again" that asks where to.
    expect(actionsFor({ kind: "grid" }, ROUNDS)).toEqual({
      next: "Simulate next session",
      skip: "Simulate full season",
      back: "Back",
    });
  });

  it("offers a step and a skip through the season", () => {
    // Rounds derived from the calendar: any round before the last has both a
    // session to step to and a season left to skip.
    for (const round of new Set([0, Math.floor((ROUNDS - 1) / 2), ROUNDS - 2])) {
      expect(actionsFor({ kind: "qualifying", round }, ROUNDS).next).toBe("Simulate next session");
      expect(actionsFor({ kind: "race", round }, ROUNDS).skip).toBe("Simulate rest of the season");
      // A season being revealed is left through "Start again", not through Back.
      expect(actionsFor({ kind: "race", round }, ROUNDS).back).toBeNull();
    }
    // Qualifying for the last round still has a race left to skip past.
    expect(actionsFor({ kind: "qualifying", round: ROUNDS - 1 }, ROUNDS).skip).toBe(
      "Simulate rest of the season",
    );
  });

  it("drops the skip after the last race and offers the summary", () => {
    expect(actionsFor({ kind: "race", round: ROUNDS - 1 }, ROUNDS)).toEqual({
      next: "Show season summary",
      skip: null,
      back: null,
    });
  });

  it("offers nothing forward from the summary", () => {
    expect(actionsFor({ kind: "summary" }, ROUNDS)).toEqual({
      next: null,
      skip: null,
      back: null,
    });
  });

  it("takes an era's summary on to the champions instead of stopping there", () => {
    // The one stage the era mode changes: a standalone season ends at its
    // summary, a year of an era has a roll of honour after it.
    expect(actionsFor({ kind: "summary" }, ROUNDS, true)).toEqual({
      next: "Show champions so far",
      skip: null,
      back: null,
    });
  });

  it("offers the next year and the far end from the roll of honour", () => {
    const onward = eraActionsFor(FIRST_PLAYABLE);
    expect(onward.next).toBe(FIRST_PLAYABLE + 1);
    expect(onward.rest).toBe(LAST_PLAYABLE);
  });

  it("drops the skip when the next year is the last one anyway", () => {
    // Two buttons doing the same thing is a worse offer than one.
    expect(eraActionsFor(LAST_PLAYABLE - 1)).toEqual({ next: LAST_PLAYABLE, rest: null });
  });

  it("offers nothing forward once the era reaches the end of the data", () => {
    expect(eraActionsFor(LAST_PLAYABLE)).toEqual({ next: null, rest: null });
  });

  it("leaves every other stage of an era exactly as it was", () => {
    // The point of running the era on the season flow rather than beside it: if
    // any other stage differed, there would be two reveals to keep in step.
    const views: View[] = [
      { kind: "grid" },
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "race", round: ROUNDS - 1 },
    ];
    for (const view of views) {
      expect(actionsFor(view, ROUNDS, true), view.kind).toEqual(actionsFor(view, ROUNDS));
    }
  });
});

/**
 * The one seam the component tests above cannot reach: which screen passes
 * `canChooseAbility`.
 *
 * `SeasonView` renders the toggle or does not, and the store refuses the change
 * or does not — both covered on their own. What connects them is a single
 * expression in `SeasonScreen`, and a year inside an era that forgot to say so
 * would draw a control that silently does nothing.
 */
describe("who is offered the ability toggle", () => {
  const shown = (run?: EraRun) =>
    renderToStaticMarkup(
      <SeasonScreen
        world={world}
        view={{ kind: "grid" }}
        {...(run === undefined ? {} : { run })}
      />,
    ).includes("Driver ability");

  it("offers it on a standalone season's grid", () => {
    expect(shown()).toBe(true);
  });

  it("does not offer it on the grid of a year inside an era", () => {
    // The same world and the same view: only the run alongside it differs, which
    // is the whole of what makes a season an era's.
    expect(shown({ startYear: world.year, seasons: [] })).toBe(false);
  });

  it("keeps that true once years have been crowned, not just on the first", () => {
    expect(shown({ startYear: world.year - 3, seasons: [world] })).toBe(false);
  });
});
