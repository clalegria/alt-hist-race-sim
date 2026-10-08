/**
 * Where each beat lives in the address bar, and what a URL inside `/run` may
 * show. Runs are built straight from worlds, so any beat can be the cursor
 * without stepping the store there; counts come off the world.
 */

import { seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { cursorPlace, type Run, stepRun } from "../store/season.js";
import {
  type BuiltRun,
  built,
  PENDING_YEAR,
  pendingRun,
  seededWorld,
  YEAR,
} from "../test-support.js";
import { revealYear } from "./reveal.js";
import {
  isBackPastStart,
  laterYears,
  linkTo,
  parseRound,
  parseYear,
  placeFromParams,
  type RunPage,
  resolveRunPage,
  runPageOf,
} from "./run-places.js";
import { type Beat, isReached, type Place } from "./timeline.js";

const first = seededWorld(3, "aged", YEAR);
const second = seededWorld(4, "aged", YEAR + 1);
const ROUNDS = first.season.races.length;

function season(cursor: Beat): Run {
  return { kind: "season", world: first, cursor };
}

/** An era in its second year, the first crowned behind it. */
function era(cursor: Beat): Run {
  return { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: second, cursor };
}

/** The page and params a link names, as the router would hand them back. */
function paramsOf(place: Place): {
  page: Exclude<RunPage, "review">;
  params: Record<string, string>;
} {
  const link = linkTo(place);
  const params = "params" in link ? (link.params as Record<string, string>) : {};
  const page =
    link.to === "/run/$year/grid"
      ? "grid"
      : link.to === "/run/$year/round/$round/qualifying"
        ? "qualifying"
        : link.to === "/run/$year/round/$round/race"
          ? "race"
          : "season";
  return { page, params };
}

/** Every beat of a season with `rounds` rounds, grid to summary. */
function beatsOf(rounds: number): Beat[] {
  const beats: Beat[] = [{ kind: "grid" }];
  for (let round = 0; round < rounds; round += 1) {
    beats.push({ kind: "qualifying", round }, { kind: "race", round });
  }
  beats.push({ kind: "summary" });
  return beats;
}

describe("a place's URL", () => {
  it("reads back as the same place, for every beat of a season", () => {
    for (const beat of beatsOf(ROUNDS)) {
      const place: Place = { year: YEAR, beat };
      const { page, params } = paramsOf(place);
      expect(placeFromParams(page, params), JSON.stringify(beat)).toEqual(place);
    }
  });

  it("counts rounds from 1, as a reader says them", () => {
    const link = linkTo({ year: YEAR, beat: { kind: "race", round: 0 } });
    expect("params" in link && link.params).toEqual({ year: String(YEAR), round: "1" });
  });

  it("gives the era's review one page whatever year it follows", () => {
    expect(linkTo({ year: YEAR, beat: { kind: "review" } }).to).toBe("/run");
  });
});

describe("the URL's parameters", () => {
  it("take a four-digit year and nothing else", () => {
    expect(parseYear(String(YEAR))).toBe(YEAR);
    for (const bad of [undefined, "", "84", "19844", "1984x", " 1984", "-1984", "1e3"]) {
      expect(parseYear(bad), String(bad)).toBeNull();
    }
  });

  it("take a round counted from 1, without a leading zero", () => {
    expect(parseRound("1")).toBe(0);
    expect(parseRound("16")).toBe(15);
    for (const bad of [undefined, "", "0", "01", "-1", "1.5", "x", "1000"]) {
      expect(parseRound(bad), String(bad)).toBeNull();
    }
  });
});

describe("what a page inside /run shows", () => {
  const cursor: Beat = { kind: "race", round: Math.min(2, ROUNDS - 1) };
  const run = season(cursor);
  const redirectsToCursor = (page: RunPage, params: Record<string, string>, of: Run = run) => {
    const resolved = resolveRunPage(of, page, params);
    expect(resolved.kind, `${page} ${JSON.stringify(params)}`).toBe("redirect");
    expect(resolved.kind === "redirect" && resolved.to).toEqual(linkTo(cursorPlace(of)));
  };

  it("shows every beat the reader has reached, and says the rest is not reached yet", () => {
    const beats = beatsOf(ROUNDS);
    const at = beats.findIndex((beat) => JSON.stringify(beat) === JSON.stringify(cursor));
    beats.forEach((beat, index) => {
      const { page, params } = paramsOf({ year: YEAR, beat });
      const resolved = resolveRunPage(run, page, params);
      // The summary's page is the season's own, there from the grid on.
      const shown = index <= at || beat.kind === "summary";
      expect(resolved.kind, JSON.stringify(beat)).toBe(shown ? "season" : "unreached");
      if (resolved.kind === "season") {
        expect(resolved.view).toEqual(beat);
        expect(resolved.world.year).toBe(YEAR);
      }
      if (resolved.kind === "unreached") {
        expect(resolved.place).toEqual({ year: YEAR, beat });
      }
    });
  });

  it("hands a page the season cut at the cursor, not the whole of it", () => {
    const resolved = resolveRunPage(run, "grid", { year: String(YEAR) });
    expect(resolved.kind === "season" && resolved.world.season).toEqual(
      revealYear(first, cursor).season,
    );
  });

  it("sends a year the run will never reach, or a malformed one, to the cursor", () => {
    redirectsToCursor("grid", { year: String(YEAR - 1) });
    // Another year of a one-year run is never reached.
    redirectsToCursor("grid", { year: String(YEAR + 1) });
    redirectsToCursor("grid", { year: "nineteen" });
  });

  it("sends a round the season does not have to the cursor, before and after it is over", () => {
    for (const of of [run, season({ kind: "summary" })]) {
      for (const round of ["0", String(ROUNDS + 1), "x"]) {
        redirectsToCursor("race", { year: String(YEAR), round }, of);
      }
    }
  });

  it("lets only the grid the cursor is on be edited", () => {
    const onGrid = resolveRunPage(season({ kind: "grid" }), "grid", { year: String(YEAR) });
    expect(onGrid.kind === "season" && onGrid.editable).toBe(true);
    const past = resolveRunPage(run, "grid", { year: String(YEAR) });
    expect(past.kind === "season" && past.editable).toBe(false);
  });

  it("shows the season's page from its grid on, finished only once the summary is reached", () => {
    for (const beat of beatsOf(ROUNDS)) {
      const resolved = resolveRunPage(season(beat), "season", { year: String(YEAR) });
      expect(resolved.kind, JSON.stringify(beat)).toBe("season");
      expect(resolved.kind === "season" && resolved.finished, JSON.stringify(beat)).toBe(
        beat.kind === "summary",
      );
      // Cut at the cursor, like every other page.
      expect(resolved.kind === "season" && resolved.world.season).toEqual(
        revealYear(first, beat).season,
      );
    }
  });

  it("sends a one-year run's /run on to its season, wherever the cursor is", () => {
    for (const beat of [{ kind: "grid" }, cursor, { kind: "summary" }] as const) {
      const resolved = resolveRunPage(season(beat), "review", {});
      expect(resolved.kind === "redirect" && resolved.to, JSON.stringify(beat)).toEqual(
        linkTo({ year: YEAR, beat: { kind: "summary" } }),
      );
    }
  });
});

describe("what a page inside an era shows", () => {
  it("shows a crowned year's pages whole, whatever the cursor is doing now", () => {
    const run = era({ kind: "grid" });
    for (const beat of beatsOf(first.season.races.length)) {
      const { page, params } = paramsOf({ year: YEAR, beat });
      const resolved = resolveRunPage(run, page, params);
      expect(resolved.kind, JSON.stringify(beat)).toBe("season");
      expect(resolved.kind === "season" && resolved.world.season.races).toEqual(first.season.races);
    }
  });

  it("never lets a crowned year's grid be edited", () => {
    const resolved = resolveRunPage(era({ kind: "grid" }), "grid", { year: String(YEAR) });
    expect(resolved.kind === "season" && resolved.editable).toBe(false);
  });

  it("shows the overview with the crowned years and the year in progress, cut at the cursor", () => {
    for (const cursor of [{ kind: "grid" }, { kind: "race", round: 0 }] as const) {
      const resolved = resolveRunPage(era(cursor), "review", {});
      expect(resolved.kind === "review" && resolved.run.seasons).toEqual([first]);
      expect(resolved.kind === "review" && resolved.inProgress).toEqual(revealYear(second, cursor));
    }
  });

  it("counts the year on the cursor as crowned once the cursor reaches its review", () => {
    const resolved = resolveRunPage(era({ kind: "review" }), "review", {});
    expect(resolved.kind === "review" && resolved.run.seasons).toEqual([first, second]);
    expect(resolved.kind === "review" && resolved.inProgress).toBeNull();
  });

  it("shows the overview from the era's first grid, before anything is crowned", () => {
    const fresh: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [] },
      world: first,
      cursor: { kind: "grid" },
    };
    const resolved = resolveRunPage(fresh, "review", {});
    expect(resolved.kind).toBe("review");
    expect(resolved.kind === "review" && resolved.run.seasons).toEqual([]);
    expect(resolved.kind === "review" && resolved.inProgress?.year).toBe(YEAR);
  });

  it("says a year the era will go on to is not reached yet, for any round it has", () => {
    const run = era({ kind: "grid" });
    const later = laterYears(run)[0];
    expect(later).toBeDefined();
    if (later === undefined) {
      return;
    }
    const rounds = seasonSeed(later).calendar.length;
    for (const beat of [
      { kind: "grid" },
      { kind: "qualifying", round: rounds - 1 },
      { kind: "race", round: 0 },
      { kind: "summary" },
    ] as const) {
      const { page, params } = paramsOf({ year: later, beat });
      expect(resolveRunPage(run, page, params).kind, JSON.stringify(beat)).toBe("unreached");
    }
    const tooFar = resolveRunPage(run, "race", { year: String(later), round: String(rounds + 1) });
    expect(tooFar.kind).toBe("redirect");
  });

  it("sends a year before the era started to the cursor", () => {
    const resolved = resolveRunPage(era({ kind: "grid" }), "grid", { year: String(YEAR - 1) });
    expect(resolved.kind).toBe("redirect");
  });
});

describe("the gate, at the only door pages have", () => {
  /** A two-year era stepped through every beat, so each is the cursor once. */
  function everyCursor(): BuiltRun[] {
    const runs: BuiltRun[] = [];
    let run: BuiltRun | null = {
      kind: "era",
      run: { startYear: YEAR, seasons: [] },
      world: first,
      cursor: { kind: "grid" },
    };
    while (run !== null && run.world.year <= YEAR + 1) {
      runs.push(run);
      const next = stepRun(run);
      run = next === null ? null : built(next);
    }
    return runs;
  }

  it("hands no page a result past the cursor, whatever URL it is asked for", () => {
    for (const run of everyCursor()) {
      const cursor = cursorPlace(run);
      for (const year of [YEAR, YEAR + 1]) {
        for (const beat of beatsOf(run.world.season.races.length)) {
          const { page, params } = paramsOf({ year, beat });
          const resolved = resolveRunPage(run, page, params);
          if (resolved.kind !== "season") {
            continue;
          }
          const label = `${JSON.stringify(cursor)} → ${year} ${JSON.stringify(beat)}`;
          // Every race handed over is one whose race beat the reader has reached.
          resolved.world.season.races.forEach((_, round) => {
            expect(isReached(cursor, { year, beat: { kind: "race", round } }), label).toBe(true);
          });
          const sheet = resolved.world.season.qualifying;
          if (sheet !== null) {
            expect(cursor, label).toEqual({
              year,
              beat: { kind: "qualifying", round: sheet.round },
            });
          }
        }
      }
    }
  });
});

describe("the route a page matched", () => {
  it("names a page for every route inside /run, and none outside it", () => {
    expect(runPageOf("/run/")).toBe("review");
    expect(runPageOf("/run/$year/")).toBe("season");
    expect(runPageOf("/run/$year/grid")).toBe("grid");
    expect(runPageOf("/run/$year/round/$round/qualifying")).toBe("qualifying");
    expect(runPageOf("/run/$year/round/$round/race")).toBe("race");
    expect(runPageOf("/season/new")).toBeNull();
    expect(runPageOf("/run")).toBeNull();
  });
});

describe("going back past the run's first page", () => {
  it("is a Back from inside the run onto a setup page", () => {
    expect(isBackPastStart("BACK", `/run/${YEAR}/grid`, "/season/new")).toBe(true);
    expect(isBackPastStart("BACK", `/run/${YEAR}/grid`, "/era/new")).toBe(true);
    expect(isBackPastStart("BACK", "/run", "/era/new")).toBe(true);
  });

  it("is not a Back that lands anywhere else, which leaves the run waiting", () => {
    expect(isBackPastStart("BACK", `/run/${YEAR}/round/2/race`, `/run/${YEAR}/grid`)).toBe(false);
    expect(isBackPastStart("BACK", `/run/${YEAR}/grid`, "/")).toBe(false);
  });

  it("is not a Back from outside the run, or a step forward onto a setup page", () => {
    expect(isBackPastStart("BACK", "/", "/season/new")).toBe(false);
    expect(isBackPastStart("BACK", "/runner", "/season/new")).toBe(false);
    expect(isBackPastStart("PUSH", `/run/${YEAR}/grid`, "/season/new")).toBe(false);
    expect(isBackPastStart("FORWARD", `/run/${YEAR}/grid`, "/season/new")).toBe(false);
  });
});

describe("a year waiting on the reader", () => {
  const run = pendingRun();
  const year = String(PENDING_YEAR.year);

  it("shows its grid, for the reader to fill", () => {
    expect(resolveRunPage(run, "grid", { year })).toEqual({
      kind: "pending",
      place: { year: PENDING_YEAR.year, beat: { kind: "grid" } },
      run,
    });
  });

  it("sends its season page to the grid, and has its sessions still ahead", () => {
    expect(resolveRunPage(run, "season", { year })).toEqual({
      kind: "redirect",
      to: linkTo(cursorPlace(run)),
    });
    expect(resolveRunPage(run, "race", { year, round: "1" }).kind).toBe("unreached");
  });

  it("shows the years before it whole, and the era's overview with every one crowned", () => {
    const before = resolveRunPage(run, "season", { year: String(PENDING_YEAR.start) });
    expect(before.kind).toBe("season");
    const review = resolveRunPage(run, "review", {});
    expect(review).toMatchObject({ kind: "review", run: run.run, inProgress: null });
  });
});
