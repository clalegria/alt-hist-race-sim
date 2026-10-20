/**
 * The page either side of a session, a season, a driver and a team. Every
 * expectation is built off the run, the calendar and the name functions, never
 * a name or a seed's outcome; links are compared to `linkTo`.
 */

import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import { compareBySurname, driverName } from "./names.js";
import { stepsFor } from "./page-steps.js";
import { revealed } from "./reveal.js";
import { rosterOf } from "./roster.js";
import { driverLink, teamLink } from "./roster-places.js";
import { laterYears, linkTo } from "./run-places.js";
import { seasonSeed } from "./seasons.js";
import { type Beat, isReached, type Place } from "./timeline.js";

const world = seededWorld(3, "aged", YEAR);
const ROUNDS = world.season.races.length;
const second = seededWorld(4, "aged", YEAR + 1);
const SECOND_ROUNDS = second.season.races.length;
const MID = Math.floor(ROUNDS / 2);
const END: Beat = { kind: "summary" };

const season = (cursor: Beat): Run => ({ kind: "season", world, cursor });
/** An era on its first year: later years are still ahead. */
const eraFirst = (cursor: Beat): Run => ({
  kind: "era",
  run: { startYear: YEAR, seasons: [] },
  world,
  cursor,
});
/** An era in its second year, the first behind it. */
const eraSecond = (cursor: Beat): Run => ({
  kind: "era",
  run: { startYear: YEAR, seasons: [world] },
  world: second,
  cursor,
});
const at = (year: number, beat: Beat): Place => ({ year, beat });
const gpName = (year: number, round: number) => seasonSeed(year).calendar[round]?.name ?? "";

/** The place a session link names, read back off its params. */
function placeOf(link: { readonly to: string }): Place {
  const params = "params" in link ? (link.params as Record<string, string>) : {};
  const kind = link.to.endsWith("qualifying") ? "qualifying" : "race";
  return { year: Number(params.year), beat: { kind, round: Number(params.round) - 1 } };
}

describe("session steps", () => {
  it("step to the round either side within a year, keeping the session", () => {
    for (const kind of ["qualifying", "race"] as const) {
      const steps = stepsFor(season(END), at(YEAR, { kind, round: MID }));
      expect(steps?.previous?.link).toEqual(linkTo(at(YEAR, { kind, round: MID - 1 })));
      expect(steps?.next?.link).toEqual(linkTo(at(YEAR, { kind, round: MID + 1 })));
      expect(steps?.previous?.label).toBe(gpName(YEAR, MID - 1));
      expect(steps?.next?.label).toBe(gpName(YEAR, MID + 1));
      expect(steps?.previous?.title).toBe(`Previous ${kind}: ${YEAR} ${gpName(YEAR, MID - 1)}`);
      expect(steps?.next?.title).toBe(`Next ${kind}: ${YEAR} ${gpName(YEAR, MID + 1)}`);
    }
  });

  it("has no previous on the run's first session and no next on a one-year run's last", () => {
    for (const kind of ["qualifying", "race"] as const) {
      expect(stepsFor(season(END), at(YEAR, { kind, round: 0 }))?.previous, kind).toBeNull();
      expect(stepsFor(season(END), at(YEAR, { kind, round: ROUNDS - 1 }))?.next, kind).toBeNull();
    }
  });

  it("steps from the round before the last to the last, and from round 1 back to round 0", () => {
    for (const kind of ["qualifying", "race"] as const) {
      const run = eraSecond(END);
      const nearEnd = stepsFor(run, at(YEAR, { kind, round: ROUNDS - 2 }));
      expect(nearEnd?.next?.link).toEqual(linkTo(at(YEAR, { kind, round: ROUNDS - 1 })));
      const nearStart = stepsFor(run, at(YEAR + 1, { kind, round: 1 }));
      expect(nearStart?.previous?.link).toEqual(linkTo(at(YEAR + 1, { kind, round: 0 })));
    }
  });

  it("falls back to qualifying, and says so in the noun, while the next race is ahead", () => {
    const cursor = season({ kind: "qualifying", round: MID + 1 });
    const next = stepsFor(cursor, at(YEAR, { kind: "race", round: MID }))?.next;
    expect(next?.link).toEqual(linkTo(at(YEAR, { kind: "qualifying", round: MID + 1 })));
    expect(next?.title).toBe(`Next qualifying: ${YEAR} ${gpName(YEAR, MID + 1)}`);
  });

  it("gives a round not reached no link and marks the title", () => {
    const steps = stepsFor(
      season({ kind: "race", round: MID }),
      at(YEAR, { kind: "race", round: MID }),
    );
    expect(steps?.next?.link).toBeNull();
    expect(steps?.next?.title).toBe(`Next race: ${YEAR} ${gpName(YEAR, MID + 1)} (not yet)`);
    expect(steps?.next?.label).toBe(gpName(YEAR, MID + 1));
    expect(steps?.previous?.link).not.toBeNull();
  });

  it("links only reached places, and a step has no link exactly when its title says not yet", () => {
    const years = [
      { year: YEAR, rounds: ROUNDS },
      { year: YEAR + 1, rounds: SECOND_ROUNDS },
    ];
    const cursors: Beat[] = [
      { kind: "grid" },
      { kind: "qualifying", round: MID },
      { kind: "race", round: MID },
      END,
    ];
    for (const cursorBeat of cursors) {
      const run = eraSecond(cursorBeat);
      const cursor = at(YEAR + 1, cursorBeat);
      for (const { year, rounds } of years) {
        for (let round = 0; round < rounds; round += 1) {
          for (const kind of ["qualifying", "race"] as const) {
            const page = at(year, { kind, round });
            if (!isReached(cursor, page)) {
              continue;
            }
            const steps = stepsFor(run, page);
            const label = `${JSON.stringify(cursorBeat)} ${year} ${kind} ${round}`;
            for (const step of [steps?.previous, steps?.next]) {
              if (step === null || step === undefined) {
                continue;
              }
              expect(step.link === null, label).toBe(step.title.endsWith(" (not yet)"));
              if (step.link !== null) {
                expect(isReached(cursor, placeOf(step.link)), label).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it("crosses back from an era's first round to the previous year's last", () => {
    for (const kind of ["qualifying", "race"] as const) {
      const steps = stepsFor(eraSecond(END), at(YEAR + 1, { kind, round: 0 }));
      expect(steps?.previous?.link).toEqual(linkTo(at(YEAR, { kind, round: ROUNDS - 1 })));
      expect(steps?.previous?.label).toBe(`${YEAR} ${gpName(YEAR, ROUNDS - 1)}`);
      expect(steps?.previous?.title).toBe(`Previous ${kind}: ${YEAR} ${gpName(YEAR, ROUNDS - 1)}`);
    }
  });

  it("crosses forward from a year's last round to the next year's first once it is reached", () => {
    const steps = stepsFor(eraSecond(END), at(YEAR, { kind: "race", round: ROUNDS - 1 }));
    expect(steps?.next?.link).toEqual(linkTo(at(YEAR + 1, { kind: "race", round: 0 })));
    expect(steps?.next?.label).toBe(`${YEAR + 1} ${gpName(YEAR + 1, 0)}`);
  });

  it("has the next year's first round with no link while the cursor is on its grid", () => {
    const steps = stepsFor(
      eraSecond({ kind: "grid" }),
      at(YEAR, { kind: "race", round: ROUNDS - 1 }),
    );
    expect(steps?.next?.link).toBeNull();
    expect(steps?.next?.title).toBe(`Next race: ${YEAR + 1} ${gpName(YEAR + 1, 0)} (not yet)`);
  });

  it("falls back to qualifying across a year edge while the race is ahead", () => {
    const run = eraSecond({ kind: "qualifying", round: 0 });
    const next = stepsFor(run, at(YEAR, { kind: "race", round: ROUNDS - 1 }))?.next;
    expect(next?.link).toEqual(linkTo(at(YEAR + 1, { kind: "qualifying", round: 0 })));
    expect(next?.title).toBe(`Next qualifying: ${YEAR + 1} ${gpName(YEAR + 1, 0)}`);
  });

  it("has a year the era can only reach later as a step with no link", () => {
    const run = eraFirst(END);
    expect(laterYears(run)).toContain(YEAR + 1);
    const steps = stepsFor(run, at(YEAR, { kind: "race", round: ROUNDS - 1 }));
    expect(steps?.next?.link).toBeNull();
    expect(steps?.next?.label).toBe(`${YEAR + 1} ${gpName(YEAR + 1, 0)}`);
    expect(steps?.next?.title).toBe(`Next race: ${YEAR + 1} ${gpName(YEAR + 1, 0)} (not yet)`);
  });
});

describe("season steps", () => {
  it("step to the years reached either side", () => {
    const run = eraSecond(END);
    const forward = stepsFor(run, at(YEAR + 1, END));
    expect(forward?.previous?.link).toEqual(linkTo(at(YEAR, END)));
    expect(forward?.previous?.title).toBe(`Previous season: ${YEAR}`);
    expect(forward?.previous?.label).toBe(`${YEAR} season`);
    const back = stepsFor(run, at(YEAR, END));
    expect(back?.previous).toBeNull();
    expect(back?.next?.link).toEqual(linkTo(at(YEAR + 1, END)));
    expect(back?.next?.title).toBe(`Next season: ${YEAR + 1}`);
  });

  it("has a later year the era can still reach as a step with no link", () => {
    const run = eraSecond(END);
    const later = laterYears(run)[0];
    expect(later).toBeDefined();
    const steps = stepsFor(run, at(YEAR + 1, END));
    expect(steps?.next?.link).toBeNull();
    expect(steps?.next?.title).toBe(`Next season: ${later} (not yet)`);
    expect(steps?.next?.label).toBe(`${later} season`);
  });

  it("has nothing either side on a one-year run", () => {
    expect(stepsFor(season(END), at(YEAR, END))).toEqual({ previous: null, next: null });
  });
});

describe("driver and team steps", () => {
  const run = eraSecond(END);
  const roster = rosterOf(revealed(run).years);

  it("walk the drivers by surname, then id, with no wrap-around", () => {
    const order = [...roster.drivers.keys()].sort(
      (a, b) => compareBySurname(driverName(a), driverName(b)) || (a < b ? -1 : a > b ? 1 : 0),
    );
    expect(order.length).toBeGreaterThan(2);
    order.forEach((id, index) => {
      const steps = stepsFor(run, { page: "driver", id });
      const before = order[index - 1];
      const after = order[index + 1];
      expect(steps?.previous?.link ?? null, id).toEqual(
        before === undefined ? null : driverLink(before),
      );
      expect(steps?.next?.link ?? null, id).toEqual(after === undefined ? null : driverLink(after));
      if (before !== undefined) {
        expect(steps?.previous?.title).toBe(`Previous driver: ${driverName(before)}`);
      }
      if (after !== undefined) {
        expect(steps?.next?.label).toBe(driverName(after));
      }
    });
    expect(stepsFor(run, { page: "driver", id: order[0] ?? "" })?.previous).toBeNull();
    expect(stepsFor(run, { page: "driver", id: order.at(-1) ?? "" })?.next).toBeNull();
  });

  it("walk the teams in one line, each next the inverse of the following previous", () => {
    const ids = [...roster.teams.keys()];
    const idOf = (link: unknown) =>
      ids.find((id) => JSON.stringify(teamLink(id)) === JSON.stringify(link));
    const starts = ids.filter((id) => stepsFor(run, { page: "team", id })?.previous === null);
    expect(starts).toHaveLength(1);
    const walked: string[] = [];
    let current: string | undefined = starts[0];
    while (current !== undefined && walked.length <= ids.length) {
      walked.push(current);
      const next: ReturnType<typeof stepsFor> = stepsFor(run, { page: "team", id: current });
      current = next?.next === null || next === null ? undefined : idOf(next.next?.link);
    }
    expect([...walked].sort()).toEqual([...ids].sort());
    expect(stepsFor(run, { page: "team", id: walked.at(-1) ?? "" })?.next).toBeNull();
    walked.forEach((id, index) => {
      const previous = stepsFor(run, { page: "team", id })?.previous;
      const expected = walked[index - 1];
      expect(previous?.link ?? null).toEqual(expected === undefined ? null : teamLink(expected));
    });
  });

  it("has no steps for a person who is not in the run", () => {
    expect(stepsFor(run, { page: "driver", id: "no-such-driver" })).toEqual({
      previous: null,
      next: null,
    });
  });
});

describe("pages with no steps", () => {
  it("are the grid, the review, the indexes and a roster page without an id", () => {
    const run = eraSecond(END);
    expect(stepsFor(run, at(YEAR + 1, { kind: "grid" }))).toBeNull();
    expect(stepsFor(run, at(YEAR + 1, { kind: "review" }))).toBeNull();
    expect(stepsFor(run, { page: "drivers" })).toBeNull();
    expect(stepsFor(run, { page: "teams" })).toBeNull();
    expect(stepsFor(run, { page: "driver" })).toBeNull();
    expect(stepsFor(run, { page: "team" })).toBeNull();
  });
});
