/**
 * Re-rating an engine, as the reader meets it.
 *
 * Rendered statically like the rest of the editor's tests, so what these reach
 * is the markup each state produces; the stepping rule itself is unit-tested in
 * `@alt-hist/data`. Every engine below is either synthetic or a step away from
 * the authored one, never a rating read off the data.
 */

import {
  authoredEngineRatings,
  type EngineRatingChange,
  engineRatingChanges,
  stepEngine,
} from "@alt-hist/data";
import type { EngineSpec } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { engineName } from "../lib/names.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { changeCount, engineSummary } from "./LineupChanges.js";
import { EngineStepper, type GridEditing, SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld();
const TEAMS = new Set(world.field.map((entrant) => entrant.teamId)).size;
const MINUS = "−";

const editing: GridEditing = {
  selected: null,
  onSelect: () => {},
  engineIds: SEED.engines.map((engine) => engine.engineId),
  onEngineChange: () => {},
  onChassisStep: () => {},
  onEngineStep: () => {},
};

/** The engine most teams run, so a step on it has more than one card to move. */
const ENGINE = (() => {
  const counts = new Map<string, number>();
  for (const entry of SEED.entries) {
    counts.set(entry.engineId, (counts.get(entry.engineId) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
})();
const CUSTOMERS = SEED.entries.filter((entry) => entry.engineId === ENGINE).length;

const MIDDLE: EngineSpec = { racing: 60, qualifying: 60, reliability: 60 };

/** A change of the given size on every rating, or of the given sizes one by one. */
function change(by: number | Partial<EngineSpec>): EngineRatingChange {
  const delta = (key: keyof EngineSpec): number => (typeof by === "number" ? by : (by[key] ?? 0));
  return {
    engineId: ENGINE,
    from: MIDDLE,
    to: {
      racing: MIDDLE.racing + delta("racing"),
      qualifying: MIDDLE.qualifying + delta("qualifying"),
      reliability: MIDDLE.reliability + delta("reliability"),
    },
  };
}

/** How many times a string occurs in the markup. */
function count(html: string, what: string): number {
  return html.split(what).length - 1;
}

describe("the engine stepper on each card", () => {
  it("is drawn on every team in the editor, named by the engine", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    expect(html.match(/aria-label="Strengthen [^"]* engine"/g)).toHaveLength(TEAMS);
    expect(html.match(/aria-label="Weaken [^"]* engine"/g)).toHaveLength(TEAMS);
    expect(count(html, `aria-label="Strengthen ${engineName(ENGINE)} engine"`)).toBe(CUSTOMERS);
  });

  it("is not drawn outside the editor", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode="peak" />,
    );
    expect(html).not.toContain("Strengthen ");
  });

  it("disables the button that could move nothing further, and names one rating", () => {
    const top: EngineSpec = { racing: 100, qualifying: 100, reliability: 100 };
    const html = renderToStaticMarkup(
      <EngineStepper
        engineId={ENGINE}
        engine={top}
        delta={0}
        rating={{ key: "racing", label: "Racing" }}
        onStep={() => {}}
      />,
    );
    const strengthen = html.slice(html.indexOf('aria-label="Strengthen'));
    expect(strengthen.slice(0, strengthen.indexOf(">"))).toContain('disabled=""');
    expect(html).toContain(`aria-label="Strengthen ${engineName(ENGINE)} engine racing"`);
  });
});

describe("what moved on an engine", () => {
  it("is one move when all three moved together, else each rating by name", () => {
    expect(engineSummary(change(2))).toBe("+2 each");
    expect(engineSummary(change({ racing: 3, reliability: -1 }))).toBe(
      `racing +3, reliability ${MINUS}1`,
    );
  });

  it("counts as one change, however many teams run it", () => {
    expect(changeCount([], [], [], [change(2)])).toBe("1 change");
  });
});

describe("a grid with a re-rated engine", () => {
  const authored = authoredEngineRatings(SEED);
  const lower = stepEngine(authored, ENGINE, -1);
  const rerated = lower === authored ? stepEngine(authored, ENGINE, 1) : lower;
  const changes = engineRatingChanges(SEED, rerated);
  const said = `${engineName(ENGINE)} engine ${engineSummary(changes[0] as EngineRatingChange)}`;
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
    rerated,
  );

  it("says so on every card running it, lists it once, and marks each of those teams", () => {
    const plain = renderToStaticMarkup(
      <SeasonGrid field={changed.field} seasonYear={YEAR} ratingMode="peak" edit={editing} />,
    );
    const html = renderToStaticMarkup(
      <SeasonGrid
        field={changed.field}
        seasonYear={YEAR}
        ratingMode="peak"
        edit={editing}
        engineRatingChanges={changes}
      />,
    );
    expect(changes).toHaveLength(1);
    expect(html).toContain("Changes so far");
    expect(count(html, said)).toBe(CUSTOMERS);
    expect(count(html, `${engineName(ENGINE)} engine</span>`)).toBe(1);
    expect(count(html, SWAPPED_IN)).toBe(count(plain, SWAPPED_IN) + CUSTOMERS);
  });

  it("says so at the top of the season page, and again on its grid tab", () => {
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(changed, { kind: "summary" })} tab="grid" />,
    );
    expect(html).toContain("Alternate grid");
    expect(count(html, `${engineName(ENGINE)} engine</span>`)).toBe(2);
    expect(html).toContain("1 change from the real one");
  });
});
