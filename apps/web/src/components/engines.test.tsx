/**
 * Engines, as the reader meets them.
 *
 * Rendered statically like everything else here, so what these reach is the
 * markup each state produces. The blend itself is the engine package's, and the
 * supply rules are unit-tested in `@alt-hist/data`; what is checked here is that
 * the page shows the car that will actually be raced, and calls it by the name
 * the season is run under.
 *
 * Every fixture below is *found* in the seed data rather than named. Which team
 * ran whose engine is history, but which engines exist in which year, and what
 * any of them is worth, is authored data that keeps moving.
 */

import {
  applyEngines,
  authoredEngines,
  availableEngines,
  engineChanges,
  seasons,
} from "@alt-hist/data";
import { powertrain } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { engineName, entryName, teamName } from "../lib/names.js";
import { carOverall } from "../lib/rating.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { GridStage } from "./GridStage.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld();

/** The first entry matching a condition, or a throw naming what was wanted. */
function someEntry(matches: (entry: (typeof SEED.entries)[number]) => boolean, what: string) {
  const found = SEED.entries.find(matches);
  if (found === undefined) {
    throw new Error(`the season has no ${what}`);
  }
  return found;
}

/** A customer team: one whose engine carries somebody else's name. */
const CUSTOMER = someEntry(
  (entry) => engineName(entry.engineId).toLowerCase() !== teamName(entry.teamId).toLowerCase(),
  "team running an engine other than its own",
);

/**
 * The name the customer team should appear under, spelled out here rather than
 * taken from `entryName`: a test that builds its expectation with the function
 * under test passes whatever that function does.
 */
const CUSTOMER_NAME = `${teamName(CUSTOMER.teamId)}-${engineName(CUSTOMER.engineId)}`;

/** A works team: one that builds what it races, so its name stands alone. */
const WORKS = someEntry(
  (entry) => engineName(entry.engineId).toLowerCase() === teamName(entry.teamId).toLowerCase(),
  "team running its own engine",
);

describe("naming an entry", () => {
  it("hyphenates the supplier onto the chassis", () => {
    expect(entryName(CUSTOMER.teamId, CUSTOMER.engineId)).toBe(CUSTOMER_NAME);
  });

  it("leaves a works team as itself, with no repeated name", () => {
    expect(entryName(WORKS.teamId, WORKS.engineId)).toBe(teamName(WORKS.teamId));
  });

  it("is the plain team name where there is no engine to name", () => {
    expect(entryName(CUSTOMER.teamId)).toBe(teamName(CUSTOMER.teamId));
  });
});

describe("the grid", () => {
  const html = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={world.ratingMode} />,
  );

  it("names each team the way the season entered it", () => {
    expect(html).toContain(`>${CUSTOMER_NAME}<`);
    expect(html).toContain(`>${teamName(WORKS.teamId)}<`);
    // …and does not double the works team up.
    expect(html).not.toContain(`${teamName(WORKS.teamId)}-${engineName(WORKS.engineId)}`);
  });

  it("scores the car with the engine in it, not the bare chassis", () => {
    // A team whose engine actually moves the number, found rather than named:
    // an engine rated exactly like the chassis it sits in would prove nothing.
    const moved = world.field.find(
      (entrant) => carOverall(entrant.chassis, entrant.engine) !== carOverall(entrant.chassis),
    );
    if (moved === undefined) {
      throw new Error("no engine on this grid changes what its car is worth");
    }
    expect(html).toContain(`>${carOverall(moved.chassis, moved.engine)}<`);
  });

  it("keeps the engine's own ratings behind the popover, like every other rating", () => {
    // Closed markup shows one number per car. Radix renders no popover content.
    for (const entrant of world.field) {
      expect(html, entrant.teamId).not.toContain(`${engineName(entrant.engineId ?? "")} engine`);
    }
  });
});

describe("the grid editor", () => {
  const html = renderToStaticMarkup(
    <GridStage field={world.field} year={YEAR} ratingMode="peak" lineup={null} engines={null} />,
  );

  it("offers no supplier picker until the reader asks to edit", () => {
    expect(html).not.toContain("<select");
  });
});

describe("the supplier picker", () => {
  const editing = {
    selected: null,
    onSelect: () => {},
    engineIds: availableEngines(SEED).map((engine) => engine.engineId),
    onEngineChange: () => {},
    onChassisStep: () => {},
  };
  const html = renderToStaticMarkup(
    <SeasonGrid
      field={world.field}
      seasonYear={YEAR}
      ratingMode={world.ratingMode}
      edit={editing}
      changes={[]}
    />,
  );
  const teams = new Set(world.field.map((entrant) => entrant.teamId));

  it("gives every team one, whatever engine it runs", () => {
    expect(html.split("<select").length - 1).toBe(teams.size);
  });

  it("offers every engine the season rates, to every team", () => {
    const options = SEED.engines.length * teams.size;
    expect(html.split("<option").length - 1).toBe(options);
    for (const engine of SEED.engines) {
      expect(html, engine.engineId).toContain(`>${engineName(engine.engineId)}</option>`);
    }
  });

  it("starts each team on the engine it actually ran", () => {
    // Read off the markup in card order — the cards are alphabetical by team —
    // rather than by searching for a name: a works team is called the same
    // thing as one of the options in every other team's picker.
    const selected = [...html.matchAll(/<option value="(\w+)" selected=""/g)].map(
      (match) => match[1],
    );
    const expected = [...SEED.entries]
      .sort((a, b) => teamName(a.teamId).localeCompare(teamName(b.teamId)))
      .map((entry) => entry.engineId);

    expect(selected).toHaveLength(teams.size);
    expect(selected).toEqual(expected);
  });
});

describe("a re-supplied grid", () => {
  const swap = (() => {
    for (const entry of SEED.entries) {
      const other = SEED.engines.find((engine) => engine.engineId !== entry.engineId);
      if (other !== undefined) {
        return { teamId: entry.teamId, from: entry.engineId, to: other.engineId };
      }
    }
    throw new Error("the season rates only one engine");
  })();
  const resupplied = { ...authoredEngines(SEED), [swap.teamId]: swap.to };
  const changed = createWorld(3, YEAR, "peak", null, resupplied);

  it("re-names the team it happened to", () => {
    const html = renderToStaticMarkup(
      <GridStage
        field={changed.field}
        year={YEAR}
        ratingMode="peak"
        lineup={null}
        engines={resupplied}
      />,
    );
    expect(html).toContain(`>${teamName(swap.teamId)}-${engineName(swap.to)}<`);
  });

  it("says so at the top of the summary, and again on the grid at the foot", () => {
    const html = renderToStaticMarkup(<SeasonView {...shownAt(changed, { kind: "summary" })} />);
    const said = `${engineName(swap.to)} engine for ${engineName(swap.from)}`;

    expect(html).toContain("Alternate grid");
    expect(html.split(said).length - 1).toBe(2);
    expect(html).toContain("1 change from the season as it was entered");
  });

  it("says none of it when the supply was left alone", () => {
    const html = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);
    expect(html).not.toContain("Alternate grid");
    expect(html).not.toContain("engine for ");
  });

  it("runs a different season, on the same dice", () => {
    expect(changed.seed).toBe(world.seed);
    expect(changed.season).not.toEqual(world.season);
  });
});

describe("the entry name, everywhere a team is named", () => {
  it("reaches the tables that only know a team id", () => {
    for (const view of [
      { kind: "qualifying", round: 0 },
      { kind: "race", round: 0 },
      { kind: "summary" },
    ] as const) {
      const html = renderToStaticMarkup(<SeasonView {...shownAt(world, view)} />);
      expect(html, view.kind).toContain(CUSTOMER_NAME);
    }
  });

  it("degrades to the plain team name outside a season", () => {
    // A component rendered on its own has no supply to read, and must not
    // invent one. This is what keeps every other test in this suite renderable.
    const race = world.season.races[0];
    if (race === undefined) {
      throw new Error("the season has no rounds");
    }
    const html = renderToStaticMarkup(<QualifyingResults race={race} />);
    expect(html).toContain(teamName(CUSTOMER.teamId));
    expect(html).not.toContain(CUSTOMER_NAME);
  });
});

describe("every authored season", () => {
  it("gives every car on every grid an engine, and a name to go with it", () => {
    for (const season of seasons.values()) {
      const built = createWorld(1, season.year);
      for (const entrant of built.field) {
        expect(entrant.engineId, `${season.year} ${entrant.teamId}`).toBeDefined();
        expect(entrant.engine, `${season.year} ${entrant.teamId}`).toBeDefined();
        expect(engineName(entrant.engineId ?? ""), `${season.year} ${entrant.engineId}`).not.toBe(
          entrant.engineId,
        );
      }
    }
  });

  it("prices the engine into the car the race is run on", () => {
    for (const season of seasons.values()) {
      const built = createWorld(1, season.year);
      const moved = built.field.filter(
        (entrant) => powertrain(entrant.chassis, entrant.engine).racing !== entrant.chassis.racing,
      );
      // Not every car — a chassis and an engine rated alike blend to themselves
      // — but a season where the engines changed nothing at all would mean the
      // whole feature was inert.
      expect(moved.length, `${season.year}`).toBeGreaterThan(0);
    }
  });

  it("leaves a re-supplied season as valid as the one it was authored as", () => {
    for (const season of seasons.values()) {
      const engines = authoredEngines(season);
      expect(engineChanges(season, engines), `${season.year}`).toEqual([]);
      expect(() => applyEngines(season, engines), `${season.year}`).not.toThrow();
    }
  });
});
