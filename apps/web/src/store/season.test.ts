import {
  authoredEngines,
  authoredLineup,
  DEFAULT_DRIVER_FILTERS,
  FIRST_AUTHORED_SEASON,
  type GridArrangement,
  reserveDrivers,
  seasonSeed,
  seasons,
  swapDrivers,
} from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  createRngFromState,
  DEFAULT_RANDOMNESS_LEVEL,
} from "@alt-hist/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adjacentSeason } from "../lib/seasons.js";
import type { Beat } from "../lib/timeline.js";
import { createWorld, isUntouched, type Run, useSeasonStore, type World } from "./season.js";

/** The year these fixtures run in, and the seats it enters. */
const YEAR = FIRST_AUTHORED_SEASON;
const SEED = seasonSeed(YEAR);
const SEATS = SEED.entries.flatMap((entry) => entry.drivers).length;
const TEAMS = SEED.entries.length;

/**
 * A driver in a seat, and one without — chosen out of the data rather than by
 * name, because the driver market turns some of today's reserves into entrants.
 */
const AUTHORED = authoredLineup(SEED);
const SEATED = SEED.entries[0]?.drivers[0] ?? "";
const SEATED_TEAM = SEED.entries[0]?.teamId ?? "";
const RESERVE = reserveDrivers(AUTHORED)[0]?.id ?? "";
if (SEATED === "" || RESERVE === "") {
  throw new Error("the season needs a seated driver and a driver without a drive");
}

/** A seat whose driver is a different rating at their real age than at peak. */
function agedDiffers(mode: World): string {
  const peak = createWorld(mode.seed, mode.year, "peak", mode.lineup).field;
  const found = mode.field.find((entrant) => {
    const same = peak.find((other) => other.driverId === entrant.driverId);
    return same !== undefined && same.driver.racing !== entrant.driver.racing;
  });
  if (found === undefined) {
    throw new Error("no driver on this grid ages at all");
  }
  return found.driverId;
}

describe("the world", () => {
  it("runs one race per round on the calendar", () => {
    expect(createWorld(1, YEAR).season.races).toHaveLength(SEED.calendar.length);
  });

  it("is the same world for the same seed", () => {
    expect(createWorld(7, YEAR)).toEqual(createWorld(7, YEAR));
  });

  it("is a different world for a different seed", () => {
    expect(createWorld(7, YEAR)).not.toEqual(createWorld(8, YEAR));
  });

  it("refuses a season nobody has authored", () => {
    // Better a throw than a quiet fall back to the earliest year: a picker that
    // offered an unauthored season by mistake would otherwise look like it
    // worked, running someone else's grid under the wrong heading.
    const unauthored = Math.max(...seasons.keys()) + 1;
    expect(seasons.has(unauthored)).toBe(false);
    expect(() => createWorld(1, unauthored)).toThrow(String(unauthored));
  });

  it("records the grid it actually raced", () => {
    const world = createWorld(1, YEAR);
    expect(world.field).toHaveLength(SEATS);
    // Not just ids: the ratings that fed the simulation, which is what makes
    // this the record of the season rather than a pointer back to the seed.
    const entry = SEED.entries[0];
    const first = world.field.find((entrant) => entrant.driverId === entry?.drivers[0]);
    expect(first?.teamId).toBe(entry?.teamId);
    expect(first?.driver.racing).toBeGreaterThan(0);
    expect(first?.chassis.reliability).toBeGreaterThan(0);
  });

  it("survives a JSON round trip unchanged", () => {
    // The save-game invariant: the world is plain data. A function, a Map, or a
    // live `Rng` anywhere in it would silently vanish here.
    const world = createWorld(3, YEAR);
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("holds no functions anywhere", () => {
    // Stronger than the round trip, which a `Date` or a `Map` could survive by
    // turning into something else that happens to compare equal.
    const seen = new Set<unknown>();
    const walk = (value: unknown, path: string): void => {
      expect(typeof value, `${path} is a function`).not.toBe("function");
      if (typeof value !== "object" || value === null || seen.has(value)) {
        return;
      }
      seen.add(value);
      expect(
        Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
        `${path} is a class instance`,
      ).toBe(true);
      for (const [key, child] of Object.entries(value)) {
        walk(child, `${path}.${key}`);
      }
    };
    walk(createWorld(2, YEAR), "world");
  });

  it("stores an RNG snapshot that resumes the stream", () => {
    // Not a decoration: this is what a saved game continues from. Rebuilding
    // from the snapshot must give the same next value as carrying on would.
    const world = createWorld(5, YEAR);
    const resumed = createRngFromState(world.rngState);
    const again = createRngFromState(world.rngState);
    expect(resumed.next()).toBe(again.next());
    expect(world.rngState).not.toEqual(createWorld(6, YEAR).rngState);
  });

  it("produces a season the championship can be derived from", () => {
    const world = createWorld(4, YEAR);
    const drivers = championshipStandings(world.season, world.points);
    const teams = constructorStandings(world.season, world.points);
    expect(drivers).toHaveLength(SEATS);
    expect(teams).toHaveLength(TEAMS);
    expect(drivers.reduce((sum, s) => sum + s.points, 0)).toBe(
      teams.reduce((sum, t) => sum + t.points, 0),
    );
  });
});

describe("every authored season", () => {
  // The check that a newly authored year is actually playable, rather than
  // present in the data and broken on the way to the grid. Loops the registry,
  // so a season added tomorrow is covered without touching this file.
  it("runs a full season from its own calendar and entry list", () => {
    expect(seasons.size).toBeGreaterThan(0);
    for (const [year, seed] of seasons) {
      const world = createWorld(1, year);
      const seats = seed.entries.flatMap((entry) => entry.drivers);

      expect(world.year, `${year}`).toBe(year);
      expect(world.season.races, `${year}`).toHaveLength(seed.calendar.length);
      expect(
        world.field.map((entrant) => entrant.driverId),
        `${year}`,
      ).toEqual(seats);

      // And it produces a championship somebody could read.
      const standings = championshipStandings(world.season, world.points);
      expect(standings, `${year}`).toHaveLength(seats.length);
      expect(standings[0]?.points, `${year}`).toBeGreaterThan(0);
    }
  });

  it("scores each year on its own points scale", () => {
    for (const [year, seed] of seasons) {
      expect(createWorld(1, year).points, `${year}`).toEqual(seed.points);
    }
  });

  it("pays a race winner what that season's scale pays, not one fixed number", () => {
    // The assertion that catches a scale hard-coded anywhere between the result
    // rows and the table: after one round the winner's total is the first entry
    // of that year's own scale, whatever it happens to be.
    for (const [year, seed] of seasons) {
      const world = createWorld(1, year);
      const opener = world.season.races[0];
      const winner = opener?.winnerDriverId;
      if (opener === undefined || winner === null || winner === undefined) {
        continue;
      }
      const afterOne = championshipStandings({ races: [opener] }, world.points);
      const leader = afterOne.find((standing) => standing.driverId === winner);
      // Against the *authored* scale, not the world's copy of it, so the whole
      // path from seed file to table is on the hook rather than half of it.
      expect(leader?.points, `${year}`).toBe(seed.points[0]);
    }
  });

  it("pays exactly as many places as its scale has, and no more", () => {
    // The other half: a year paying ten places must credit a tenth place, and a
    // year paying six must not. Counted off the scale, never written down.
    for (const [year, seed] of seasons) {
      const world = createWorld(1, year);
      const opener = world.season.races[0];
      if (opener === undefined) {
        continue;
      }
      const table = championshipStandings({ races: [opener] }, world.points);
      const scored = table.filter((standing) => standing.points > 0).length;
      const places = opener.entries.filter(
        (entry) => entry.finishPosition !== null && entry.finishPosition <= seed.points.length,
      ).length;
      expect(scored, `${year}`).toBe(places);
    }
  });

  it("gives each season its own results, not a copy of the first", () => {
    const years = [...seasons.keys()];
    if (years.length < 2) {
      return;
    }
    const [first, second] = years;
    expect(createWorld(1, first ?? 0).season).not.toEqual(createWorld(1, second ?? 0).season);
  });

  it("is reproducible per year, like any other world", () => {
    for (const year of seasons.keys()) {
      expect(createWorld(7, year), `${year}`).toEqual(createWorld(7, year));
    }
  });
});

/** The run in the store, or null when there is none. */
function active(): Run | null {
  return useSeasonStore.getState().run;
}

/** The season on screen, or a throw naming what was there instead. */
function running(): { world: World; view: Beat } {
  const current = active();
  if (current?.kind !== "season") {
    throw new Error(`expected a season on screen, found "${current?.kind ?? "no run"}"`);
  }
  return { world: current.world, view: current.cursor };
}

/** The run on to the end of the season on the cursor — the run bar's skip. */
function skipToEnd(): void {
  const current = active();
  if (current !== null) {
    useSeasonStore.getState().jumpTo({ year: current.world.year, beat: { kind: "summary" } });
  }
}

describe("the run", () => {
  beforeEach(() => {
    useSeasonStore.getState().exitRun();
  });

  it("opens with no run, nothing simulated", () => {
    // The app used to run a season on page load that nobody had asked for.
    expect(active()).toBeNull();
  });

  it("holds a season once one is started", () => {
    useSeasonStore.getState().startSeason(YEAR);
    expect(running().world.year).toBe(YEAR);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("discards a season in progress on exit", () => {
    useSeasonStore.getState().simulate(11, YEAR);
    skipToEnd();
    useSeasonStore.getState().exitRun();
    expect(active()).toBeNull();
  });

  it("ignores the season controls when no season is on screen", () => {
    // They are wired to buttons only the season screen renders, but a no-op is
    // a better answer than a crash on a world that does not exist.
    for (const act of ["continueRun", "restartSeason", "restartEra"] as const) {
      useSeasonStore.getState()[act]();
      expect(active(), act).toBeNull();
    }
  });

  it("draws a different season each time one is started", () => {
    useSeasonStore.getState().startSeason(YEAR);
    const first = running().world.seed;
    useSeasonStore.getState().startSeason(YEAR);
    expect(running().world.seed).not.toBe(first);
  });

  it("gives the same world for the same seed however it is reached", () => {
    useSeasonStore.getState().simulate(9, YEAR);
    expect(running().world).toEqual(createWorld(9, YEAR));
  });

  it("replaces the world when a new seed is simulated", () => {
    useSeasonStore.getState().simulate(21, YEAR);
    const before = running().world;
    useSeasonStore.getState().simulate(22, YEAR);
    const after = running().world;
    expect(after.seed).toBe(22);
    expect(after.season).not.toEqual(before.season);
    // A fresh object, not a mutation of the old one — that is what makes the
    // subscription fire and the tables re-render.
    expect(after).not.toBe(before);
  });
});

describe("revealing the season", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("opens on the grid", () => {
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("steps the cursor without re-running anything", () => {
    const before = running().world;
    useSeasonStore.getState().continueRun();
    expect(running().view).toEqual({ kind: "qualifying", round: 0 });
    // The year was simulated the moment the seed was drawn, so revealing it
    // hands back the very same object.
    expect(running().world).toBe(before);
  });

  it("skips to the summary from anywhere", () => {
    useSeasonStore.getState().continueRun();
    skipToEnd();
    expect(running().view).toEqual({ kind: "summary" });
  });

  it("jumps nowhere but this season's end, in a one-year run", () => {
    const before = active();
    for (const year of [YEAR - 1, YEAR + 1]) {
      useSeasonStore.getState().jumpTo({ year, beat: { kind: "summary" } });
      expect(active(), String(year)).toBe(before);
    }
  });

  it("goes nowhere past the summary, which is where a one-year run ends", () => {
    skipToEnd();
    const before = active();
    useSeasonStore.getState().continueRun();
    expect(active()).toBe(before);
  });

  it("starts a fresh season of the same year, back at the grid", () => {
    // "Beginning of the season" is another go, not a replay: same year, new
    // seed, so the results are the reader's to discover again.
    skipToEnd();
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    expect(running().view).toEqual({ kind: "grid" });
    expect(running().world.year).toBe(before.year);
    expect(running().world.seed).not.toBe(before.seed);
    expect(running().world.season).not.toEqual(before.season);
  });
});

describe("driver ability mode", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("starts on peak, the mode the app is built around", () => {
    expect(running().world.ratingMode).toBe("peak");
  });

  it("re-runs the same seed against age-adjusted drivers", () => {
    const before = running().world;
    useSeasonStore.getState().setRatingMode("aged");
    const after = running().world;

    expect(after.ratingMode).toBe("aged");
    // Same dice, different drivers: that is what makes the two comparable.
    expect(after.seed).toBe(before.seed);
    expect(after.year).toBe(before.year);
    expect(after.field).not.toEqual(before.field);
    expect(after.season).not.toEqual(before.season);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("rates at least one driver differently once ages are applied", () => {
    // Which drivers move, and by how much, is a question for the ageing curve's
    // own tests — here it only has to be true that the mode reaches the field.
    useSeasonStore.getState().setRatingMode("aged");
    const aged = running().world;
    const peak = createWorld(aged.seed, aged.year, "peak").field;
    const moved = agedDiffers(aged);

    const before = peak.find((entrant) => entrant.driverId === moved)?.driver.racing ?? 0;
    const after = aged.field.find((entrant) => entrant.driverId === moved)?.driver.racing ?? 0;
    expect(after).not.toBe(before);
    // Nobody is *invented* by the switch: the same seats, the same drivers.
    expect(aged.field.map((entrant) => entrant.driverId)).toEqual(
      peak.map((entrant) => entrant.driverId),
    );
  });

  it("goes back to peak again", () => {
    useSeasonStore.getState().setRatingMode("aged");
    useSeasonStore.getState().setRatingMode("peak");
    expect(running().world).toEqual(createWorld(3, YEAR, "peak"));
  });

  it("refuses to switch once the season has started revealing", () => {
    // Past the grid the reader has seen results the new field would never have
    // produced, so the switch is not offered and the action does nothing.
    useSeasonStore.getState().continueRun();
    const before = running().world;
    useSeasonStore.getState().setRatingMode("aged");
    expect(running().world).toBe(before);
    expect(running().world.ratingMode).toBe("peak");
  });

  it("carries the chosen mode through Restart season", () => {
    // Picking aged drivers is a choice about how to play, not a property of one
    // season — starting another must not quietly hand back peak ratings.
    useSeasonStore.getState().setRatingMode("aged");
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    const after = running().world;

    expect(after.ratingMode).toBe("aged");
    expect(after.seed).not.toBe(before.seed);
    expect(after.field).toEqual(before.field);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("carries peak through it too, rather than pinning either mode", () => {
    // The mirror case, so the fix cannot be "always aged".
    useSeasonStore.getState().restartSeason();
    expect(running().world.ratingMode).toBe("peak");
  });

  it("is part of the save file like everything else", () => {
    useSeasonStore.getState().setRatingMode("aged");
    const world = running().world;
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });
});

describe("the randomness level", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("starts a world on the engine's default level when none is given", () => {
    expect(running().world.randomness).toBe(DEFAULT_RANDOMNESS_LEVEL);
  });

  it("races the same seed to a different season at a different level", () => {
    // The whole point of the setting: same year, same grid, same dice — a
    // different championship, because the dice are weighted differently.
    const balanced = createWorld(3, YEAR, "peak", null, null, DEFAULT_RANDOMNESS_LEVEL);
    const chaotic = createWorld(3, YEAR, "peak", null, null, 5);

    expect(chaotic.randomness).toBe(5);
    expect(chaotic.seed).toBe(balanced.seed);
    expect(chaotic.field).toEqual(balanced.field);
    expect(chaotic.season).not.toEqual(balanced.season);
  });

  it("reproduces exactly at the same seed and the same level", () => {
    expect(createWorld(3, YEAR, "peak", null, null, 4)).toEqual(
      createWorld(3, YEAR, "peak", null, null, 4),
    );
  });

  it("leaves the default season byte for byte what it always was", () => {
    // The guarantee the whole feature rests on: passing the default explicitly
    // must be indistinguishable from a build that had never heard of the
    // slider.
    expect(createWorld(3, YEAR, "peak", null, null, DEFAULT_RANDOMNESS_LEVEL)).toEqual(
      createWorld(3, YEAR, "peak"),
    );
  });

  it("is fixed for the run: no action on a season changes it", () => {
    const level = 5;
    useSeasonStore.getState().simulate(3, YEAR, "peak", level);
    useSeasonStore.getState().setRatingMode("aged");
    expect(running().world.randomness).toBe(level);
    useSeasonStore.getState().setGrid(null, null);
    expect(running().world.randomness).toBe(level);
  });

  it("carries through Restart season, like every other choice", () => {
    useSeasonStore.getState().simulate(3, YEAR, "peak", 4);
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    const after = running().world;

    expect(after.randomness).toBe(4);
    expect(after.seed).not.toBe(before.seed);
  });

  it("is part of the save file like everything else", () => {
    useSeasonStore.getState().simulate(3, YEAR, "peak", 5);
    const world = running().world;
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });
});

describe("the chosen grid", () => {
  const authored = AUTHORED;
  /** A driver with no drive, put into the first seat on the entry list. */
  const swapped = swapDrivers(authored, SEATED, RESERVE);

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("starts on the grid the season was entered with", () => {
    expect(running().world.lineup).toBeNull();
  });

  it("re-runs the same seed with the reader's own grid", () => {
    const before = running().world;
    useSeasonStore.getState().setGrid(swapped, null);
    const after = running().world;

    expect(after.lineup).toEqual(swapped);
    expect(after.seed).toBe(before.seed);
    // Same dice, different people: the point of keeping the seed.
    expect(after.season).not.toEqual(before.season);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("puts the swapped-in driver in the team's chassis, and the other out of the field", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const field = running().world.field;
    const team = field.filter((entrant) => entrant.teamId === SEATED_TEAM);

    expect(field).toHaveLength(SEATS);
    expect(team.map((entrant) => entrant.driverId)).toContain(RESERVE);
    expect(field.map((entrant) => entrant.driverId)).not.toContain(SEATED);
    // The chassis is the team's, not the driver's: the newcomer inherits it.
    const was = createWorld(3, YEAR).field.find((entrant) => entrant.driverId === SEATED)?.chassis;
    expect(team.find((entrant) => entrant.driverId === RESERVE)?.chassis).toEqual(was);
  });

  it("races whoever was put in, so the results are theirs", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const scored = running().world;
    const scorers = championshipStandings(scored.season, scored.points).map((row) => row.driverId);
    expect(scorers).toContain(RESERVE);
    expect(scorers).not.toContain(SEATED);
  });

  it("treats a grid edited back to how it started as unedited", () => {
    // Otherwise a reader who undoes their last swap is told for the rest of the
    // season that they changed something.
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().setGrid(swapDrivers(swapped, RESERVE, SEATED), null);
    expect(running().world.lineup).toBeNull();
    expect(running().world.season).toEqual(createWorld(3, YEAR).season);
  });

  it("goes back to the entered grid when handed null", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().setGrid(null, null);
    expect(running().world).toEqual(createWorld(3, YEAR));
  });

  it("refuses to change the grid once the season has started revealing", () => {
    // Same rule as the ability toggle, for the same reason: the reader has seen
    // results that a different field would never have produced.
    useSeasonStore.getState().continueRun();
    const before = running().world;
    useSeasonStore.getState().setGrid(swapped, null);
    expect(running().world).toBe(before);
    expect(running().world.lineup).toBeNull();
  });

  it("carries the grid through Restart season, on fresh dice", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const before = running().world;
    useSeasonStore.getState().restartSeason();
    const after = running().world;

    expect(after.lineup).toEqual(swapped);
    expect(after.field).toEqual(before.field);
    expect(after.seed).not.toBe(before.seed);
  });

  it("keeps it through a change of ability mode", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().setRatingMode("aged");
    const world = running().world;

    expect(world.lineup).toEqual(swapped);
    expect(world.ratingMode).toBe("aged");
    // And the two are applied together: the chosen grid, at its real ages.
    expect(world.field).toEqual(createWorld(3, YEAR, "aged", swapped).field);
    expect(world.field.map((entrant) => entrant.driverId)).toContain(RESERVE);
  });

  it("does not follow the reader to a new season from the menu", () => {
    // The grid belongs to the year it was drawn for; a fresh start is a fresh
    // grid, unlike the ability mode, which is a way of playing.
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().exitRun();
    useSeasonStore.getState().startSeason(YEAR);
    expect(running().world.lineup).toBeNull();
  });

  it("is part of the save file like everything else", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const world = running().world;
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("refuses a lineup that would put three cars in a team", () => {
    // The store is not the only way in — a save file is another — and a field
    // of 29 would quietly break the arithmetic the starting limit was set to.
    const crowded = [...(authored[SEATED_TEAM] ?? []), RESERVE];
    expect(() => createWorld(3, YEAR, "peak", { ...authored, [SEATED_TEAM]: crowded })).toThrow(
      `${crowded.length} drivers`,
    );
  });
});

describe("the grid arranged by rule", () => {
  /** One of the editor's bulk rules, as the grid stage hands one over. */
  const ranked: GridArrangement = {
    kind: "fastest-in-fastest",
    includeUnemployed: false,
    // The pool the rule may draw on, which only matters when it is allowed to:
    // the panel's own defaults, since nothing here is about filtering.
    filters: DEFAULT_DRIVER_FILTERS,
    retain: false,
  };
  const shuffled: GridArrangement = { ...ranked, kind: "random" };

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("starts on no rule at all", () => {
    expect(running().world.arrangement).toBeNull();
  });

  it("records the rule beside the lineup it produced", () => {
    useSeasonStore.getState().setGrid(swapDrivers(AUTHORED, SEATED, RESERVE), null, ranked);
    expect(running().world.arrangement).toEqual(ranked);
  });

  it("records nothing for a grid the reader assembled by hand", () => {
    // The default, and the case every caller that predates the rules is in.
    useSeasonStore.getState().setGrid(swapDrivers(AUTHORED, SEATED, RESERVE), null);
    expect(running().world.arrangement).toBeNull();
  });

  it("keeps the rule recorded even when it lands on the entered grid", () => {
    // A shuffle can come back with everybody where the season put them. The
    // lineup is then null, like any unedited grid, but the reader pressed a
    // button and the screen still has to say which.
    useSeasonStore.getState().setGrid(null, null, shuffled);
    expect(running().world.lineup).toBeNull();
    expect(running().world.arrangement).toEqual(shuffled);
  });

  it("is part of the save file, and stays plain data", () => {
    useSeasonStore.getState().setGrid(null, null, ranked);
    const world = running().world;
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("re-runs a ranked rule through Restart season, on fresh dice and the same grid", () => {
    // Applied, then restarted twice: the first restart is what materialises the
    // rule into a lineup, and the second is the claim — a rule that ranks by
    // rating does not depend on the dice, so a new seed must hand back the same
    // grid. A store that carried the *seats* instead of the rule would also come
    // back identical, which is why the rule itself is asserted beside them.
    useSeasonStore.getState().setGrid(null, null, ranked);
    useSeasonStore.getState().restartSeason();
    const arranged = running().world.lineup;
    const seed = running().world.seed;
    useSeasonStore.getState().restartSeason();

    expect(arranged).not.toBeNull();
    expect(running().world.arrangement).toEqual(ranked);
    expect(running().world.lineup).toEqual(arranged);
    expect(running().world.seed).not.toBe(seed);
  });

  it("re-rolls a shuffled grid on Restart season, given enough goes", () => {
    // Not an assertion about one restart: two shuffles of the same field can
    // agree. What must not happen is the grid being frozen for the rest of the
    // run, which is what carrying the lineup instead of the rule would do.
    useSeasonStore.getState().setGrid(null, null, shuffled);
    const first = JSON.stringify(running().world.lineup);
    const grids = new Set([first]);
    for (let go = 0; go < 8; go += 1) {
      useSeasonStore.getState().restartSeason();
      grids.add(JSON.stringify(running().world.lineup));
    }
    expect(grids.size).toBeGreaterThan(1);
  });

  it("arranges again when the ability mode changes, since that is who is fastest", () => {
    useSeasonStore.getState().simulate(3, YEAR, "peak");
    useSeasonStore.getState().setGrid(null, null, ranked);
    useSeasonStore.getState().setRatingMode("aged");
    const aged = running().world.lineup;
    useSeasonStore.getState().setRatingMode("peak");

    expect(aged).not.toBeNull();
    expect(running().world.arrangement).toEqual(ranked);
    // The two modes rank the field differently, so the same rule seats them
    // differently. Carrying the lineup instead of re-running the rule would
    // leave "the fastest drivers" meaning the other mode's fastest.
    expect(running().world.lineup).not.toEqual(aged);
  });

  it("gives the same answer flipping back, so the switch is not a slot machine", () => {
    useSeasonStore.getState().simulate(3, YEAR, "peak");
    useSeasonStore.getState().setGrid(null, null, shuffled);
    useSeasonStore.getState().setRatingMode("aged");
    const first = running().world.lineup;
    useSeasonStore.getState().setRatingMode("peak");
    useSeasonStore.getState().setRatingMode("aged");

    expect(first).not.toBeNull();
    // Re-rolled from the same seed over the same entry list, which is why the
    // rule is never re-run over the grid it last produced: a shuffle of a
    // shuffle would make a toggle into a dice cup.
    expect(running().world.lineup).toEqual(first);
  });

  it("drops the rule with the grid when stepping to the season next door", () => {
    const next = adjacentSeason(YEAR, 1);
    if (next === null) {
      throw new Error("the range needs a season after the first");
    }
    useSeasonStore.getState().setGrid(null, null, ranked);
    useSeasonStore.getState().switchSeasonYear(next);
    expect(running().world.arrangement).toBeNull();
    expect(running().world.lineup).toBeNull();
  });

  it("refuses a rule once the season has started revealing", () => {
    useSeasonStore.getState().continueRun();
    const before = running().world;
    useSeasonStore.getState().setGrid(null, null, ranked);
    expect(running().world).toBe(before);
  });
});

describe("the remembered ability mode", () => {
  /** A fake storage holding a previous visit's choice. */
  function storedAs(mode: string): void {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (): string => mode,
        setItem: (): void => {},
      },
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("starts a season from the menu in the remembered mode", () => {
    // The path the reader takes on Exit run → Season → YEAR. Without the
    // preference this came back peak every time.
    storedAs("aged");
    useSeasonStore.getState().exitRun();
    useSeasonStore.getState().startSeason(YEAR);
    expect(running().world.ratingMode).toBe("aged");
  });

  it("still opens on peak when nothing has been chosen", () => {
    useSeasonStore.getState().exitRun();
    useSeasonStore.getState().startSeason(YEAR);
    expect(running().world.ratingMode).toBe("peak");
  });

  it("writes the choice down when the toggle is used", () => {
    // The other half of the loop: nothing above works if the toggle never
    // records what was picked.
    const written: string[] = [];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (): null => null,
        setItem: (_key: string, value: string): void => {
          written.push(value);
        },
      },
    });
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().setRatingMode("aged");
    expect(written).toContain("aged");
  });

  it("keeps the seeded entry point free of it", () => {
    // `simulate` must depend only on its arguments, or every test that uses it
    // becomes order-dependent on whatever was last remembered.
    storedAs("aged");
    useSeasonStore.getState().simulate(3, YEAR);
    expect(running().world.ratingMode).toBe("peak");
  });
});

describe("the chosen engines", () => {
  /**
   * A team, and an engine the season rates that it did not run. Found rather
   * than named: who supplied whom is history, but which engines a year has is
   * authored data that moves as seasons are added.
   */
  const swap = (() => {
    for (const entry of SEED.entries) {
      const other = SEED.engines.find((engine) => engine.engineId !== entry.engineId);
      if (other !== undefined) {
        return { teamId: entry.teamId, from: entry.engineId, to: other.engineId };
      }
    }
    throw new Error("the season rates only one engine");
  })();
  const authored = authoredEngines(SEED);
  const resupplied = { ...authored, [swap.teamId]: swap.to };

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("starts on the supply deals the season was entered with", () => {
    expect(running().world.engines).toBeNull();
  });

  it("re-runs the same seed with the reader's own supply", () => {
    const before = running().world;
    useSeasonStore.getState().setGrid(null, resupplied);
    const after = running().world;

    expect(after.engines).toEqual(resupplied);
    expect(after.seed).toBe(before.seed);
    // Same dice, a different car: the point of keeping the seed.
    expect(after.season).not.toEqual(before.season);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("puts the new engine in the field it races", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    const moved = running().world.field.filter((entrant) => entrant.teamId === swap.teamId);
    expect(moved.length).toBeGreaterThan(0);
    for (const entrant of moved) {
      expect(entrant.engineId).toBe(swap.to);
    }
  });

  it("leaves every other team on the engine it had", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    for (const entrant of running().world.field) {
      if (entrant.teamId !== swap.teamId) {
        expect(entrant.engineId, entrant.teamId).toBe(authored[entrant.teamId]);
      }
    }
  });

  it("forgets a supply that is the authored one, so nothing claims a change", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    useSeasonStore.getState().setGrid(null, authored);
    expect(running().world.engines).toBeNull();
    expect(running().world.season).toEqual(createWorld(3, YEAR).season);
  });

  it("applies drivers and engines as one edit", () => {
    const swapped = swapDrivers(AUTHORED, SEATED, RESERVE);
    useSeasonStore.getState().setGrid(swapped, resupplied);
    const world = running().world;

    expect(world.lineup).toEqual(swapped);
    expect(world.engines).toEqual(resupplied);
    expect(world.season).toEqual(createWorld(3, YEAR, "peak", swapped, resupplied).season);
  });

  it("carries the supply into a fresh seed of the same season", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    useSeasonStore.getState().restartSeason();
    expect(running().world.engines).toEqual(resupplied);
  });

  it("carries the supply across a change of ability model", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    useSeasonStore.getState().setRatingMode("aged");
    expect(running().world.engines).toEqual(resupplied);
    expect(running().world.ratingMode).toBe("aged");
  });

  it("cannot be changed once the season has started revealing", () => {
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().setGrid(null, resupplied);
    expect(running().world.engines).toBeNull();
  });

  it("is part of the save file like everything else", () => {
    useSeasonStore.getState().setGrid(null, resupplied);
    const world = running().world;
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("refuses an engine the season does not rate", () => {
    expect(() => {
      useSeasonStore.getState().setGrid(null, { ...authored, [swap.teamId]: "phlogiston" });
    }).toThrow(/no engine "phlogiston"/);
  });
});

describe("stepping to the season next door", () => {
  /** The year after the fixture one, off the playable list. */
  const NEXT = adjacentSeason(YEAR, 1);
  if (NEXT === null) {
    throw new Error("the fixtures need at least two authored seasons");
  }

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR, "aged", 4);
  });

  it("runs the neighbouring year, back at its grid", () => {
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(running().world.year).toBe(NEXT);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("keeps how the reader chose to play, not the remembered preferences", () => {
    // The whole difference from `startSeason`: someone stepping through a
    // decade keeps the ability mode and the randomness they set for the first
    // of them rather than being handed whatever storage last saw.
    const before = running().world;
    useSeasonStore.getState().switchSeasonYear(NEXT);
    const after = running().world;
    expect(after.ratingMode).toBe(before.ratingMode);
    expect(after.randomness).toBe(before.randomness);
  });

  it("draws fresh dice rather than replaying the year's stream", () => {
    const before = running().world.seed;
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(running().world.seed).not.toBe(before);
  });

  it("does not carry a grid across a year boundary", () => {
    // A lineup and a set of supply deals belong to the entry list they were
    // drawn for; there is no sense in which they mean anything a year later.
    useSeasonStore.getState().setGrid(swapDrivers(AUTHORED, SEATED, RESERVE), null);
    expect(running().world.lineup).not.toBeNull();
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(running().world.lineup).toBeNull();
    expect(running().world.engines).toBeNull();
  });

  it("refuses once the season has started revealing", () => {
    // Same rule as the ability toggle and the grid editor, for the same reason.
    useSeasonStore.getState().continueRun();
    const before = running().world;
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(running().world).toBe(before);
    expect(running().world.year).toBe(YEAR);
  });

  it("does nothing at all off a season screen", () => {
    useSeasonStore.getState().exitRun();
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(active()).toBeNull();
  });

  it("leaves an era's year to the run", () => {
    // An era's next year comes from the run, not the reader: a button that
    // jumped out of it would be leaving the mode rather than stepping in it.
    useSeasonStore.getState().simulateEra(5, YEAR);
    const before = active();
    useSeasonStore.getState().switchSeasonYear(NEXT);
    expect(active()).toBe(before);
  });
});

describe("an untouched run, which can be left without asking", () => {
  /** Whether the run in the store is untouched, or a throw if there is none. */
  function untouched(): boolean {
    const current = active();
    if (current === null) {
      throw new Error("expected a run");
    }
    return isUntouched(current);
  }

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR);
  });

  it("is a fresh season on its grid", () => {
    expect(untouched()).toBe(true);
  });

  it("stays untouched through the ability toggle and the year switcher", () => {
    // Neither loses anything: the mode is remembered, and the switcher only
    // draws a different season.
    useSeasonStore.getState().setRatingMode("aged");
    expect(untouched()).toBe(true);
    const next = adjacentSeason(YEAR, 1);
    if (next !== null) {
      useSeasonStore.getState().switchSeasonYear(next);
      expect(untouched()).toBe(true);
    }
  });

  it("is touched once anything has been revealed", () => {
    useSeasonStore.getState().continueRun();
    expect(untouched()).toBe(false);
  });

  it("is touched by an edited grid: a swap, or a rule", () => {
    useSeasonStore.getState().setGrid(swapDrivers(AUTHORED, SEATED, RESERVE), null);
    expect(untouched()).toBe(false);
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().setGrid(null, null, {
      kind: "random",
      includeUnemployed: false,
      filters: DEFAULT_DRIVER_FILTERS,
      retain: false,
    });
    expect(untouched()).toBe(false);
  });

  it("is untouched again when an edit is undone", () => {
    // `createWorld` normalises a grid put back as it was entered to no edit.
    useSeasonStore.getState().setGrid(swapDrivers(AUTHORED, SEATED, RESERVE), null);
    useSeasonStore.getState().setGrid(AUTHORED, null);
    expect(untouched()).toBe(true);
  });
});
