/**
 * The era loop: many seasons, one run.
 *
 * Everything here is about the *shell* — which screen follows which, what the
 * next year is built from, and what carries across a year boundary. What a
 * season is worth is the season tests' job, and no assertion below reads a
 * champion, a points total or an authored rating.
 */

import {
  arrangeLineup,
  authoredChassis,
  authoredLineup,
  CHASSIS_STEP_RANGE,
  DEFAULT_DRIVER_FILTERS,
  driverRatingsFor,
  driversById,
  FIRST_AUTHORED_SEASON,
  filledLineup,
  type GridArrangement,
  identityYear,
  seasonSeed,
  stepChassis,
  teamIdentityIn,
  teamsById,
  withoutCareerEvents,
} from "@alt-hist/data";
import { createRng } from "@alt-hist/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRatingMode, rememberRatingMode } from "../lib/preferences.js";
import {
  driverPoolOf,
  HISTORICAL_SETTINGS,
  OPENING_SEAT_RULES,
  pointsTables,
  type RunSettings,
  rolledChassisOf,
  samePoints,
  settingsInForce,
} from "../lib/run-settings.js";
import {
  enteredSeason,
  isPlayable,
  nextEraYear,
  PLAYABLE_SEASONS,
  seasonWithChassis,
} from "../lib/seasons.js";
import type { Place } from "../lib/timeline.js";
import { FOLDING_YEAR } from "../test-support.js";
import {
  crowned,
  cursorPlace,
  ERA_RATING_MODE,
  type EraRun,
  isUntouched,
  type Run,
  racedChassis,
  racedLineup,
  useSeasonStore,
  type World,
} from "./season.js";

/** The earliest authored year, which is where an era has the most left to run. */
const YEAR = FIRST_AUTHORED_SEASON;
/** The year an era cannot run past, off the data rather than written down. */
const LAST_YEAR = PLAYABLE_SEASONS.at(-1) ?? YEAR;

/** The run in the store, or null when there is none. */
function active(): Run | null {
  return useSeasonStore.getState().run;
}

/** The era season being played, or a throw naming what was there instead. */
function running(): { run: EraRun; world: World } {
  const current = active();
  if (current?.kind !== "era" || current.cursor.kind === "review") {
    throw new Error(`expected an era season being played, found "${current?.kind ?? "no run"}"`);
  }
  return { run: current.run, world: current.world };
}

/** What the era has crowned, with the cursor on its review — or a throw. */
function rollOfHonour(): EraRun {
  const current = active();
  if (current?.kind !== "era" || current.cursor.kind !== "review") {
    throw new Error(`expected the review, found "${current?.kind ?? "no run"}"`);
  }
  return crowned(current);
}

/** The run on to the end of the season on the cursor — the run bar's skip. */
function skipToEnd(): void {
  const current = active();
  if (current !== null) {
    useSeasonStore.getState().jumpTo({ year: current.world.year, beat: { kind: "summary" } });
  }
}

/** Jumps to the end of `year`, then on to its review, where the roll of honour is. */
function jumpThrough(year: number): void {
  useSeasonStore.getState().jumpTo({ year, beat: { kind: "summary" } });
  useSeasonStore.getState().continueRun();
}

/** Plays `years` seasons of an era from a seed, and hands back what it crowned. */
function playEra(seed: number, from: number, years: number): readonly World[] {
  useSeasonStore.getState().simulateEra(seed, from);
  for (let played = 0; played < years; played += 1) {
    skipToEnd();
    useSeasonStore.getState().continueRun();
    if (played + 1 < years) {
      useSeasonStore.getState().continueRun();
    }
  }
  return rollOfHonour().seasons;
}

describe("starting an era", () => {
  beforeEach(() => {
    useSeasonStore.getState().exitRun();
  });

  it("opens on the first season of the run", () => {
    useSeasonStore.getState().startEra(YEAR);
    expect(running().world.year).toBe(YEAR);
    expect(running().run).toEqual({ startYear: YEAR, seasons: [] });
  });

  it("opens at the grid, with nothing crowned yet", () => {
    useSeasonStore.getState().simulateEra(3, YEAR);
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "grid" });
    expect(running().run.seasons).toHaveLength(0);
  });

  it("draws a different first season each time one is started", () => {
    useSeasonStore.getState().startEra(YEAR);
    const first = running().world.seed;
    useSeasonStore.getState().startEra(YEAR);
    expect(running().world.seed).not.toBe(first);
  });

  it("runs on the ageing curve, whichever mode a season was last played in", () => {
    // The remembered mode seeds the next *standalone* season and must not reach
    // an era: peak ratings across a run would freeze every driver at one age for
    // twenty years and delete the thing the mode exists to show. Stubbed rather
    // than assumed, because Vitest has no DOM and `preferences.ts` would
    // otherwise no-op its way to a pass — see the note in the mode tests below.
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
    });
    try {
      rememberRatingMode("peak");
      expect(readRatingMode()).toBe("peak");
      expect(ERA_RATING_MODE).not.toBe("peak");

      useSeasonStore.getState().startEra(YEAR);
      expect(running().world.ratingMode).toBe(ERA_RATING_MODE);
      useSeasonStore.getState().simulateEra(3, YEAR);
      expect(running().world.ratingMode).toBe(ERA_RATING_MODE);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores the run's controls when there is no run", () => {
    for (const act of ["continueRun", "restartSeason", "restartEra"] as const) {
      useSeasonStore.getState()[act]();
      expect(active(), act).toBeNull();
    }
  });
});

describe("crowning a season", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
  });

  it("is where the season on screen joins the run", () => {
    const played = running().world;
    skipToEnd();
    useSeasonStore.getState().continueRun();
    expect(rollOfHonour().seasons).toEqual([played]);
    expect(rollOfHonour().startYear).toBe(YEAR);
  });

  it("crowns each year exactly once, in the order they were raced", () => {
    // The failure this guards against is a year counted twice, which would put
    // the same season in the roll of honour under two headings.
    const seasons = playEra(5, YEAR, 3);
    expect(seasons.map((world) => world.year)).toEqual([YEAR, YEAR + 1, YEAR + 2]);
  });

  it("crowns nothing while a season is still being read", () => {
    useSeasonStore.getState().continueRun();
    expect(running().run.seasons).toHaveLength(0);
  });
});

describe("running on to the next year", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
  });

  it("opens the following season at its grid, the run intact behind it", () => {
    useSeasonStore.getState().continueRun();
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "grid" });
    expect(running().world.year).toBe(YEAR + 1);
    expect(running().run.seasons).toHaveLength(1);
    expect(running().run.startYear).toBe(YEAR);
  });

  it("does not carry a re-rated chassis into it: that was a car for last year", () => {
    const seed = seasonSeed(YEAR);
    const rerated = stepChassis(authoredChassis(seed), seed.entries[0]?.teamId ?? "", -1);
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, null, rerated);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "grid" } });
    expect(running().world.chassis).toBeNull();
    const entered = seasonSeed(YEAR + 1).entries;
    for (const entrant of running().world.field) {
      const entry = entered.find((e) => e.teamId === entrant.teamId);
      expect(entrant.chassis, entrant.teamId).toEqual(entry?.chassis);
    }
  });

  it("races that year's own grid, straight from its seed file", () => {
    // The seam the advanced mode replaces, and the one thing this mode must not
    // fake: the field for year N+1 is the entry list history had that year, not
    // last year's grid carried forward.
    useSeasonStore.getState().continueRun();
    const entered = seasonSeed(YEAR + 1).entries.flatMap((entry) => entry.drivers);
    expect(running().world.field.map((entrant) => entrant.driverId)).toEqual(entered);
    expect(running().world.season.races).toHaveLength(seasonSeed(YEAR + 1).calendar.length);
  });

  it("scores it on that year's own points scale", () => {
    useSeasonStore.getState().continueRun();
    expect(running().world.points).toEqual(seasonSeed(YEAR + 1).points);
  });

  it("rolls fresh dice rather than replaying the year before", () => {
    const before = rollOfHonour().seasons[0];
    useSeasonStore.getState().continueRun();
    expect(running().world.seed).not.toBe(before?.seed);
  });

  it("does nothing once the era runs out of authored seasons", () => {
    // The era stops where the data does. Nothing offers this button there, but
    // a no-op is a better answer than a throw on a year nobody has authored.
    useSeasonStore.getState().simulateEra(5, LAST_YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    const before = active();
    useSeasonStore.getState().continueRun();
    expect(active()).toBe(before);
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
    // Fixed for the whole run rather than chosen, but the property that matters
    // is the same one: year N+1 is built the way year N was.
    useSeasonStore.getState().simulateEra(5, YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    expect(running().world.ratingMode).toBe(ERA_RATING_MODE);
  });

  it("bakes the randomness level in: every year runs at the level the era started on", () => {
    // The one thing an era does differently with this setting. A run is one
    // long championship under one set of rules — a level the reader could turn
    // up the moment a season went against them would be a different feature.
    useSeasonStore.getState().simulateEra(5, YEAR, 5);
    const played = [running().world];
    for (let i = 0; i < 3; i += 1) {
      skipToEnd();
      useSeasonStore.getState().continueRun();
      useSeasonStore.getState().continueRun();
      played.push(running().world);
    }
    expect(played.map((world) => world.randomness)).toEqual(played.map(() => 5));
  });

  it("bakes it in through skipping to the end as well as stepping", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, 4);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    jumpThrough(LAST_YEAR);
    const seasons = rollOfHonour().seasons;
    expect(seasons.length).toBeGreaterThan(1);
    expect(seasons.map((world) => world.randomness)).toEqual(seasons.map(() => 4));
  });

  it("is a save file like a single season", () => {
    const run: EraRun = { startYear: YEAR, seasons: playEra(9, YEAR, 2) };
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe("jumping ahead", () => {
  /** The cursor as a place, or a throw. */
  function at(): Place {
    const current = active();
    if (current === null) {
      throw new Error("expected a run");
    }
    return cursorPlace(current);
  }

  it("lands on the end of the year it is given, every year before it crowned", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 4);
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR - 2, beat: { kind: "summary" } });

    expect(at()).toEqual({ year: LAST_YEAR - 2, beat: { kind: "summary" } });
    expect(running().run.seasons.map((world) => world.year)).toEqual([
      LAST_YEAR - 4,
      LAST_YEAR - 3,
    ]);
    // And the run carries on from there, which is the whole point of stopping.
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    expect(running().world.year).toBe(LAST_YEAR - 1);
  });

  it("lands on the start of a year, its grid still open to edit", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 4);
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR - 2, beat: { kind: "grid" } });
    expect(at()).toEqual({ year: LAST_YEAR - 2, beat: { kind: "grid" } });
    expect(running().run.seasons).toHaveLength(2);
  });

  it("jumps from the middle of a season as well as from between them", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR, beat: { kind: "summary" } });
    expect(at()).toEqual({ year: LAST_YEAR, beat: { kind: "summary" } });
  });

  it("writes exactly the history stepping through would have", () => {
    // The property that makes it a skip rather than a second simulation: what
    // the reader gave up is the reading, not the seasons.
    useSeasonStore.getState().simulateEra(31, LAST_YEAR - 3);
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR, beat: { kind: "summary" } });
    useSeasonStore.getState().continueRun();
    expect(rollOfHonour().seasons).toEqual(playEra(31, LAST_YEAR - 3, 4));
  });

  it("writes the same history to a year's start as stepping to it", () => {
    useSeasonStore.getState().simulateEra(17, LAST_YEAR - 4);
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR - 1, beat: { kind: "grid" } });
    const jumped = running().run.seasons;
    expect(jumped).toEqual(playEra(17, LAST_YEAR - 4, 3));
  });

  it("refuses a place the run has already passed, rather than running anywhere", () => {
    // The failure this guards against is silent: a stale target from the
    // dialog falling through to "no target" and fast-forwarding the whole era.
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    skipToEnd();
    const before = active();
    for (const target of [
      { year: LAST_YEAR - 3, beat: { kind: "summary" } },
      { year: LAST_YEAR - 3, beat: { kind: "grid" } },
      { year: LAST_YEAR - 9, beat: { kind: "summary" } },
    ] as const) {
      useSeasonStore.getState().jumpTo(target);
      expect(active(), JSON.stringify(target)).toBe(before);
    }
  });

  it("refuses a year with no season behind it", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    const before = active();
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR + 10, beat: { kind: "summary" } });
    expect(active()).toBe(before);
  });

  it("lands only on a year's start or end, never inside it", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    const before = active();
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR - 1, beat: { kind: "race", round: 0 } });
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR - 1, beat: { kind: "review" } });
    expect(active()).toBe(before);
  });

  it("has nowhere to go once the era has reached the end of the data", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    const before = active();
    useSeasonStore.getState().jumpTo({ year: LAST_YEAR, beat: { kind: "summary" } });
    expect(active()).toBe(before);
  });
});

describe("restarting the era", () => {
  it("goes back to the first year's grid on new dice, every year since discarded", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, 4);
    useSeasonStore.getState().jumpTo({ year: YEAR + 2, beat: { kind: "grid" } });
    useSeasonStore.getState().restartEra();

    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "grid" });
    expect(running().world.year).toBe(YEAR);
    expect(running().run).toEqual({ startYear: YEAR, seasons: [] });
    expect(running().world.seed).not.toBe(5);
    // How the reader chose to play carries.
    expect(running().world.randomness).toBe(4);
    expect(running().world.ratingMode).toBe(ERA_RATING_MODE);
  });

  it("keeps the first year's grid as the reader set it", () => {
    const kept: GridArrangement = {
      kind: "fastest-in-fastest",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: true,
    };
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, kept);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "summary" } });
    useSeasonStore.getState().restartEra();
    expect(running().world.arrangement).toEqual(kept);
    expect(running().world.lineup).not.toBeNull();
  });

  it("keeps the first year's re-rated chassis", () => {
    const seed = seasonSeed(YEAR);
    const rerated = stepChassis(authoredChassis(seed), seed.entries[0]?.teamId ?? "", -1);
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, null, rerated);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "summary" } });
    useSeasonStore.getState().restartEra();
    expect(running().world.chassis).toEqual(rerated);
  });

  it("drops a grid edited in a later year, which this run no longer has", () => {
    const once: GridArrangement = {
      kind: "fastest-in-fastest",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: false,
    };
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "grid" } });
    useSeasonStore.getState().setGrid(null, null, once);
    useSeasonStore.getState().restartEra();
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "grid" } });
    expect(running().world.arrangement).toBeNull();
    expect(running().world.lineup).toBeNull();
  });

  it("does nothing to a one-year run, whose restart is the season's", () => {
    useSeasonStore.getState().simulate(5, YEAR);
    const before = active();
    useSeasonStore.getState().restartEra();
    expect(active()).toBe(before);
  });
});

describe("a points table kept across an era", () => {
  /** A table other than the first year's own, so a pass cannot be the default showing through. */
  const other =
    pointsTables().find((table) => !samePoints(table.scale, seasonSeed(YEAR).points))?.scale ?? [];
  const fixed = { ...HISTORICAL_SETTINGS, points: other };

  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, fixed);
  });

  it("scores every following year on it", () => {
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    jumpThrough(running().world.year);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    for (const year of [...run.seasons, world]) {
      expect(year.settings, `${year.year}`).toEqual(fixed);
      expect(year.points, `${year.year}`).toEqual(other);
    }
  });

  it("survives Restart era", () => {
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().restartEra();
    expect(running().world.year).toBe(YEAR);
    expect(running().world.points).toEqual(other);
  });
});

describe("reliability and breakdowns kept across an era", () => {
  it("keep a Reliability year in every following year", () => {
    const fixed = { ...HISTORICAL_SETTINGS, breakdowns: "fewer" as const, reliability: LAST_YEAR };
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, fixed);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    for (const year of [...run.seasons, world]) {
      expect(year.settings, `${year.year}`).toEqual(fixed);
    }
  });

  it("break no car down in any year under None, and record no Reliability", () => {
    const fixed = { ...HISTORICAL_SETTINGS, breakdowns: "none" as const, reliability: LAST_YEAR };
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, fixed);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    jumpThrough(running().world.year);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    for (const year of [...run.seasons, world]) {
      expect(year.settings, `${year.year}`).toEqual(settingsInForce(fixed));
      const mechanical = year.season.races
        .flatMap((race) => race.entries)
        .filter((entry) => entry.dnfCause === "mechanical");
      expect(mechanical, `${year.year}`).toEqual([]);
    }
  });
});

describe("career events dropped for an era", () => {
  const byId = driversById();
  const without = { ...HISTORICAL_SETTINGS, careerEvents: "none" as const };

  /** Whether a career event moves any seated driver's ratings in `year`. */
  const eventfulYear = (year: number): boolean =>
    seasonSeed(year)
      .entries.flatMap((entry) => entry.drivers)
      .some((id) => {
        const driver = byId.get(id);
        return (
          driver !== undefined &&
          JSON.stringify(driverRatingsFor(driver, year, ERA_RATING_MODE)) !==
            JSON.stringify(driverRatingsFor(withoutCareerEvents(driver), year, ERA_RATING_MODE))
        );
      });

  // Searched for rather than named: a start year whose *second* year has an
  // event that counts, so carrying the setting across a year is what is tested.
  const start = PLAYABLE_SEASONS.find((year) => {
    const next = nextEraYear(year);
    return next !== null && eventfulYear(next);
  });

  /** The era's first two years under `settings`, by stepping. */
  function twoYears(settings: typeof HISTORICAL_SETTINGS): readonly World[] {
    useSeasonStore.getState().simulateEra(5, start ?? YEAR, undefined, settings);
    jumpThrough(start ?? YEAR);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    return [...run.seasons, world];
  }

  /** Whether every entrant was rated as `rate` says, for its own year. */
  function ratedBy(years: readonly World[], rate: (id: string, year: number) => unknown): void {
    for (const year of years) {
      for (const entrant of year.field) {
        expect(entrant.driver, `${year.year} ${entrant.driverId}`).toEqual(
          rate(entrant.driverId, year.year),
        );
      }
    }
  }

  it("finds a year to test against", () => {
    expect(start).toBeDefined();
  });

  it("rates every driver on the plain curve, in every year", () => {
    const years = twoYears(without);
    expect(years).toHaveLength(2);
    for (const year of years) {
      expect(year.settings, `${year.year}`).toEqual(without);
    }
    ratedBy(years, (id, year) => {
      const driver = byId.get(id);
      return driver === undefined
        ? undefined
        : driverRatingsFor(withoutCareerEvents(driver), year, ERA_RATING_MODE);
    });
  });

  it("keeps them as they happened by default", () => {
    ratedBy(twoYears(HISTORICAL_SETTINGS), (id, year) => {
      const driver = byId.get(id);
      return driver === undefined ? undefined : driverRatingsFor(driver, year, ERA_RATING_MODE);
    });
  });

  it("reaches the same second year by jumping as by stepping", () => {
    const stepped = twoYears(without).at(-1);
    useSeasonStore.getState().simulateEra(5, start ?? YEAR, undefined, without);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running().world).toEqual(stepped);
  });
});

describe("team names kept for an era", () => {
  const teams = teamsById();
  const kept = { ...HISTORICAL_SETTINGS, teamNames: "first" as const };

  /** The era's first three years under `settings`, by stepping. */
  function threeYears(settings: typeof HISTORICAL_SETTINGS): readonly World[] {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, settings);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    jumpThrough(running().world.year);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    return [...run.seasons, world];
  }

  it("records the era's first year on every year of it", () => {
    const years = threeYears(kept);
    expect(years).toHaveLength(3);
    for (const year of years) {
      expect(year.namesKeptFrom, `${year.year}`).toBe(YEAR);
    }
  });

  it("bases every team where it was in its first season of the run", () => {
    for (const year of threeYears(kept)) {
      for (const entrant of year.field) {
        const team = teams.get(entrant.teamId);
        expect(entrant.teamCountry, `${year.year} ${entrant.teamId}`).toBe(
          team === undefined
            ? undefined
            : teamIdentityIn(team, identityYear(team.id, year.year, YEAR)).base,
        );
      }
    }
  });

  it("records nothing when teams are named as they happened", () => {
    for (const year of threeYears(HISTORICAL_SETTINGS)) {
      expect(year.namesKeptFrom, `${year.year}`).toBeNull();
    }
  });

  it("keeps the first year through a new grid and both restarts", () => {
    threeYears(kept);
    useSeasonStore.getState().setGrid(null, null);
    expect(running().world.namesKeptFrom).toBe(YEAR);
    useSeasonStore.getState().restartSeason();
    expect(running().world.namesKeptFrom).toBe(YEAR);
    useSeasonStore.getState().restartEra();
    expect(running().world).toMatchObject({ year: YEAR, namesKeptFrom: YEAR });
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = threeYears(kept).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, kept);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running().world).toEqual(stepped);
  });
});

describe("car performance across an era", () => {
  const varied: RunSettings = {
    ...HISTORICAL_SETTINGS,
    carPerformance: { kind: "varied", spread: 30, from: "real" },
  };
  const random: RunSettings = { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } };
  const TEAM = seasonSeed(YEAR).entries[0]?.teamId ?? "";

  /** The era's first three years under `settings`, by stepping. */
  function threeYears(settings: RunSettings): readonly World[] {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, settings);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    jumpThrough(running().world.year);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    return [...run.seasons, world];
  }

  /** A world's rolled cars with one team's chassis a point away from them. */
  function editedFrom(world: World) {
    const base = world.baselineChassis ?? {};
    const weaker = stepChassis(base, TEAM, -1);
    return weaker === base ? stepChassis(base, TEAM, 1) : weaker;
  }

  /** The chassis one team raced in a world. */
  function raced(world: World, teamId: string) {
    return world.field.find((entrant) => entrant.teamId === teamId)?.chassis;
  }

  it("rolls every year's cars off its own authored ones, from its own seed", () => {
    for (const settings of [varied, random]) {
      const years = threeYears(settings);
      expect(years).toHaveLength(3);
      for (const year of years) {
        const rolled = rolledChassisOf(seasonSeed(year.year), settings, year.seed);
        expect(rolled).not.toBeNull();
        expect(year.baselineChassis, `${year.year}`).toEqual(rolled);
        for (const entrant of year.field) {
          expect(entrant.chassis, `${year.year} ${entrant.teamId}`).toEqual(
            rolled?.[entrant.teamId],
          );
        }
      }
    }
  });

  it("rolls nothing when the cars are historical", () => {
    for (const year of threeYears(HISTORICAL_SETTINGS)) {
      expect(year.baselineChassis, `${year.year}`).toBeNull();
    }
  });

  it("is the year's starting point, not an edit", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    const rolled = running().world;
    expect(rolled.chassis).toBeNull();
    expect(isUntouched(active() as Run)).toBe(true);

    // The rolled cars handed back as the reader's own are no edit at all.
    useSeasonStore.getState().setGrid(null, null, null, rolled.baselineChassis);
    expect(running().world).toEqual(rolled);
  });

  it("keeps the roll through a new grid, and measures an edit from it", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    const before = running().world;
    const edited = editedFrom(before);
    useSeasonStore.getState().setGrid(null, null, null, edited);
    const after = running().world;
    expect(after.seed).toBe(before.seed);
    expect(after.baselineChassis).toEqual(before.baselineChassis);
    expect(after.chassis).toEqual(edited);
    expect(isUntouched(active() as Run)).toBe(false);
  });

  it("re-rolls on both restarts, carrying a reader's edit as the ratings it is", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    const edited = editedFrom(running().world);
    useSeasonStore.getState().setGrid(null, null, null, edited);

    for (const restart of [
      useSeasonStore.getState().restartSeason,
      useSeasonStore.getState().restartEra,
    ]) {
      restart();
      const world = running().world;
      expect(world.baselineChassis).toEqual(rolledChassisOf(seasonSeed(YEAR), varied, world.seed));
      expect(raced(world, TEAM)).toEqual(edited[TEAM]);
    }
  });

  it("ranks the rolled cars when a kept rule arranges the next year", () => {
    const kept: GridArrangement = {
      kind: "fastest-in-fastest",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: true,
    };
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    useSeasonStore.getState().setGrid(null, null, kept);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    const next = running().world;

    const entered = seasonWithChassis(next.year, next.baselineChassis);
    const authored = authoredLineup(entered);
    const arranged = arrangeLineup(entered, authored, kept, {
      mode: ERA_RATING_MODE,
      rng: createRng(next.seed),
      pool: driverPoolOf(varied),
    });
    expect(next.lineup ?? authored).toEqual(filledLineup(arranged) ?? authored);
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = threeYears(varied).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running().world).toEqual(stepped);
  });
});

describe("car performance walking from previous year's car", () => {
  const walk: RunSettings = {
    ...HISTORICAL_SETTINGS,
    carPerformance: { kind: "varied", spread: 30, from: "last" },
  };
  const real: RunSettings = {
    ...HISTORICAL_SETTINGS,
    carPerformance: { kind: "varied", spread: 30, from: "real" },
  };

  /** The era's first `count` years under `settings`, by stepping, from `start`. */
  function years(settings: RunSettings, count: number, start = YEAR): readonly World[] {
    useSeasonStore.getState().simulateEra(5, start, undefined, settings);
    for (let played = 1; played < count; played += 1) {
      jumpThrough(running().world.year);
      useSeasonStore.getState().continueRun();
    }
    const { run, world } = running();
    return [...run.seasons, world];
  }

  it("starts the run's first year from its real cars", () => {
    const [first] = years(walk, 1);
    expect(first?.walkedFrom).toBeNull();
    expect(first?.baselineChassis).toEqual(
      rolledChassisOf(seasonSeed(YEAR), real, first?.seed ?? 0),
    );
  });

  it("moves every later year off the cars the year before raced", () => {
    const run = years(walk, 3);
    expect(run).toHaveLength(3);
    for (const [index, year] of run.entries()) {
      const before = run[index - 1];
      if (before === undefined) {
        continue;
      }
      expect(year.walkedFrom, `${year.year}`).toEqual(racedChassis(before));
      expect(year.baselineChassis, `${year.year}`).toEqual(
        rolledChassisOf(seasonSeed(year.year), walk, year.seed, racedChassis(before)),
      );
      // The rule itself, not only the same call: a team that raced the year
      // before moves off that car by one offset within the spread, wherever
      // the scale's ends leave a rating free to show it.
      for (const [teamId, last] of Object.entries(racedChassis(before))) {
        const now = year.baselineChassis?.[teamId];
        if (now === undefined) {
          continue;
        }
        const offsets = new Set(
          (["racing", "qualifying", "consistency", "reliability"] as const)
            .filter((key) => now[key] > CHASSIS_STEP_RANGE.min && now[key] < CHASSIS_STEP_RANGE.max)
            .map((key) => now[key] - last[key]),
        );
        expect(offsets.size, `${year.year} ${teamId}`).toBeLessThanOrEqual(1);
        for (const offset of offsets) {
          expect(Math.abs(offset), `${year.year} ${teamId}`).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  it("walks a team new to the run off its own real car", () => {
    // A year whose entry list has a team the playable year before it lacks,
    // searched for rather than named.
    const teams = (year: number) => new Set(seasonSeed(year).entries.map((entry) => entry.teamId));
    const newcomerYear = PLAYABLE_SEASONS.find(
      (year) =>
        isPlayable(year - 1) && [...teams(year)].some((teamId) => !teams(year - 1).has(teamId)),
    );
    expect(newcomerYear).toBeDefined();
    const [before, year] = years(walk, 2, (newcomerYear ?? YEAR) - 1);
    if (before === undefined || year === undefined) {
      throw new Error("expected two years");
    }
    const newcomers = seasonSeed(year.year).entries.filter(
      (entry) => !teams(before.year).has(entry.teamId),
    );
    expect(newcomers.length).toBeGreaterThan(0);
    // The same draw from the real car: a newcomer has nothing else to move off.
    const fromReal = rolledChassisOf(seasonSeed(year.year), real, year.seed);
    for (const entry of newcomers) {
      expect(year.baselineChassis?.[entry.teamId], entry.teamId).toEqual(fromReal?.[entry.teamId]);
    }
  });

  it("carries a reader's chassis edit into the next year's walk, as what raced", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, walk);
    const first = running().world;
    const team = seasonSeed(YEAR).entries[0]?.teamId ?? "";
    const base = first.baselineChassis ?? {};
    const lower = stepChassis(base, team, -1);
    const edited = lower === base ? stepChassis(base, team, 1) : lower;
    useSeasonStore.getState().setGrid(null, null, null, edited);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    expect(running().world.walkedFrom).toEqual(edited);
  });

  it("keeps the year before's cars through a new grid and a restart of the year", () => {
    const [, second] = years(walk, 2);
    const walkedFrom = second?.walkedFrom;
    expect(walkedFrom).not.toBeNull();

    useSeasonStore.getState().setGrid(null, null, null, second?.baselineChassis);
    expect(running().world).toEqual(second);

    useSeasonStore.getState().restartSeason();
    const restarted = running().world;
    expect(restarted.seed).not.toBe(second?.seed);
    expect(restarted.walkedFrom).toEqual(walkedFrom);
    expect(restarted.baselineChassis).toEqual(
      rolledChassisOf(seasonSeed(restarted.year), walk, restarted.seed, walkedFrom ?? null),
    );

    useSeasonStore.getState().restartEra();
    expect(running().world.walkedFrom).toBeNull();
  });

  it("records no year before when the cars do not walk", () => {
    for (const settings of [HISTORICAL_SETTINGS, real]) {
      for (const year of years(settings, 2)) {
        expect(year.walkedFrom, `${year.year}`).toBeNull();
      }
    }
  });

  it("ranks the walked cars when a kept rule arranges the next year", () => {
    const kept: GridArrangement = {
      kind: "fastest-in-fastest",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: true,
    };
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, walk);
    useSeasonStore.getState().setGrid(null, null, kept);
    jumpThrough(YEAR);
    useSeasonStore.getState().continueRun();
    const next = running().world;

    const entered = seasonWithChassis(next.year, next.baselineChassis);
    const authored = authoredLineup(entered);
    const arranged = arrangeLineup(entered, authored, kept, {
      mode: ERA_RATING_MODE,
      rng: createRng(next.seed),
      pool: driverPoolOf(walk),
    });
    expect(next.lineup ?? authored).toEqual(filledLineup(arranged) ?? authored);
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = years(walk, 3).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, walk);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running().world).toEqual(stepped);
  });
});

describe("a bulk rule kept across an era", () => {
  /** One of the editor's rules, with the era's own checkbox ticked. */
  const kept: GridArrangement = {
    kind: "fastest-in-fastest",
    includeUnemployed: false,
    filters: DEFAULT_DRIVER_FILTERS,
    retain: true,
  };
  const once: GridArrangement = { ...kept, retain: false };

  /** Applies a rule to the year on screen, then crowns it and runs the next. */
  function applyAndRunOn(arrangement: GridArrangement): void {
    useSeasonStore.getState().setGrid(null, null, arrangement);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
  }

  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
  });

  it("arranges the next year the same way, on that year's own entry list", () => {
    applyAndRunOn(kept);
    const next = running().world;

    expect(next.year).toBe(YEAR + 1);
    expect(next.arrangement).toEqual(kept);
    expect(next.lineup).not.toBeNull();
    // Still that year's teams and that year's seats: the rule moves drivers
    // and the entry list is history's.
    const entered = seasonSeed(YEAR + 1);
    expect(Object.keys(next.lineup ?? {}).sort()).toEqual(
      entered.entries.map((entry) => entry.teamId).sort(),
    );
    expect(next.field).toHaveLength(entered.entries.flatMap((entry) => entry.drivers).length);
  });

  it("does not arrange the next year when the box was left unticked", () => {
    applyAndRunOn(once);
    expect(running().world.arrangement).toBeNull();
    expect(running().world.lineup).toBeNull();
  });

  it("keeps arranging for every year that follows, not just the next one", () => {
    applyAndRunOn(kept);
    for (let year = 0; year < 2; year += 1) {
      skipToEnd();
      useSeasonStore.getState().continueRun();
      useSeasonStore.getState().continueRun();
      expect(running().world.arrangement, String(running().world.year)).toEqual(kept);
      expect(running().world.lineup, String(running().world.year)).not.toBeNull();
    }
  });

  it("keeps arranging through a jump to the end as well as stepping", () => {
    // The rule every skip is under: jumping must produce exactly the history
    // stepping through would have.
    useSeasonStore.getState().setGrid(null, null, kept);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    jumpThrough(YEAR + 3);
    const seasons = rollOfHonour().seasons;

    expect(seasons).toHaveLength(4);
    expect(seasons.map((world) => world.arrangement)).toEqual(seasons.map(() => kept));
    expect(seasons.slice(1).every((world) => world.lineup !== null)).toBe(true);
  });

  it("gives the same history stepped through as jumped", () => {
    useSeasonStore.getState().setGrid(null, null, kept);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    jumpThrough(YEAR + 2);
    const jumped = rollOfHonour().seasons;

    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, kept);
    for (let year = 0; year < 3; year += 1) {
      skipToEnd();
      useSeasonStore.getState().continueRun();
      if (year < 2) {
        useSeasonStore.getState().continueRun();
      }
    }
    expect(rollOfHonour().seasons).toEqual(jumped);
  });

  it("is a save file like the rest of a run", () => {
    applyAndRunOn(kept);
    const run = running().run;
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe("the review between years", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
  });

  it("follows the summary, and crowns the year on screen without storing it twice", () => {
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "review" });
    // The year on the cursor is the run's world, not a second copy in the list.
    expect(current?.kind === "era" && current.run.seasons).toEqual([]);
    expect(rollOfHonour().seasons.map((world) => world.year)).toEqual([YEAR]);
  });

  it("refuses Restart season, since the year it would re-run has been crowned", () => {
    const before = active();
    useSeasonStore.getState().restartSeason();
    expect(active()).toBe(before);
  });

  it("refuses a skip, with no season left to skip through", () => {
    const before = active();
    skipToEnd();
    expect(active()).toBe(before);
  });

  it("abandons the whole run on exit", () => {
    useSeasonStore.getState().exitRun();
    expect(active()).toBeNull();
  });
});

describe("a season inside an era", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
  });

  it("reveals itself exactly as a standalone one does", () => {
    useSeasonStore.getState().continueRun();
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "qualifying", round: 0 });
    skipToEnd();
    const after = active();
    expect(after?.kind === "era" && after.cursor).toEqual({ kind: "summary" });
  });

  it("takes Restart season as another go at this year, not at the era", () => {
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    const after = running().world;

    expect(after.year).toBe(before.year);
    expect(after.seed).not.toBe(before.seed);
    // The years already read stand: they were crowned, and this one was not.
    expect(running().run.seasons.map((world) => world.year)).toEqual([YEAR]);
  });

  it("refuses to change the ability model, which an era does not offer", () => {
    // The switch is not drawn inside an era, so this is the store closing the
    // back door rather than a case the UI can reach. The grid is untouched: the
    // world on screen is the one the era built.
    const before = running().world;
    useSeasonStore.getState().setRatingMode("peak");
    expect(running().world.ratingMode).toBe(ERA_RATING_MODE);
    expect(running().world).toBe(before);
    expect(running().run.seasons).toHaveLength(1);
  });

  it("does not even remember a mode set from inside an era", () => {
    // The nastier half: `rememberRatingMode` seeds the *next standalone season*,
    // so a call that leaked through here would change a screen the reader never
    // connected it to.
    //
    // Vitest runs without a DOM, so `preferences.ts` finds no `localStorage` and
    // every call to it is a silent no-op — which would make this assertion pass
    // against any implementation at all. The stub is what gives it teeth.
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
    });
    try {
      // Remembered as the mode the era does not run on, so a leak would show.
      rememberRatingMode("peak");
      expect(readRatingMode()).toBe("peak");

      useSeasonStore.getState().setRatingMode(ERA_RATING_MODE);
      expect(readRatingMode()).toBe("peak");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the run through a change of grid", () => {
    const authored = running().world;
    useSeasonStore.getState().setGrid(null, null);
    expect(running().run.seasons).toHaveLength(1);
    expect(running().world.year).toBe(authored.year);
  });
});

describe("an untouched era", () => {
  /** Whether the run in the store is untouched, or a throw if there is none. */
  function untouched(): boolean {
    const current = active();
    if (current === null) {
      throw new Error("expected a run");
    }
    return isUntouched(current);
  }

  it("is a fresh era on its first grid", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    expect(untouched()).toBe(true);
  });

  it("is touched on any later year's grid, untouched as that grid is", () => {
    // The years behind it were read, so leaving would lose them.
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "grid" } });
    expect(running().world.lineup).toBeNull();
    expect(untouched()).toBe(false);
  });

  it("is untouched again after Restart era, on a first grid nobody edited", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().jumpTo({ year: YEAR + 1, beat: { kind: "summary" } });
    useSeasonStore.getState().restartEra();
    expect(untouched()).toBe(true);
  });
});

describe("the starting grid kept for an era", () => {
  const keep: RunSettings = { ...HISTORICAL_SETTINGS, teamsAndSeats: OPENING_SEAT_RULES };
  const FROM = FOLDING_YEAR.year;

  /** The first three years of an era from the year before a team folds, by stepping. */
  function threeYears(settings: RunSettings): readonly World[] {
    useSeasonStore.getState().simulateEra(5, FROM, undefined, settings);
    jumpThrough(FROM);
    useSeasonStore.getState().continueRun();
    jumpThrough(running().world.year);
    useSeasonStore.getState().continueRun();
    const { run, world } = running();
    return [...run.seasons, world];
  }

  it("enters every year with the first year's teams, at no more than their first-year cars", () => {
    const years = threeYears(keep);
    const seats = new Map(seasonSeed(FROM).entries.map((entry) => [entry.teamId, entry.drivers]));
    for (const world of years) {
      expect(world.gridKeptFrom, `${world.year}`).toBe(FROM);
      for (const [teamId, drivers] of Object.entries(racedLineup(world))) {
        expect(seats.has(teamId), `${world.year} ${teamId}`).toBe(true);
        expect(drivers.length).toBeLessThanOrEqual(seats.get(teamId)?.length ?? 0);
      }
    }
    expect(years[0]?.kept).toBeNull();
  });

  it("races a team that folded on as a ghost entry", () => {
    const [, second] = threeYears(keep);
    expect(second?.kept?.ghosts).toHaveProperty(FOLDING_YEAR.teamId);
  });

  it("makes the kept grid the year's starting point, not an edit", () => {
    for (const world of threeYears(keep)) {
      expect(world.lineup, `${world.year}`).toBeNull();
      expect(authoredLineup(enteredSeason(world))).toEqual(racedLineup(world));
    }
  });

  it("records nothing when the teams are as they happened", () => {
    for (const world of threeYears(HISTORICAL_SETTINGS)) {
      expect(world, `${world.year}`).toMatchObject({
        gridKeptFrom: null,
        kept: null,
        keptSeats: null,
      });
    }
  });

  it("keeps the kept year through a new grid and a restart, and the era's restart drops it", () => {
    const kept = threeYears(keep).at(-1)?.kept;
    expect(kept).not.toBeNull();
    useSeasonStore.getState().setGrid(null, null);
    expect(running().world.kept).toEqual(kept);
    useSeasonStore.getState().restartSeason();
    expect(running().world.kept).toEqual(kept);
    useSeasonStore.getState().restartEra();
    expect(running().world).toMatchObject({ year: FROM, gridKeptFrom: FROM, kept: null });
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = threeYears(keep).at(-1);
    useSeasonStore.getState().simulateEra(5, FROM, undefined, keep);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? FROM, beat: { kind: "grid" } });
    expect(running().world).toEqual(stepped);
  });

  it("arranges the kept grid when a bulk rule is kept", () => {
    const rule: GridArrangement = {
      kind: "fastest-in-fastest",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: true,
    };
    useSeasonStore.getState().simulateEra(5, FROM, undefined, keep);
    useSeasonStore.getState().setGrid(null, null, rule);
    skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    const next = running().world;
    expect(next.arrangement).toEqual(rule);
    expect(Object.keys(next.lineup ?? {}).sort()).toEqual(
      enteredSeason(next)
        .entries.map((entry) => entry.teamId)
        .sort(),
    );
  });
});
