/**
 * The run bar as data: which actions each beat offers, and the trail to a page.
 * Every beat is covered, both terminals included, because an action missing
 * from the wrong beat strands the reader with no way on.
 */

import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import { crumbsFor, eraActionsFor, eraJumpTarget, runBarFor, runTitle } from "./run-bar.js";
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

function era(cursor: Beat, of = world): Run {
  return { kind: "era", run: { startYear: of.year, seasons: [] }, world: of, cursor };
}

describe("the run bar's actions", () => {
  it("offers Continue and the full-season skip on the grid, and no Start again", () => {
    expect(runBarFor(season({ kind: "grid" }))).toEqual({
      cursor: `${YEAR} · Grid`,
      next: `${YEAR} · Round 1/${ROUNDS} · Qualifying`,
      skip: "Simulate full season",
      jump: false,
      restart: false,
    });
  });

  it("offers Continue, the skip and Start again through the season", () => {
    for (const round of new Set([0, Math.floor((ROUNDS - 1) / 2), ROUNDS - 2])) {
      for (const kind of ["qualifying", "race"] as const) {
        const bar = runBarFor(season({ kind, round }));
        expect(bar.next, `${kind} ${round}`).not.toBeNull();
        expect(bar.skip, `${kind} ${round}`).toBe("Simulate rest of the season");
        expect(bar.restart, `${kind} ${round}`).toBe(true);
        expect(bar.jump).toBe(false);
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

  it("offers nothing forward from a one-year run's summary, but still Start again", () => {
    const bar = runBarFor(season({ kind: "summary" }));
    expect(bar.next).toBeNull();
    expect(bar.skip).toBeNull();
    expect(bar.restart).toBe(true);
  });

  it("takes an era's summary on to its review", () => {
    expect(runBarFor(era({ kind: "summary" })).next).toBe(`${YEAR} · Between seasons`);
  });

  it("leads an era's review on to the next year's grid, with a jump and no Start again", () => {
    const first = seededWorld(3, "aged", FIRST_PLAYABLE);
    const bar = runBarFor(era({ kind: "review" }, first));
    expect(bar.next).toBe(`${FIRST_PLAYABLE + 1} · Grid`);
    expect(bar.jump).toBe(true);
    expect(bar.restart).toBe(false);
    expect(bar.skip).toBeNull();
  });

  it("offers nothing forward from the review of the last authored year", () => {
    const last = seededWorld(3, "aged", LAST_PLAYABLE);
    const bar = runBarFor(era({ kind: "review" }, last));
    expect(bar.next).toBeNull();
    expect(bar.jump).toBe(false);
  });

  it("leaves every beat of a season the same inside an era, the summary aside", () => {
    // The point of running the era on the season's beats rather than beside
    // them: if any other beat differed, there would be two reveals to keep in step.
    const beats: Beat[] = [
      { kind: "grid" },
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "race", round: ROUNDS - 1 },
    ];
    for (const beat of beats) {
      expect(runBarFor(era(beat)), beat.kind).toEqual(runBarFor(season(beat)));
    }
  });

  it("names the run on the Resume card", () => {
    expect(runTitle(season({ kind: "grid" }))).toBe(`${YEAR} season`);
    expect(runTitle(era({ kind: "grid" }))).toBe(`Era from ${YEAR}`);
  });
});

describe("the jump forward", () => {
  it("offers the next year and the far end from the roll of honour", () => {
    const onward = eraActionsFor(FIRST_PLAYABLE);
    expect(onward.next).toBe(FIRST_PLAYABLE + 1);
    expect(onward.rest).toBe(LAST_PLAYABLE);
  });

  it("is not offered when the next year is the last one anyway", () => {
    // A jump that does what Continue does is a worse offer than none.
    expect(eraActionsFor(LAST_PLAYABLE - 1)).toEqual({ next: LAST_PLAYABLE, rest: null });
  });

  it("offers nothing once the era reaches the end of the data", () => {
    expect(eraActionsFor(LAST_PLAYABLE)).toEqual({ next: null, rest: null });
  });

  it("defaults to the far end", () => {
    expect(eraJumpTarget(FIRST_PLAYABLE, null)).toBe(LAST_PLAYABLE);
  });

  it("jumps to the year the reader picked, next year included", () => {
    expect(eraJumpTarget(FIRST_PLAYABLE, FIRST_PLAYABLE + 5)).toBe(FIRST_PLAYABLE + 5);
    expect(eraJumpTarget(FIRST_PLAYABLE, FIRST_PLAYABLE + 1)).toBe(FIRST_PLAYABLE + 1);
  });

  it("drops a year the era has since run past, back to the far end", () => {
    // The picker outlives the jump it describes, and honouring a year behind the
    // run would hand the store a target it can only refuse.
    expect(eraJumpTarget(FIRST_PLAYABLE + 4, FIRST_PLAYABLE + 2)).toBe(LAST_PLAYABLE);
    expect(eraJumpTarget(FIRST_PLAYABLE, LAST_PLAYABLE + 1)).toBe(LAST_PLAYABLE);
  });

  it("has no target once there is nowhere past the next year to jump to", () => {
    expect(eraJumpTarget(LAST_PLAYABLE - 1, LAST_PLAYABLE)).toBeNull();
    expect(eraJumpTarget(LAST_PLAYABLE, null)).toBeNull();
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

  it("link nowhere the reader has not reached", () => {
    const crumbs = crumbsFor(season(raceTwo), { year: YEAR, beat: { kind: "grid" } });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([String(YEAR), "Grid"]);
    expect(crumbs.every((crumb) => crumb.link === undefined)).toBe(true);
  });

  it("start at the era inside one, linking its roll of honour once a year is crowned", () => {
    const next = seededWorld(4, "aged", YEAR + 1);
    const run: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [world] },
      world: next,
      cursor: { kind: "grid" },
    };
    const crumbs = crumbsFor(run, { year: YEAR + 1, beat: { kind: "grid" } });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([`Era ${YEAR}`, String(YEAR + 1), "Grid"]);
    expect(crumbs[0]?.link).toEqual(REVIEW_LINK);
    expect(crumbs[1]?.link).toBeUndefined();
  });

  it("are the era alone on its roll of honour", () => {
    const crumbs = crumbsFor(era({ kind: "review" }), { year: YEAR, beat: { kind: "review" } });
    expect(crumbs).toEqual([{ label: `Era ${YEAR}` }]);
  });

  it("do not link the era before anything has been crowned", () => {
    const crumbs = crumbsFor(era({ kind: "grid" }), { year: YEAR, beat: { kind: "grid" } });
    expect(crumbs[0]).toEqual({ label: `Era ${YEAR}` });
  });
});
