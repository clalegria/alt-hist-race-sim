/**
 * Where each beat lives in the address bar, and what a URL inside `/run` may
 * show. Runs are built straight from worlds, so any beat can be the cursor
 * without stepping the store there; counts come off the world.
 */

import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import {
  isBackPastStart,
  linkTo,
  parseRound,
  parseYear,
  placeFromParams,
  type RunPage,
  resolveRunPage,
  runPageOf,
} from "./run-places.js";
import type { Beat, Place } from "./timeline.js";

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
          : "summary";
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
  const redirectsToCursor = (page: RunPage, params: Record<string, string>) => {
    const resolved = resolveRunPage(run, page, params);
    expect(resolved.kind, `${page} ${JSON.stringify(params)}`).toBe("redirect");
    expect(resolved.kind === "redirect" && resolved.to).toEqual(
      linkTo({ year: YEAR, beat: cursor }),
    );
  };

  it("shows every beat the reader has reached, and none past it", () => {
    const beats = beatsOf(ROUNDS);
    const at = beats.findIndex((beat) => JSON.stringify(beat) === JSON.stringify(cursor));
    beats.forEach((beat, index) => {
      const { page, params } = paramsOf({ year: YEAR, beat });
      const resolved = resolveRunPage(run, page, params);
      expect(resolved.kind, JSON.stringify(beat)).toBe(index <= at ? "season" : "redirect");
      if (resolved.kind === "season") {
        expect(resolved.view).toEqual(beat);
        expect(resolved.world).toBe(first);
      }
    });
  });

  it("sends a year the run does not have, or a malformed one, to the cursor", () => {
    redirectsToCursor("grid", { year: String(YEAR - 1) });
    redirectsToCursor("grid", { year: String(YEAR + 1) });
    redirectsToCursor("grid", { year: "nineteen" });
  });

  it("sends a round the season does not have to the cursor, even once it is over", () => {
    const over = season({ kind: "summary" });
    for (const round of ["0", String(ROUNDS + 1), "x"]) {
      const resolved = resolveRunPage(over, "race", { year: String(YEAR), round });
      expect(resolved.kind, round).toBe("redirect");
    }
  });

  it("lets only the grid the cursor is on be edited", () => {
    const onGrid = resolveRunPage(season({ kind: "grid" }), "grid", { year: String(YEAR) });
    expect(onGrid.kind === "season" && onGrid.editable).toBe(true);
    const past = resolveRunPage(run, "grid", { year: String(YEAR) });
    expect(past.kind === "season" && past.editable).toBe(false);
  });

  it("sends a one-year run's /run on to its season, or to the cursor before it ends", () => {
    const over = resolveRunPage(season({ kind: "summary" }), "review", {});
    expect(over.kind === "redirect" && over.to).toEqual(
      linkTo({ year: YEAR, beat: { kind: "summary" } }),
    );
    redirectsToCursor("review", {});
  });
});

describe("what a page inside an era shows", () => {
  it("shows a crowned year's pages, whatever the cursor is doing now", () => {
    const run = era({ kind: "grid" });
    for (const beat of beatsOf(first.season.races.length)) {
      const { page, params } = paramsOf({ year: YEAR, beat });
      const resolved = resolveRunPage(run, page, params);
      expect(resolved.kind, JSON.stringify(beat)).toBe("season");
      expect(resolved.kind === "season" && resolved.world).toBe(first);
    }
  });

  it("never lets a crowned year's grid be edited", () => {
    const resolved = resolveRunPage(era({ kind: "grid" }), "grid", { year: String(YEAR) });
    expect(resolved.kind === "season" && resolved.editable).toBe(false);
  });

  it("shows the roll of honour once a year has been crowned", () => {
    const resolved = resolveRunPage(era({ kind: "grid" }), "review", {});
    expect(resolved.kind === "review" && resolved.run.seasons).toEqual([first]);
  });

  it("counts the year on the cursor as crowned once the cursor reaches its review", () => {
    const resolved = resolveRunPage(era({ kind: "review" }), "review", {});
    expect(resolved.kind === "review" && resolved.run.seasons).toEqual([first, second]);
  });

  it("sends /run to the cursor while nothing has been crowned", () => {
    const fresh: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [] },
      world: first,
      cursor: { kind: "grid" },
    };
    expect(resolveRunPage(fresh, "review", {}).kind).toBe("redirect");
  });
});

describe("the route a page matched", () => {
  it("names a page for every route inside /run, and none outside it", () => {
    expect(runPageOf("/run/")).toBe("review");
    expect(runPageOf("/run/$year/")).toBe("summary");
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
