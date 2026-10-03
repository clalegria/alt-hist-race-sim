/**
 * The slider, and where it is offered.
 *
 * Rendered through `renderToStaticMarkup` like the rest of the pre-race screens
 * — the value and the level's own words come back out of the markup, which is
 * exactly what a reader has to be able to see before starting a run. What
 * choosing a level *does* is the store's tests; what it means is the engine's.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { RANDOMNESS_LEVELS } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { EraChampions } from "./EraChampions.js";
import { RandomnessNote } from "./RandomnessNote.js";
import { RANDOMNESS_OPTIONS, RandomnessSlider, randomnessLabel } from "./RandomnessSlider.js";
import { EraPicker, SeasonPicker } from "./SeasonPicker.js";
import { SeasonView } from "./SeasonView.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";

const noop = () => {};

describe("the randomness slider", () => {
  it("names every level the engine offers, exactly once", () => {
    // The words are copy, so the test asserts the *coverage* rather than any
    // one label: a level the engine gains and the slider does not know about is
    // a stop the reader cannot reach.
    expect(RANDOMNESS_OPTIONS.map((option) => option.level)).toEqual([...RANDOMNESS_LEVELS]);
    expect(new Set(RANDOMNESS_OPTIONS.map((option) => option.label)).size).toBe(
      RANDOMNESS_LEVELS.length,
    );
  });

  it("spans the whole range as one step-per-level slider", () => {
    const html = renderToStaticMarkup(<RandomnessSlider level={STARTING_RANDOMNESS_LEVEL} />);
    expect(html).toContain('type="range"');
    expect(html).toContain(`min="${RANDOMNESS_LEVELS[0] ?? ""}"`);
    expect(html).toContain(`max="${RANDOMNESS_LEVELS.at(-1) ?? ""}"`);
    expect(html).toContain('step="1"');
  });

  it("centres each label on the stop it names", () => {
    // The tick labels are positioned against the thumb's own travel — inset by
    // half a thumb at each end — rather than spread across the full width,
    // which is what put every label but the middle one off its mark. Their
    // percentages have to run 0..100 across the stops, evenly.
    const html = renderToStaticMarkup(<RandomnessSlider level={STARTING_RANDOMNESS_LEVEL} />);
    const positions = [...html.matchAll(/left:\s*([0-9.]+)%/g)].map((match) =>
      Number(match[1] ?? Number.NaN),
    );
    expect(positions.length).toBe(RANDOMNESS_LEVELS.length);
    expect(positions[0]).toBe(0);
    expect(positions.at(-1)).toBe(100);
    const gaps = positions.slice(1).map((position, index) => position - (positions[index] ?? 0));
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(100 / (RANDOMNESS_LEVELS.length - 1), 6);
    }
    // Centred on that position rather than starting at it.
    expect(html).toContain("-translate-x-1/2");
  });

  it("draws the level it is given, and says which one in words", () => {
    for (const level of RANDOMNESS_LEVELS) {
      const html = renderToStaticMarkup(<RandomnessSlider level={level} />);
      expect(html, `level ${level}`).toContain(`value="${level}"`);
      // The number alone tells a screen reader nothing about what was chosen.
      expect(html, `level ${level}`).toContain(`aria-valuetext="${randomnessLabel(level)}"`);
    }
  });

  it("marks the level the screen opens on as the default, and no other", () => {
    const opening = renderToStaticMarkup(<RandomnessSlider level={STARTING_RANDOMNESS_LEVEL} />);
    expect(opening).toContain("(default)");
    for (const level of RANDOMNESS_LEVELS.filter((one) => one !== STARTING_RANDOMNESS_LEVEL)) {
      expect(renderToStaticMarkup(<RandomnessSlider level={level} />)).not.toContain("(default)");
    }
  });
});

describe("where the level is chosen", () => {
  it("is on the setup screen of both modes", () => {
    for (const [name, html] of [
      ["season", renderToStaticMarkup(<SeasonPicker onStart={noop} />)],
      ["era", renderToStaticMarkup(<EraPicker onStart={noop} />)],
    ] as const) {
      expect(html, name).toContain('aria-label="Randomness"');
      expect(html, name).toContain('type="range"');
    }
  });

  it("is stated but not offered once a season exists", () => {
    const world = createWorld(3, FIRST_AUTHORED_SEASON, "peak", null, null, 5);
    const html = renderToStaticMarkup(<RandomnessNote level={world.randomness} />);
    expect(html).toContain(randomnessLabel(5));
    expect(html).not.toContain("<input");
  });
});

describe("the settings a finished championship was run under", () => {
  const world = createWorld(3, FIRST_AUTHORED_SEASON, "peak", null, null, 5);

  it("names each setting and its value", () => {
    // A list rather than a sentence, so a second setting is a line in
    // `settingsOf` rather than a rewrite of the copy on two screens.
    expect(settingsOf(world)).toEqual([{ name: "Randomness", value: randomnessLabel(5) }]);
  });

  it("says what it is, not just the value", () => {
    const html = renderToStaticMarkup(<SimulationSettings settings={settingsOf(world)} />);
    for (const setting of settingsOf(world)) {
      expect(html).toContain(setting.name);
      expect(html).toContain(setting.value);
    }
  });

  it("sits between the champions and the season they came out of", () => {
    // Where it goes is the point: overlaying the champion is what the first
    // attempt did. The summary's sections are stacked with no gap of their own,
    // so this line has to bring its own padding and sit in the break.
    const html = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);
    const champion = html.indexOf("champion");
    const note = html.indexOf("Simulation settings");
    // The card headed "Season" is the round-by-round table under the break.
    const seasonCard = html.indexOf(">Season<");
    expect(champion).toBeGreaterThan(-1);
    expect(seasonCard).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(champion);
    expect(note).toBeLessThan(seasonCard);
    expect(html.indexOf(randomnessLabel(5), note)).toBeGreaterThan(note);
    // And it is spaced rather than pulled into its neighbours.
    expect(html.slice(note - 200, note)).toContain("py-5");
  });

  it("reaches the roll of honour, off the season that fixed the settings", () => {
    const html = renderToStaticMarkup(
      <EraChampions run={{ startYear: world.year, seasons: [world] }} />,
    );
    expect(html).toContain(randomnessLabel(5));
  });
});
