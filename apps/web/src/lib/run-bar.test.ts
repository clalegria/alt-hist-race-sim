/**
 * The run bar as data: which actions each beat offers, and the trail to a page.
 * Every beat is covered, both terminals included, because an action missing
 * from the wrong beat strands the reader with no way on.
 */

import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import { crumbsFor, jumpPlace, jumpTarget, jumpYears, runBarFor, runTitle } from "./run-bar.js";
import { linkTo, REVIEW_LINK } from "./run-places.js";
import { PLAYABLE_SEASONS } from "./seasons.js";
import type { Beat } from "./timeline.js";

const world = seededWorld(3, "aged", YEAR);
const ROUNDS = world.season.races.length;
/** The ends of the authored range, off the data: an era runs between them. */
const FIRST_PLAYABLE = PLAYABLE_SEASONS[0] ?? 0;
const LAST_PLAYABLE = PLAYABLE_SEASONS.at(-1) ?? 0;

function season(cursor: Beat): Run {
  return { kind: "season", world, cursor };
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

function era(cursor: Beat, of = world): Run {
  return { kind: "era", run: { startYear: of.year, seasons: [] }, world: of, cursor };
}

describe("the run bar's actions", () => {
  it("offers Continue and the full-season skip on the grid, and no restart", () => {
    expect(runBarFor(season({ kind: "grid" }))).toEqual({
      cursor: `${YEAR} · Grid`,
      next: `${YEAR} · Round 1/${ROUNDS} · Qualifying`,
      skip: "Simulate full season",
      jump: false,
      restartSeason: false,
      restartEra: false,
    });
  });

  it("offers Continue, the skip and Restart season through the season", () => {
    for (const round of new Set([0, Math.floor((ROUNDS - 1) / 2), ROUNDS - 2])) {
      for (const kind of ["qualifying", "race"] as const) {
        const bar = runBarFor(season({ kind, round }));
        expect(bar.next, `${kind} ${round}`).not.toBeNull();
        expect(bar.skip, `${kind} ${round}`).toBe("Simulate rest of the season");
        expect(bar.restartSeason, `${kind} ${round}`).toBe(true);
      }
    }
    // Qualifying for the last round still has a race left to skip past.
    expect(runBarFor(season({ kind: "qualifying", round: ROUNDS - 1 })).skip).toBe(
      "Simulate rest of the season",
    );
  });

  it("drops the skip after the last race, where Continue is the summary", () => {
    const bar = runBarFor(season({ kind: "race", round: ROUNDS - 1 }));
    expect(bar.next).toBe(`${YEAR} · Season summary`);
    expect(bar.skip).toBeNull();
  });

  it("offers nothing forward from a one-year run's summary, but still Restart season", () => {
    const bar = runBarFor(season({ kind: "summary" }));
    expect(bar.next).toBeNull();
    expect(bar.skip).toBeNull();
    expect(bar.jump).toBe(false);
    expect(bar.restartSeason).toBe(true);
  });

  it("never offers a one-year run a jump or an era to restart", () => {
    for (const beat of beatsOf(ROUNDS)) {
      const bar = runBarFor(season(beat));
      expect(bar.jump, beat.kind).toBe(false);
      expect(bar.restartEra, beat.kind).toBe(false);
    }
  });

  it("offers an era a jump from every beat while a later year is ahead", () => {
    const first = seededWorld(3, "aged", FIRST_PLAYABLE);
    for (const beat of [...beatsOf(first.season.races.length), { kind: "review" } as const]) {
      expect(runBarFor(era(beat, first)).jump, beat.kind).toBe(true);
    }
  });

  it("offers no jump in the last authored year, where the skip is the only way on", () => {
    const last = seededWorld(3, "aged", LAST_PLAYABLE);
    expect(runBarFor(era({ kind: "grid" }, last)).jump).toBe(false);
    expect(runBarFor(era({ kind: "review" }, last)).jump).toBe(false);
  });

  it("takes an era's summary on to its review", () => {
    expect(runBarFor(era({ kind: "summary" })).next).toBe(`${YEAR} · Between seasons`);
  });

  it("leads an era's review on to the next year's grid, with no season to restart", () => {
    const first = seededWorld(3, "aged", FIRST_PLAYABLE);
    const bar = runBarFor(era({ kind: "review" }, first));
    expect(bar.next).toBe(`${FIRST_PLAYABLE + 1} · Grid`);
    expect(bar.restartSeason).toBe(false);
    expect(bar.restartEra).toBe(true);
    expect(bar.skip).toBeNull();
  });

  it("offers Restart era once anything has been revealed, and not on the first grid", () => {
    expect(runBarFor(era({ kind: "grid" })).restartEra).toBe(false);
    expect(runBarFor(era({ kind: "qualifying", round: 0 })).restartEra).toBe(true);
    const later: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [world] },
      world: seededWorld(4, "aged", YEAR + 1),
      cursor: { kind: "grid" },
    };
    expect(runBarFor(later).restartEra).toBe(true);
  });

  it("offers nothing forward from the review of the last authored year", () => {
    const last = seededWorld(3, "aged", LAST_PLAYABLE);
    const bar = runBarFor(era({ kind: "review" }, last));
    expect(bar.next).toBeNull();
    expect(bar.jump).toBe(false);
  });

  it("walks an era's season exactly as a one-year run's, the summary aside", () => {
    // The point of running the era on the season's beats rather than beside
    // them: if Continue, the skip or the season's restart differed, there would
    // be two reveals to keep in step. What an era adds is its own: the jump
    // across years, and restarting the whole of it.
    const beats: Beat[] = [
      { kind: "grid" },
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "race", round: ROUNDS - 1 },
    ];
    for (const beat of beats) {
      const { jump: _jump, restartEra: _restartEra, ...inEra } = runBarFor(era(beat));
      const { jump: _j, restartEra: _r, ...alone } = runBarFor(season(beat));
      expect(inEra, beat.kind).toEqual(alone);
    }
  });

  it("names the run on the Resume card", () => {
    expect(runTitle(season({ kind: "grid" }))).toBe(`${YEAR} season`);
    expect(runTitle(era({ kind: "grid" }))).toBe(`Era from ${YEAR}`);
  });
});

describe("where a jump lands", () => {
  const first = seededWorld(3, "aged", FIRST_PLAYABLE);

  it("offers this year while its end is ahead, then every later year the era reaches", () => {
    expect(jumpYears(era({ kind: "race", round: 0 }, first))).toEqual(PLAYABLE_SEASONS);
    expect(jumpYears(era({ kind: "summary" }, first))).toEqual(PLAYABLE_SEASONS.slice(1));
    expect(jumpYears(era({ kind: "review" }, first))).toEqual(PLAYABLE_SEASONS.slice(1));
  });

  it("offers a one-year run its own year alone, until its end", () => {
    expect(jumpYears(season({ kind: "grid" }))).toEqual([YEAR]);
    expect(jumpYears(season({ kind: "summary" }))).toEqual([]);
  });

  it("lands on the year and the point the reader picked", () => {
    const run = era({ kind: "grid" }, first);
    expect(jumpTarget(run, { year: FIRST_PLAYABLE + 5, point: "start" })).toEqual(
      jumpPlace(FIRST_PLAYABLE + 5, "start"),
    );
    expect(jumpTarget(run, { year: FIRST_PLAYABLE + 5, point: "end" })).toEqual({
      year: FIRST_PLAYABLE + 5,
      beat: { kind: "summary" },
    });
  });

  it("defaults to the end of the next year", () => {
    expect(jumpTarget(era({ kind: "grid" }, first), { year: null, point: "end" })).toEqual(
      jumpPlace(FIRST_PLAYABLE + 1, "end"),
    );
  });

  it("falls back to a year still ahead when the one picked has been passed", () => {
    // The dialog outlives the jump it describes, and honouring a year behind the
    // run would hand the store a target it can only refuse.
    const run = era({ kind: "review" }, seededWorld(3, "aged", FIRST_PLAYABLE + 4));
    expect(jumpTarget(run, { year: FIRST_PLAYABLE + 2, point: "end" })).toEqual(
      jumpPlace(FIRST_PLAYABLE + 5, "end"),
    );
    expect(jumpTarget(run, { year: LAST_PLAYABLE + 1, point: "end" })).toEqual(
      jumpPlace(FIRST_PLAYABLE + 5, "end"),
    );
  });

  it("stops this year at its end, its start being behind the run", () => {
    const run = era({ kind: "race", round: 0 }, first);
    expect(jumpTarget(run, { year: FIRST_PLAYABLE, point: "start" })).toEqual(
      jumpPlace(FIRST_PLAYABLE, "end"),
    );
  });

  it("has nowhere to land once the run has nothing ahead", () => {
    const last = seededWorld(3, "aged", LAST_PLAYABLE);
    expect(jumpTarget(era({ kind: "review" }, last), { year: null, point: "end" })).toBeNull();
  });
});

describe("the breadcrumbs", () => {
  const raceTwo: Beat = { kind: "race", round: 1 };

  it("start at the year in a one-year run, and end on the page itself", () => {
    const crumbs = crumbsFor(season({ kind: "summary" }), { year: YEAR, beat: raceTwo });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([String(YEAR), "Round 2", "Race"]);
    // The season is finished, so its page is reached and linked; the page
    // itself, and a round with no page of its own, are not links.
    expect(crumbs[0]?.link).toEqual(linkTo({ year: YEAR, beat: { kind: "summary" } }));
    expect(crumbs.slice(1).every((crumb) => crumb.link === undefined)).toBe(true);
  });

  it("link the year's page from any page of a year begun, finished or not", () => {
    const crumbs = crumbsFor(season(raceTwo), { year: YEAR, beat: { kind: "grid" } });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([String(YEAR), "Grid"]);
    expect(crumbs[0]?.link).toEqual(linkTo({ year: YEAR, beat: { kind: "summary" } }));
    expect(crumbs[1]?.link).toBeUndefined();
  });

  it("link nowhere the reader has not reached", () => {
    // A later year's page, asked for ahead of the cursor: "Not reached yet".
    const crumbs = crumbsFor(era({ kind: "grid" }), { year: YEAR + 1, beat: raceTwo });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      "Era",
      String(YEAR + 1),
      "Round 2",
      "Race",
    ]);
    expect(crumbs.slice(1).every((crumb) => crumb.link === undefined)).toBe(true);
  });

  it("start at the era inside one, linking its overview and the year", () => {
    const next = seededWorld(4, "aged", YEAR + 1);
    const run: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [world] },
      world: next,
      cursor: { kind: "grid" },
    };
    const crumbs = crumbsFor(run, { year: YEAR + 1, beat: { kind: "grid" } });
    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Era", String(YEAR + 1), "Grid"]);
    expect(crumbs[0]?.link).toEqual(REVIEW_LINK);
    expect(crumbs[1]?.link).toEqual(linkTo({ year: YEAR + 1, beat: { kind: "summary" } }));
  });

  it("are the era alone on its roll of honour", () => {
    const crumbs = crumbsFor(era({ kind: "review" }), { year: YEAR, beat: { kind: "review" } });
    expect(crumbs).toEqual([{ label: "Era" }]);
  });

  it("link the era's overview before anything has been crowned", () => {
    const crumbs = crumbsFor(era({ kind: "grid" }), { year: YEAR, beat: { kind: "grid" } });
    expect(crumbs[0]).toEqual({ label: "Era", link: REVIEW_LINK });
  });
});
