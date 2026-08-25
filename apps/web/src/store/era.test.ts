/**
 * The era loop: many seasons, one run.
 *
 * Everything here is about the *shell* — which screen follows which, what the
 * next year is built from, and what carries across a year boundary. What a
 * season is worth is the season tests' job, and no assertion below reads a
 * champion, a points total or an authored rating.
 */

import { FIRST_AUTHORED_SEASON, seasonSeed } from "@alt-hist/data";
import { beforeEach, describe, expect, it } from "vitest";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { type EraRun, type Screen, useSeasonStore, type World } from "./season.js";

/** The earliest authored year, which is where an era has the most left to run. */
const YEAR = FIRST_AUTHORED_SEASON;
/** The year an era cannot run past, off the data rather than written down. */
const LAST_YEAR = PLAYABLE_SEASONS.at(-1) ?? YEAR;

function screen(): Screen {
  return useSeasonStore.getState().screen;
}

/** The era season on screen, or a throw naming what was there instead. */
function running(): { run: EraRun; world: World } {
  const current = screen();
  if (current.kind !== "era") {
    throw new Error(`expected an era season on screen, found "${current.kind}"`);
  }
  return { run: current.run, world: current.world };
}

/** The roll-up on screen, or a throw. */
function crowned(): EraRun {
  const current = screen();
  if (current.kind !== "era-champions") {
    throw new Error(`expected the champions on screen, found "${current.kind}"`);
  }
  return current.run;
}

/** Plays `years` seasons of an era from a seed, and hands back what it crowned. */
function playEra(seed: number, from: number, years: number): readonly World[] {
  useSeasonStore.getState().simulateEra(seed, from);
  for (let played = 0; played < years; played += 1) {
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    if (played + 1 < years) {
      useSeasonStore.getState().nextEraSeason();
    }
  }
  return crowned().seasons;
}

describe("starting an era", () => {
  beforeEach(() => {
    useSeasonStore.getState().openMenu();
  });

  it("goes menu, then setup, then the first season of the run", () => {
    useSeasonStore.getState().openEraSetup();
    expect(screen().kind).toBe("era-setup");
    useSeasonStore.getState().startEra(YEAR);
    expect(running().world.year).toBe(YEAR);
    expect(running().run).toEqual({ startYear: YEAR, seasons: [] });
  });

  it("opens at the grid, with nothing crowned yet", () => {
    useSeasonStore.getState().simulateEra(3, YEAR);
    const current = screen();
    expect(current.kind === "era" && current.view).toEqual({ kind: "grid" });
    expect(running().run.seasons).toHaveLength(0);
  });

  it("draws a different first season each time one is started", () => {
    useSeasonStore.getState().startEra(YEAR);
    const first = running().world.seed;
    useSeasonStore.getState().startEra(YEAR);
    expect(running().world.seed).not.toBe(first);
  });

  it("ignores the era controls when no era is on screen", () => {
    for (const act of ["showEraChampions", "nextEraSeason", "leaveEraSeason"] as const) {
      useSeasonStore.getState()[act]();
      expect(screen(), act).toEqual({ kind: "menu" });
    }
  });
});

describe("crowning a season", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
  });

  it("is where the season on screen joins the run", () => {
    const played = running().world;
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    expect(crowned().seasons).toEqual([played]);
    expect(crowned().startYear).toBe(YEAR);
  });

  it("crowns each year exactly once, in the order they were raced", () => {
    // The failure this guards against is a year counted twice, which would put
    // the same season in the roll of honour under two headings.
    const seasons = playEra(5, YEAR, 3);
    expect(seasons.map((world) => world.year)).toEqual([YEAR, YEAR + 1, YEAR + 2]);
  });

  it("crowns nothing while a season is still being read", () => {
    useSeasonStore.getState().nextSession();
    expect(running().run.seasons).toHaveLength(0);
  });
});

describe("running on to the next year", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
  });

  it("opens the following season at its grid, the run intact behind it", () => {
    useSeasonStore.getState().nextEraSeason();
    const current = screen();
    expect(current.kind === "era" && current.view).toEqual({ kind: "grid" });
    expect(running().world.year).toBe(YEAR + 1);
    expect(running().run.seasons).toHaveLength(1);
    expect(running().run.startYear).toBe(YEAR);
  });

  it("races that year's own grid, straight from its seed file", () => {
    // The seam the advanced mode replaces, and the one thing this mode must not
    // fake: the field for year N+1 is the entry list history had that year, not
    // last year's grid carried forward.
    useSeasonStore.getState().nextEraSeason();
    const entered = seasonSeed(YEAR + 1).entries.flatMap((entry) => entry.drivers);
    expect(running().world.field.map((entrant) => entrant.driverId)).toEqual(entered);
    expect(running().world.season.races).toHaveLength(seasonSeed(YEAR + 1).calendar.length);
  });

  it("scores it on that year's own points scale", () => {
    useSeasonStore.getState().nextEraSeason();
    expect(running().world.points).toEqual(seasonSeed(YEAR + 1).points);
  });

  it("rolls fresh dice rather than replaying the year before", () => {
    const before = crowned().seasons[0];
    useSeasonStore.getState().nextEraSeason();
    expect(running().world.seed).not.toBe(before?.seed);
  });

  it("does nothing once the era runs out of authored seasons", () => {
    // The era stops where the data does. Nothing offers this button there, but
    // a no-op is a better answer than a throw on a year nobody has authored.
    useSeasonStore.getState().simulateEra(5, LAST_YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    const before = crowned();
    useSeasonStore.getState().nextEraSeason();
    expect(crowned()).toBe(before);
  });
});

describe("an era as a whole", () => {
  it("is reproducible end to end from the seed it started on", () => {
    // The property the run turns on: one seed, and every year of the era that
    // follows from it. Without it a bug report four seasons in is unusable.
    expect(playEra(12, YEAR, 4)).toEqual(playEra(12, YEAR, 4));
  });

  it("is a different history from a different starting seed", () => {
    expect(playEra(12, YEAR, 3)).not.toEqual(playEra(13, YEAR, 3));
  });

  it("gives each of its years its own dice", () => {
    const seeds = playEra(21, YEAR, 4).map((world) => world.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("carries the ability mode from year to year", () => {
    // A choice about how to play, not a property of one season — the same rule
    // Start again follows inside a single year.
    useSeasonStore.getState().simulateEra(5, YEAR, "aged");
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().nextEraSeason();
    expect(running().world.ratingMode).toBe("aged");
  });

  it("is a save file like a single season", () => {
    const run: EraRun = { startYear: YEAR, seasons: playEra(9, YEAR, 2) };
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe("simulating the rest of an era", () => {
  it("runs every remaining year, straight to the last authored season", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().simulateRestOfEra();

    expect(crowned().seasons.map((world) => world.year)).toEqual([
      LAST_YEAR - 3,
      LAST_YEAR - 2,
      LAST_YEAR - 1,
      LAST_YEAR,
    ]);
    expect(crowned().startYear).toBe(LAST_YEAR - 3);
  });

  it("produces exactly the history stepping through would have", () => {
    // The property that makes it a skip rather than a second simulation: what
    // the reader gave up is the reading, not the seasons.
    useSeasonStore.getState().simulateEra(31, LAST_YEAR - 3);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().simulateRestOfEra();
    const skipped = crowned().seasons;

    expect(skipped).toEqual(playEra(31, LAST_YEAR - 3, 4));
  });

  it("does nothing once the era has reached the end of the data", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    const before = crowned();
    useSeasonStore.getState().simulateRestOfEra();
    expect(crowned()).toBe(before);
  });

  it("is a no-op anywhere but the roll of honour", () => {
    // It is wired to a button only that screen draws, but a season half-read is
    // not a run to fast-forward, and the menu has no run at all.
    useSeasonStore.getState().simulateEra(5, YEAR);
    const playing = screen();
    useSeasonStore.getState().simulateRestOfEra();
    expect(screen()).toBe(playing);

    useSeasonStore.getState().openMenu();
    useSeasonStore.getState().simulateRestOfEra();
    expect(screen()).toEqual({ kind: "menu" });
  });
});

describe("the way back out of an era", () => {
  it("leaves the first season for the year picker, having crowned nothing", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().leaveEraSeason();
    expect(screen()).toEqual({ kind: "era-setup" });
  });

  it("leaves a later season for the roll-up it came from, unchanged", () => {
    // The year being abandoned was never read to the end, so it must not join
    // the roll of honour on the way past.
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().nextEraSeason();
    useSeasonStore.getState().leaveEraSeason();
    expect(crowned().seasons.map((world) => world.year)).toEqual([YEAR]);
  });

  it("abandons the whole run for the main menu", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().openMenu();
    expect(screen()).toEqual({ kind: "menu" });
  });
});

describe("a season inside an era", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().showEraChampions();
    useSeasonStore.getState().nextEraSeason();
  });

  it("reveals itself exactly as a standalone one does", () => {
    useSeasonStore.getState().nextSession();
    const current = screen();
    expect(current.kind === "era" && current.view).toEqual({ kind: "qualifying", round: 0 });
    useSeasonStore.getState().skipToEnd();
    const after = screen();
    expect(after.kind === "era" && after.view).toEqual({ kind: "summary" });
  });

  it("takes Start again as another go at this year, not at the era", () => {
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    const after = running().world;

    expect(after.year).toBe(before.year);
    expect(after.seed).not.toBe(before.seed);
    // The years already read stand: they were crowned, and this one was not.
    expect(running().run.seasons.map((world) => world.year)).toEqual([YEAR]);
  });

  it("can be re-run on the other ability model, like any grid", () => {
    useSeasonStore.getState().setRatingMode("aged");
    expect(running().world.ratingMode).toBe("aged");
    expect(running().run.seasons).toHaveLength(1);
  });

  it("keeps the run through a change of grid", () => {
    const authored = running().world;
    useSeasonStore.getState().setGrid(null, null);
    expect(running().run.seasons).toHaveLength(1);
    expect(running().world.year).toBe(authored.year);
  });
});
