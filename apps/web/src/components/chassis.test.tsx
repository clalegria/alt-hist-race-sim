/**
 * Re-rating a chassis, as the reader meets it.
 *
 * Rendered statically like the rest of the editor's tests, so what these reach
 * is the markup each state produces; the stepping rule itself is unit-tested in
 * `@alt-hist/data`. Every chassis below is either synthetic or a step away from
 * the authored one — never a rating read off the data.
 */

import {
  authoredChassis,
  type ChassisChange,
  type ChassisSpec,
  chassisChanges,
  stepChassis,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { GridStage } from "./GridStage.js";
import { changeCount, chassisNote, chassisSummary, signed } from "./LineupChanges.js";
import { ChassisStepper, type GridEditing, SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld();
const TEAMS = new Set(world.field.map((entrant) => entrant.teamId)).size;
const TEAM = SEED.entries[0]?.teamId ?? "";
const MINUS = "−";

const editing: GridEditing = {
  selected: null,
  onSelect: () => {},
  engineIds: SEED.engines.map((engine) => engine.engineId),
  onEngineChange: () => {},
  onChassisStep: () => {},
  onEngineStep: () => {},
  onTrendStep: () => {},
};

const MIDDLE: ChassisSpec = { racing: 60, qualifying: 60, consistency: 60, reliability: 60 };

/** A change of the given size on every rating, or of the given sizes one by one. */
function change(by: number | Partial<ChassisSpec>): ChassisChange {
  const delta = (key: keyof ChassisSpec): number => (typeof by === "number" ? by : (by[key] ?? 0));
  return {
    teamId: TEAM,
    from: MIDDLE,
    to: {
      racing: MIDDLE.racing + delta("racing"),
      qualifying: MIDDLE.qualifying + delta("qualifying"),
      consistency: MIDDLE.consistency + delta("consistency"),
      reliability: MIDDLE.reliability + delta("reliability"),
    },
  };
}

/** How many times a string occurs in the markup. */
function count(html: string, what: string): number {
  return html.split(what).length - 1;
}

describe("the stepper on each card", () => {
  it("is drawn on every team in the editor, a minus and a plus each", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    expect(html.match(/aria-label="Strengthen [^"]* chassis"/g)).toHaveLength(TEAMS);
    expect(html.match(/aria-label="Weaken [^"]* chassis"/g)).toHaveLength(TEAMS);
  });

  it("sits on a row of its own, labelled, once per team", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    expect(count(html, ">Chassis</span>")).toBe(TEAMS);
    expect(count(html, ">Engine</span>")).toBe(TEAMS);
  });

  it("is not drawn on the grid, nor on the editor before it is opened", () => {
    for (const html of [
      renderToStaticMarkup(<SeasonGrid field={world.field} seasonYear={YEAR} ratingMode="peak" />),
      renderToStaticMarkup(
        <GridStage
          field={world.field}
          year={YEAR}
          ratingMode="peak"
          lineup={null}
          engines={null}
        />,
      ),
    ]) {
      expect(html).not.toContain("Strengthen ");
      expect(html).not.toContain("Weaken ");
      expect(html).not.toContain(">Chassis</span>");
    }
  });

  it("draws a number between its buttons only when handed one, as the popover does", () => {
    const still = renderToStaticMarkup(
      <ChassisStepper teamName="Team" chassis={MIDDLE} onStep={() => {}} />,
    );
    const moved = renderToStaticMarkup(
      <ChassisStepper teamName="Team" chassis={MIDDLE} delta={-2} onStep={() => {}} />,
    );
    expect(still).not.toMatch(/[+−]\d/);
    expect(moved).toContain(`${MINUS}2`);
  });

  it("disables the button that could move nothing further", () => {
    const top: ChassisSpec = { racing: 100, qualifying: 100, consistency: 100, reliability: 100 };
    const html = renderToStaticMarkup(
      <ChassisStepper teamName="Team" chassis={top} onStep={() => {}} />,
    );
    const strengthen = html.slice(html.indexOf('aria-label="Strengthen'));
    const weaken = html.slice(html.indexOf('aria-label="Weaken'), html.indexOf("</button>"));
    expect(strengthen.slice(0, strengthen.indexOf(">"))).toContain('disabled=""');
    expect(weaken).not.toContain('disabled=""');
  });

  it("names the one rating it moves when it moves one", () => {
    const html = renderToStaticMarkup(
      <ChassisStepper
        teamName="Team"
        chassis={MIDDLE}
        delta={0}
        rating={{ key: "reliability", label: "Reliability" }}
        onStep={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Strengthen Team chassis reliability"');
  });
});

describe("what moved, as the card's Chassis row says it", () => {
  it("is one move, for each rating, when all four moved together", () => {
    expect(chassisSummary(change(2))).toBe("+2 each");
    expect(chassisSummary(change(-3))).toBe(`${MINUS}3 each`);
  });

  it("names each rating that moved when they moved apart", () => {
    expect(chassisSummary(change({ racing: 3, reliability: -1 }))).toBe(
      `racing +3, reliability ${MINUS}1`,
    );
    expect(chassisSummary(change({ reliability: 4 }))).toBe("reliability +4");
  });

  it("is written with a real minus sign, and not at all when nothing moved", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(-1)).toBe(`${MINUS}1`);
    expect(signed(0)).toBe("");
  });
});

describe("a re-rated chassis in the list of changes", () => {
  it("collapses to one number when all four ratings moved together", () => {
    expect(chassisNote(change(2))).toBe("Chassis +2");
    expect(chassisNote(change(-1))).toBe(`Chassis ${MINUS}1`);
  });

  it("names each rating that moved when they moved apart", () => {
    expect(chassisNote(change({ racing: 3, reliability: -1 }))).toBe(
      `Chassis: racing +3, reliability ${MINUS}1`,
    );
  });

  it("counts as one change, however many ratings moved", () => {
    expect(changeCount([], [], [change(2), change({ racing: 1, qualifying: -1 })])).toBe(
      "2 changes",
    );
  });
});

describe("a grid with a re-rated chassis", () => {
  const rerated = stepChassis(authoredChassis(SEED), TEAM, -1);
  const changes = chassisChanges(SEED, rerated);
  const changed = createWorld(world.seed, YEAR, "peak", null, null, undefined, rerated);

  it("lists it, and marks the team's header as the engine change does", () => {
    const plain = renderToStaticMarkup(
      <SeasonGrid field={changed.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    const html = renderToStaticMarkup(
      <SeasonGrid
        field={changed.field}
        seasonYear={YEAR}
        ratingMode="peak"
        edit={editing}
        chassisChanges={changes}
      />,
    );
    expect(html).toContain("Changes so far");
    expect(changes).toHaveLength(1);
    expect(html).toContain(chassisNote(changes[0] as ChassisChange));
    expect(html).toContain(chassisSummary(changes[0] as ChassisChange));
    expect(plain).not.toContain(chassisSummary(changes[0] as ChassisChange));
    expect(count(html, SWAPPED_IN)).toBe(count(plain, SWAPPED_IN) + 1);
  });

  it("says so at the top of the season page, and again on its grid tab", () => {
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(changed, { kind: "summary" })} tab="grid" />,
    );
    expect(html).toContain("Edited grid");
    expect(count(html, chassisNote(changes[0] as ChassisChange))).toBe(2);
    expect(html).toContain("You made 1 change to this");
  });
});
