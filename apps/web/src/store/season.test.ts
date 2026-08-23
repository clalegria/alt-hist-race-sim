import {
  authoredEngines,
  authoredLineup,
  FIRST_AUTHORED_SEASON,
  reserveDrivers,
  seasonSeed,
  seasons,
  swapDrivers,
} from "@alt-hist/data";
import { championshipStandings, constructorStandings, createRngFromState } from "@alt-hist/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  advance,
  createWorld,
  type Screen,
  useSeasonStore,
  type View,
  type World,
} from "./season.js";

/** The year these fixtures run in, and the seats it enters. */
const YEAR = FIRST_AUTHORED_SEASON;
const SEED = seasonSeed(YEAR);
const SEATS = SEED.entries.flatMap((entry) => entry.drivers).length;
const TEAMS = SEED.entries.length;

/**
 * A driver in a seat, and one without — chosen out of the data rather than by
 * name, because roadmap 2 turns some of today's reserves into entrants.
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
    expect(createWorld(1, 1980).season.races).toHaveLength(SEED.calendar.length);
  });

  it("is the same world for the same seed", () => {
    expect(createWorld(7, 1980)).toEqual(createWorld(7, 1980));
  });

  it("is a different world for a different seed", () => {
    expect(createWorld(7, 1980)).not.toEqual(createWorld(8, 1980));
  });

  it("refuses a season nobody has authored", () => {
    // Better a throw than a quiet fall back to the earliest year: a picker that
    // offered an unauthored season by mistake would otherwise look like it
    // worked, running someone else's grid under the wrong heading.
    const unauthored = 1999;
    expect(seasons.has(unauthored)).toBe(false);
    expect(() => createWorld(1, unauthored)).toThrow(String(unauthored));
  });

  it("records the grid it actually raced", () => {
    const world = createWorld(1, 1980);
    expect(world.field).toHaveLength(SEATS);
    // Not just ids: the ratings that fed the simulation, which is what makes
    // this the record of the season rather than a pointer back to the seed.
    const jones = world.field.find((entrant) => entrant.driverId === "jones");
    expect(jones?.teamId).toBe("williams");
    expect(jones?.driver.racing).toBeGreaterThan(0);
    expect(jones?.car.reliability).toBeGreaterThan(0);
  });

  it("survives a JSON round trip unchanged", () => {
    // The save-game invariant: the world is plain data. A function, a Map, or a
    // live `Rng` anywhere in it would silently vanish here.
    const world = createWorld(3, 1980);
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
    walk(createWorld(2, 1980), "world");
  });

  it("stores an RNG snapshot that resumes the stream", () => {
    // Not a decoration: this is what a saved game continues from. Rebuilding
    // from the snapshot must give the same next value as carrying on would.
    const world = createWorld(5, 1980);
    const resumed = createRngFromState(world.rngState);
    const again = createRngFromState(world.rngState);
    expect(resumed.next()).toBe(again.next());
    expect(world.rngState).not.toEqual(createWorld(6, 1980).rngState);
  });

  it("produces a season the championship can be derived from", () => {
    const world = createWorld(4, 1980);
    const drivers = championshipStandings(world.season);
    const teams = constructorStandings(world.season);
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
      const standings = championshipStandings(world.season);
      expect(standings, `${year}`).toHaveLength(seats.length);
      expect(standings[0]?.points, `${year}`).toBeGreaterThan(0);
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

function screen(): Screen {
  return useSeasonStore.getState().screen;
}

/** The season on screen, or a throw naming what was there instead. */
function running(): { world: World; view: View } {
  const current = screen();
  if (current.kind !== "season") {
    throw new Error(`expected a season on screen, found "${current.kind}"`);
  }
  return { world: current.world, view: current.view };
}

describe("the screens", () => {
  beforeEach(() => {
    useSeasonStore.getState().openMenu();
  });

  it("opens on the menu, with nothing simulated", () => {
    // The app used to run a season on page load that nobody had asked for.
    expect(screen()).toEqual({ kind: "menu" });
  });

  it("goes menu, then setup, then a season", () => {
    useSeasonStore.getState().openSeasonSetup();
    expect(screen().kind).toBe("season-setup");
    useSeasonStore.getState().startSeason(1980);
    expect(running().world.year).toBe(1980);
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("comes back to the menu from a season in progress", () => {
    useSeasonStore.getState().simulate(11, 1980);
    useSeasonStore.getState().skipToEnd();
    useSeasonStore.getState().openMenu();
    expect(screen()).toEqual({ kind: "menu" });
  });

  it("ignores the season controls when no season is on screen", () => {
    // They are wired to buttons only the season screen renders, but a no-op is
    // a better answer than a crash on a world that does not exist.
    for (const act of ["nextSession", "skipToEnd", "restartSeason"] as const) {
      useSeasonStore.getState()[act]();
      expect(screen(), act).toEqual({ kind: "menu" });
    }
  });

  it("draws a different season each time one is started", () => {
    useSeasonStore.getState().startSeason(1980);
    const first = running().world.seed;
    useSeasonStore.getState().startSeason(1980);
    expect(running().world.seed).not.toBe(first);
  });

  it("gives the same world for the same seed however it is reached", () => {
    useSeasonStore.getState().simulate(9, 1980);
    expect(running().world).toEqual(createWorld(9, 1980));
  });

  it("replaces the world when a new seed is simulated", () => {
    useSeasonStore.getState().simulate(21, 1980);
    const before = running().world;
    useSeasonStore.getState().simulate(22, 1980);
    const after = running().world;
    expect(after.seed).toBe(22);
    expect(after.season).not.toEqual(before.season);
    // A fresh object, not a mutation of the old one — that is what makes the
    // subscription fire and the tables re-render.
    expect(after).not.toBe(before);
  });
});

describe("revealing the season", () => {
  const ROUNDS = 14;

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, 1980);
  });

  it("opens on the grid", () => {
    expect(running().view).toEqual({ kind: "grid" });
  });

  it("walks qualifying, race, qualifying, race", () => {
    let view = advance({ kind: "grid" }, ROUNDS);
    expect(view).toEqual({ kind: "qualifying", round: 0 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "race", round: 0 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "qualifying", round: 1 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "race", round: 1 });
  });

  it("reaches the summary after the last race, not before", () => {
    expect(advance({ kind: "race", round: ROUNDS - 2 }, ROUNDS)).toEqual({
      kind: "qualifying",
      round: ROUNDS - 1,
    });
    expect(advance({ kind: "race", round: ROUNDS - 1 }, ROUNDS)).toEqual({ kind: "summary" });
  });

  it("shows every session exactly once on the way through", () => {
    // Two per round plus the summary; anything else means a skipped or
    // repeated session.
    const seen: View[] = [];
    let view: View = { kind: "grid" };
    for (let step = 0; step < ROUNDS * 2 + 5; step += 1) {
      view = advance(view, ROUNDS);
      seen.push(view);
      if (view.kind === "summary") {
        break;
      }
    }
    expect(seen).toHaveLength(ROUNDS * 2 + 1);
    expect(seen.filter((v) => v.kind === "qualifying")).toHaveLength(ROUNDS);
    expect(seen.filter((v) => v.kind === "race")).toHaveLength(ROUNDS);
  });

  it("stays put once the season is over", () => {
    expect(advance({ kind: "summary" }, ROUNDS)).toEqual({ kind: "summary" });
  });

  it("steps the cursor without re-running anything", () => {
    const before = running().world;
    useSeasonStore.getState().nextSession();
    expect(running().view).toEqual({ kind: "qualifying", round: 0 });
    // The year was simulated the moment the seed was drawn, so revealing it
    // hands back the very same object.
    expect(running().world).toBe(before);
  });

  it("skips to the summary from anywhere", () => {
    useSeasonStore.getState().nextSession();
    useSeasonStore.getState().skipToEnd();
    expect(running().view).toEqual({ kind: "summary" });
  });

  it("starts a fresh season of the same year, back at the grid", () => {
    // "Beginning of the season" is another go, not a replay: same year, new
    // seed, so the results are the reader's to discover again.
    useSeasonStore.getState().skipToEnd();
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
    useSeasonStore.getState().simulate(3, 1980);
  });

  it("starts on peak, which is the mode the calibration describes", () => {
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
    expect(running().world).toEqual(createWorld(3, 1980, "peak"));
  });

  it("refuses to switch once the season has started revealing", () => {
    // Past the grid the reader has seen results the new field would never have
    // produced, so the switch is not offered and the action does nothing.
    useSeasonStore.getState().nextSession();
    const before = running().world;
    useSeasonStore.getState().setRatingMode("aged");
    expect(running().world).toBe(before);
    expect(running().world.ratingMode).toBe("peak");
  });

  it("carries the chosen mode through Start again", () => {
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

describe("the chosen grid", () => {
  const authored = AUTHORED;
  /** A driver with no drive, put into the first seat on the entry list. */
  const swapped = swapDrivers(authored, SEATED, RESERVE);

  beforeEach(() => {
    useSeasonStore.getState().simulate(3, 1980);
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

  it("puts the swapped-in driver in the team's car, and the other out of the field", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const field = running().world.field;
    const team = field.filter((entrant) => entrant.teamId === SEATED_TEAM);

    expect(field).toHaveLength(SEATS);
    expect(team.map((entrant) => entrant.driverId)).toContain(RESERVE);
    expect(field.map((entrant) => entrant.driverId)).not.toContain(SEATED);
    // The car is the team's, not the driver's: the newcomer inherits it.
    const was = createWorld(3, 1980).field.find((entrant) => entrant.driverId === SEATED)?.car;
    expect(team.find((entrant) => entrant.driverId === RESERVE)?.car).toEqual(was);
  });

  it("races whoever was put in, so the results are theirs", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    const scorers = championshipStandings(running().world.season).map((row) => row.driverId);
    expect(scorers).toContain(RESERVE);
    expect(scorers).not.toContain(SEATED);
  });

  it("treats a grid edited back to how it started as unedited", () => {
    // Otherwise a reader who undoes their last swap is told for the rest of the
    // season that they changed something.
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().setGrid(swapDrivers(swapped, RESERVE, SEATED), null);
    expect(running().world.lineup).toBeNull();
    expect(running().world.season).toEqual(createWorld(3, 1980).season);
  });

  it("goes back to the entered grid when handed null", () => {
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().setGrid(null, null);
    expect(running().world).toEqual(createWorld(3, 1980));
  });

  it("refuses to change the grid once the season has started revealing", () => {
    // Same rule as the ability toggle, for the same reason: the reader has seen
    // results that a different field would never have produced.
    useSeasonStore.getState().nextSession();
    const before = running().world;
    useSeasonStore.getState().setGrid(swapped, null);
    expect(running().world).toBe(before);
    expect(running().world.lineup).toBeNull();
  });

  it("carries the grid through Start again, on fresh dice", () => {
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
    expect(world.field).toEqual(createWorld(3, 1980, "aged", swapped).field);
    expect(world.field.map((entrant) => entrant.driverId)).toContain(RESERVE);
  });

  it("does not follow the reader to a new season from the menu", () => {
    // The grid belongs to the year it was drawn for; a fresh start is a fresh
    // grid, unlike the ability mode, which is a way of playing.
    useSeasonStore.getState().setGrid(swapped, null);
    useSeasonStore.getState().openMenu();
    useSeasonStore.getState().startSeason(1980);
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
    expect(() => createWorld(3, 1980, "peak", { ...authored, [SEATED_TEAM]: crowded })).toThrow(
      `${crowded.length} drivers`,
    );
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
    // The path the reader takes on Start again → Main menu → 1980. Without the
    // preference this came back peak every time.
    storedAs("aged");
    useSeasonStore.getState().openMenu();
    useSeasonStore.getState().startSeason(1980);
    expect(running().world.ratingMode).toBe("aged");
  });

  it("still opens on peak when nothing has been chosen", () => {
    useSeasonStore.getState().openMenu();
    useSeasonStore.getState().startSeason(1980);
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
    useSeasonStore.getState().simulate(3, 1980);
    useSeasonStore.getState().setRatingMode("aged");
    expect(written).toContain("aged");
  });

  it("keeps the seeded entry point free of it", () => {
    // `simulate` must depend only on its arguments, or every test that uses it
    // becomes order-dependent on whatever was last remembered.
    storedAs("aged");
    useSeasonStore.getState().simulate(3, 1980);
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
    useSeasonStore.getState().simulate(3, 1980);
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
    expect(running().world.season).toEqual(createWorld(3, 1980).season);
  });

  it("applies drivers and engines as one edit", () => {
    const swapped = swapDrivers(AUTHORED, SEATED, RESERVE);
    useSeasonStore.getState().setGrid(swapped, resupplied);
    const world = running().world;

    expect(world.lineup).toEqual(swapped);
    expect(world.engines).toEqual(resupplied);
    expect(world.season).toEqual(createWorld(3, 1980, "peak", swapped, resupplied).season);
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
    useSeasonStore.getState().nextSession();
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
