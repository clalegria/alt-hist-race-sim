/**
 * The Chassis performance setting, where a run states it, and how a varied grid
 * reads. Rendered without a DOM, like the rest of the setup screen; what it
 * records on a run is the era's store tests, and the roll itself is
 * unit-tested in `@alt-hist/data`.
 */

import { type ChassisChange, chassisChanges, stepChassis } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CAR_VARIATION_SPREADS,
  HISTORICAL_SETTINGS,
  type RunSettings,
} from "../lib/run-settings.js";
import { seasonWithChassis } from "../lib/seasons.js";
import { createWorld, ERA_RATING_MODE } from "../store/season.js";
import { settingsForm, settingsPanel, shownAt, YEAR } from "../test-support.js";
import { CarPerformanceSetting } from "./CarPerformanceSetting.js";
import { chassisNote } from "./LineupChanges.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

/** The pressed segments' labels, in order, with React's escaped apostrophe read back. */
function pressed(html: string): string[] {
  return [...html.matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((match) =>
    (match[1] ?? "").replaceAll("&#x27;", "'"),
  );
}

/** An era's first year under the given settings, perhaps with the reader's own chassis. */
function eraYear(settings: RunSettings, chassis: Parameters<typeof createWorld>[6] = null) {
  return createWorld(3, YEAR, ERA_RATING_MODE, null, null, undefined, chassis, settings);
}

describe("the car performance setting", () => {
  it("presses one answer, and the spread under Random factor is added", () => {
    expect(
      pressed(renderToStaticMarkup(<CarPerformanceSetting unit="era" carPerformance={null} />)),
    ).toEqual(["Historical"]);
    expect(
      pressed(
        renderToStaticMarkup(
          <CarPerformanceSetting unit="era" carPerformance={{ kind: "random" }} />,
        ),
      ),
    ).toEqual(["Totally random"]);
    for (const spread of CAR_VARIATION_SPREADS) {
      expect(
        pressed(
          renderToStaticMarkup(
            <CarPerformanceSetting
              unit="era"
              carPerformance={{ kind: "varied", spread, from: "real" }}
            />,
          ),
        ),
      ).toEqual(["Random factor is added", `±${spread}`, "The real chassis"]);
    }
    expect(
      pressed(
        renderToStaticMarkup(
          <CarPerformanceSetting
            unit="era"
            carPerformance={{ kind: "varied", spread: 5, from: "last" }}
          />,
        ),
      ),
    ).toEqual(["Random factor is added", "±5", "Last year's chassis"]);
  });

  it("offers last year's car only on the era's screen, and only under Random factor is added", () => {
    const base = 'aria-label="Each year starts from"';
    const varied = { kind: "varied", spread: 5, from: "real" } as const;
    expect(
      renderToStaticMarkup(<CarPerformanceSetting unit="era" carPerformance={varied} />),
    ).toContain(base);
    expect(
      renderToStaticMarkup(<CarPerformanceSetting unit="season" carPerformance={varied} />),
    ).not.toContain(base);
    for (const carPerformance of [null, { kind: "random" }] as const) {
      expect(
        renderToStaticMarkup(<CarPerformanceSetting unit="era" carPerformance={carPerformance} />),
      ).not.toContain(base);
    }
  });

  it("says a walk moves every year, by up to the spread chosen, and drifts back", () => {
    const note = renderToStaticMarkup(
      <CarPerformanceSetting
        unit="era"
        carPerformance={{ kind: "varied", spread: 5, from: "last" }}
      />,
    );
    expect(note).toContain("every year");
    expect(note).toContain("up to 5 rating points a year");
    expect(note).toContain("drifts back towards the pack");
  });

  it("offers the spreads only under Random factor is added", () => {
    const spreads = 'aria-label="Varies by up to"';
    expect(
      renderToStaticMarkup(<CarPerformanceSetting unit="era" carPerformance={null} />),
    ).not.toContain(spreads);
    expect(
      renderToStaticMarkup(
        <CarPerformanceSetting unit="era" carPerformance={{ kind: "random" }} />,
      ),
    ).not.toContain(spreads);
    expect(
      renderToStaticMarkup(
        <CarPerformanceSetting
          unit="era"
          carPerformance={{ kind: "varied", spread: 5, from: "real" }}
        />,
      ),
    ).toContain(spreads);
  });

  it("is offered on both setup screens, on the Cars tab", () => {
    for (const html of [settingsForm("era"), settingsForm("season")]) {
      expect(settingsPanel(html, "cars")).toContain('aria-label="Chassis performance"');
      expect(settingsPanel(html, "races")).not.toContain('aria-label="Chassis performance"');
    }
  });

  it("talks about every year on the era's screen and about the one on a season's", () => {
    const answers = [{ kind: "random" }, { kind: "varied", spread: 5, from: "real" }] as const;
    for (const carPerformance of answers) {
      const draw = (unit: "season" | "era") =>
        renderToStaticMarkup(<CarPerformanceSetting carPerformance={carPerformance} unit={unit} />);
      expect(draw("era")).toContain("Every year");
      expect(draw("season")).not.toMatch(/every (year|season)/i);
      expect(draw("season")).not.toContain("that year");
    }
  });

  it("names the historical answer the same on both screens", () => {
    const draw = (unit: "season" | "era") =>
      pressed(renderToStaticMarkup(<CarPerformanceSetting carPerformance={null} unit={unit} />));
    expect(draw("season")).toEqual(["Historical"]);
    expect(draw("era")).toEqual(["Historical"]);
  });

  it("is named on the settings line when not historical", () => {
    const varied = eraYear({
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "varied", spread: 5, from: "real" },
    });
    expect(settingsOf(varied)).toContainEqual({
      name: "Chassis performance",
      value: "Random factor ±5",
    });
    const walking = eraYear({
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "varied", spread: 5, from: "last" },
    });
    expect(settingsOf(walking)).toContainEqual({
      name: "Chassis performance",
      value: "Random factor ±5 from last year's chassis",
    });
    expect(settingsOf(eraYear(HISTORICAL_SETTINGS)).map((line) => line.name)).not.toContain(
      "Chassis performance",
    );
  });
});

describe("a grid on rolled cars", () => {
  const random: RunSettings = { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } };
  const rolled = eraYear(random);

  it("is not an edited grid", () => {
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(rolled, { kind: "summary" })} tab="grid" />,
    );
    expect(html).not.toContain("Edited grid");
    expect(html).not.toContain("You made");
  });

  it("counts the reader's own change from the rolled car, not from history", () => {
    const base = rolled.baselineChassis ?? {};
    const team = Object.keys(base)[0] ?? "";
    const weaker = stepChassis(base, team, -1);
    const edited = weaker === base ? stepChassis(base, team, 1) : weaker;
    const changes = chassisChanges(seasonWithChassis(YEAR, base), edited);
    expect(changes).toHaveLength(1);

    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(eraYear(random, edited), { kind: "summary" })} tab="grid" />,
    );
    expect(html).toContain("You made 1 change to this");
    expect(html).toContain(chassisNote(changes[0] as ChassisChange));
  });
});
