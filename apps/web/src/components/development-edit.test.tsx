/**
 * Changing a car's in-season development, as the reader meets it.
 *
 * Rendered statically like the rest of the editor's tests. The popover itself
 * does not render while closed, so its section is reached through
 * `DevelopmentPanel`, the one thing the popover draws for it. The stepping rule
 * is unit-tested in `@alt-hist/data`; every trend here is synthetic or a step
 * away from the season's own.
 */

import { authoredTrends, stepTrend, trendChanges } from "@alt-hist/data";
import { DEVELOPMENT_TREND_LIMIT } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { teamName } from "../lib/names.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { changeCount, trendNote } from "./LineupChanges.js";
import { DevelopmentPanel, type GridEditing, SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld();
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

/** How many times a string occurs in the markup. */
function count(html: string, what: string): number {
  return html.split(what).length - 1;
}

/** The opening tag of the button with this accessible name. */
function button(html: string, label: string): string {
  const at = html.slice(html.indexOf(`aria-label="${label}"`));
  return at.slice(0, at.indexOf(">"));
}

describe("the development section of the team popover", () => {
  it("leaves a flat year out, outside the editor", () => {
    expect(renderToStaticMarkup(<DevelopmentPanel teamName="Blue" trend={0} />)).toBe("");
    expect(renderToStaticMarkup(<DevelopmentPanel teamName="Blue" trend={4} />)).toContain(
      "In-season development",
    );
  });

  it("draws a flat year in the editor, with a stepper either way", () => {
    const html = renderToStaticMarkup(
      <DevelopmentPanel teamName="Blue" trend={0} onStep={() => {}} />,
    );
    expect(html).toContain("In-season development");
    expect(html).toContain("Same pace all year.");
    expect(button(html, "Raise Blue development")).not.toContain('disabled=""');
    expect(button(html, "Lower Blue development")).not.toContain('disabled=""');
  });

  it("has no stepper outside the editor", () => {
    const html = renderToStaticMarkup(<DevelopmentPanel teamName="Blue" trend={4} />);
    expect(html).not.toContain("Raise ");
  });

  it("disables the button that could move it no further", () => {
    const top = renderToStaticMarkup(
      <DevelopmentPanel teamName="Blue" trend={DEVELOPMENT_TREND_LIMIT} onStep={() => {}} />,
    );
    const bottom = renderToStaticMarkup(
      <DevelopmentPanel teamName="Blue" trend={-DEVELOPMENT_TREND_LIMIT} onStep={() => {}} />,
    );
    expect(button(top, "Raise Blue development")).toContain('disabled=""');
    expect(button(top, "Lower Blue development")).not.toContain('disabled=""');
    expect(button(bottom, "Lower Blue development")).toContain('disabled=""');
  });

  it("tags how far the reader has moved it", () => {
    const html = renderToStaticMarkup(
      <DevelopmentPanel teamName="Blue" trend={1} delta={-2} onStep={() => {}} />,
    );
    expect(html).toContain(`${MINUS}2`);
  });

  it("writes a falling trend with a real minus, and a flat one as 0", () => {
    const falling = renderToStaticMarkup(<DevelopmentPanel teamName="Blue" trend={-3} />);
    expect(falling).toContain(`>${MINUS}3<`);
    expect(falling).not.toContain(">-3<");
    const flat = renderToStaticMarkup(
      <DevelopmentPanel teamName="Blue" trend={0} onStep={() => {}} />,
    );
    expect(flat).toContain(">0<");
  });
});

describe("what moved on a car's year", () => {
  it("is said as a signed move, and counts as one change", () => {
    const change = { teamId: "blue", from: 2, to: -1 };
    expect(trendNote(change)).toBe(`Development ${MINUS}3`);
    expect(changeCount([], [], [], [], [change])).toBe("1 change");
  });
});

describe("a grid with a changed trend", () => {
  const TEAM = SEED.entries[0]?.teamId ?? "";
  const authored = authoredTrends(SEED);
  const up = stepTrend(authored, TEAM, 1);
  const edited = up === authored ? stepTrend(authored, TEAM, -1) : up;
  const changes = trendChanges(SEED, edited);
  const changed = createWorld(
    world.seed,
    YEAR,
    "peak",
    null,
    null,
    undefined,
    null,
    undefined,
    {},
    null,
    edited,
  );

  it("lists it on the team's row and marks that team", () => {
    const plain = renderToStaticMarkup(
      <SeasonGrid field={changed.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    const html = renderToStaticMarkup(
      <SeasonGrid
        field={changed.field}
        seasonYear={YEAR}
        ratingMode="peak"
        edit={editing}
        trendChanges={changes}
      />,
    );
    expect(changes).toHaveLength(1);
    expect(html).toContain("Changes so far");
    expect(html).toContain(trendNote(changes[0] ?? { teamId: TEAM, from: 0, to: 0 }));
    expect(count(html, SWAPPED_IN)).toBe(count(plain, SWAPPED_IN) + 1);
  });

  it("says so at the top of the season page", () => {
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(changed, { kind: "summary" })} tab="grid" />,
    );
    expect(html).toContain("Edited grid");
    expect(html).toContain("You made 1 change to this");
    expect(html).toContain(teamName(TEAM, YEAR));
  });
});
