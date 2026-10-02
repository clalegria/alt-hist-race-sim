/**
 * The era loop: many seasons, one run.
 *
 * Everything here is about the *shell* — which screen follows which, what the
 * next year is built from, and what carries across a year boundary. What a
 * season is worth is the season tests' job, and no assertion below reads a
 * champion, a points total or an authored rating.
 */

import {
  DEFAULT_DRIVER_FILTERS,
  DEFAULT_RATING_MODE,
  FIRST_AUTHORED_SEASON,
  type GridArrangement,
  seasonSeed,
} from "@alt-hist/data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRatingMode, rememberRatingMode } from "../lib/preferences.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import {
  crowned,
  ERA_RATING_MODE,
  type EraRun,
  type Run,
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

/** Plays `years` seasons of an era from a seed, and hands back what it crowned. */
function playEra(seed: number, from: number, years: number): readonly World[] {
  useSeasonStore.getState().simulateEra(seed, from);
  for (let played = 0; played < years; played += 1) {
    useSeasonStore.getState().skipToEnd();
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
    for (const act of ["continueRun", "simulateRestOfEra", "skipToEnd", "restartSeason"] as const) {
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
    useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
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
      useSeasonStore.getState().skipToEnd();
      useSeasonStore.getState().continueRun();
      useSeasonStore.getState().continueRun();
      played.push(running().world);
    }
    expect(played.map((world) => world.randomness)).toEqual(played.map(() => 5));
  });

  it("bakes it in through skipping to the end as well as stepping", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, 4);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra();
    const seasons = rollOfHonour().seasons;
    expect(seasons.length).toBeGreaterThan(1);
    expect(seasons.map((world) => world.randomness)).toEqual(seasons.map(() => 4));
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
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra();

    expect(rollOfHonour().seasons.map((world) => world.year)).toEqual([
      LAST_YEAR - 3,
      LAST_YEAR - 2,
      LAST_YEAR - 1,
      LAST_YEAR,
    ]);
    expect(rollOfHonour().startYear).toBe(LAST_YEAR - 3);
  });

  it("produces exactly the history stepping through would have", () => {
    // The property that makes it a skip rather than a second simulation: what
    // the reader gave up is the reading, not the seasons.
    useSeasonStore.getState().simulateEra(31, LAST_YEAR - 3);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra();
    const skipped = rollOfHonour().seasons;

    expect(skipped).toEqual(playEra(31, LAST_YEAR - 3, 4));
  });

  it("does nothing once the era has reached the end of the data", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    const before = active();
    useSeasonStore.getState().simulateRestOfEra();
    expect(active()).toBe(before);
  });

  it("stops on the year it was given, leaving the rest of the era to run", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 4);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR - 2);

    expect(rollOfHonour().seasons.map((world) => world.year)).toEqual([
      LAST_YEAR - 4,
      LAST_YEAR - 3,
      LAST_YEAR - 2,
    ]);
    // And the run carries on from there, which is the whole point of stopping.
    useSeasonStore.getState().continueRun();
    expect(running().world.year).toBe(LAST_YEAR - 1);
  });

  it("writes the same history jumped to a year as stepped to it", () => {
    // A jump is a skip, not a shortcut through a different simulation: where it
    // stops, the era must be the one the reader would have played by hand.
    useSeasonStore.getState().simulateEra(17, LAST_YEAR - 4);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR - 2);

    expect(rollOfHonour().seasons).toEqual(playEra(17, LAST_YEAR - 4, 3));
  });

  it("reaches the end when the year it is given is the end", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 2);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR);
    expect(rollOfHonour().seasons.at(-1)?.year).toBe(LAST_YEAR);
  });

  it("refuses a year the era has already crowned, rather than running to the end", () => {
    // The failure this guards against is silent: a stale target from the picker
    // falling through to "no target" and fast-forwarding the whole era.
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    const before = active();
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR - 3);
    expect(active()).toBe(before);
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR - 9);
    expect(active()).toBe(before);
  });

  it("refuses a year with no season behind it", () => {
    useSeasonStore.getState().simulateEra(5, LAST_YEAR - 3);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    const before = active();
    useSeasonStore.getState().simulateRestOfEra(LAST_YEAR + 10);
    expect(active()).toBe(before);
  });

  it("is a no-op anywhere but the roll of honour", () => {
    // It is wired to a button only that screen draws, but a season half-read is
    // not a run to fast-forward, and the menu has no run at all.
    useSeasonStore.getState().simulateEra(5, YEAR);
    const playing = active();
    useSeasonStore.getState().simulateRestOfEra();
    expect(active()).toBe(playing);

    useSeasonStore.getState().exitRun();
    useSeasonStore.getState().simulateRestOfEra();
    expect(active()).toBeNull();
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
    useSeasonStore.getState().skipToEnd();
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
      useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra(YEAR + 3);
    const seasons = rollOfHonour().seasons;

    expect(seasons).toHaveLength(4);
    expect(seasons.map((world) => world.arrangement)).toEqual(seasons.map(() => kept));
    expect(seasons.slice(1).every((world) => world.lineup !== null)).toBe(true);
  });

  it("gives the same history stepped through as jumped", () => {
    useSeasonStore.getState().setGrid(null, null, kept);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().simulateRestOfEra(YEAR + 2);
    const jumped = rollOfHonour().seasons;

    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, kept);
    for (let year = 0; year < 3; year += 1) {
      useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
  });

  it("follows the summary, and crowns the year on screen without storing it twice", () => {
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "review" });
    // The year on the cursor is the run's world, not a second copy in the list.
    expect(current?.kind === "era" && current.run.seasons).toEqual([]);
    expect(rollOfHonour().seasons.map((world) => world.year)).toEqual([YEAR]);
  });

  it("refuses Start again, since the year it would re-run has been crowned", () => {
    const before = active();
    useSeasonStore.getState().restartSeason();
    expect(active()).toBe(before);
  });

  it("refuses a skip, with no season left to skip through", () => {
    const before = active();
    useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
  });

  it("reveals itself exactly as a standalone one does", () => {
    useSeasonStore.getState().continueRun();
    const current = active();
    expect(current?.kind === "era" && current.cursor).toEqual({ kind: "qualifying", round: 0 });
    useSeasonStore.getState().skipToEnd();
    const after = active();
    expect(after?.kind === "era" && after.cursor).toEqual({ kind: "summary" });
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
      rememberRatingMode(DEFAULT_RATING_MODE);
      expect(readRatingMode()).toBe(DEFAULT_RATING_MODE);

      useSeasonStore.getState().setRatingMode("aged");
      expect(readRatingMode()).toBe(DEFAULT_RATING_MODE);
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
