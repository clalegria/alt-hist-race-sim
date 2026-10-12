/**
 * Engine performance, In-season development, Livery changes and Engine
 * supplier changes: how each is drawn, where the form puts it, what the
 * settings line calls it, and what kept liveries paint. Rendered without a DOM,
 * like the rest of the setup screen; what each does to a run is the store's
 * tests, and the rolls themselves are unit-tested in `@alt-hist/data`.
 */

import { authoredSeasons, seasonSeed, teamLiveryIn, teamsById } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  type CarPerformance,
  HISTORICAL_SETTINGS,
  OPENING_TEAMS,
  type RunSettings,
} from "../lib/run-settings.js";
import { createWorld, ERA_RATING_MODE } from "../store/season.js";
import { settingsForm, YEAR } from "../test-support.js";
import { DevelopmentSetting } from "./DevelopmentSetting.js";
import { EnginePerformanceSetting } from "./EnginePerformanceSetting.js";
import { EngineSuppliersSetting } from "./EngineSuppliersSetting.js";
import { KeptNames } from "./EntryNames.js";
import { KeptLiveries, Liveries } from "./Liveries.js";
import { LiveriesSetting } from "./LiveriesSetting.js";
import { RunSettingsForm } from "./RunSettingsDialog.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { settingsOf } from "./SimulationSettings.js";
import { badgeBackground } from "./TeamBadge.js";
import { TeamName } from "./TeamName.js";

/** The pressed segments' labels, in order, with React's escaped apostrophe read back. */
function pressed(html: string): string[] {
  return [...html.matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((match) =>
    (match[1] ?? "").replaceAll("&#x27;", "'"),
  );
}

/** An era's first year under the given settings. */
function eraYear(settings: RunSettings) {
  return createWorld(3, YEAR, ERA_RATING_MODE, null, null, undefined, null, settings);
}

describe("the engine performance setting", () => {
  it("presses one answer, and the spread and base under Random factor is added", () => {
    const draw = (value: CarPerformance | null) =>
      pressed(
        renderToStaticMarkup(<EnginePerformanceSetting unit="era" enginePerformance={value} />),
      );
    expect(draw(null)).toEqual(["Historical"]);
    expect(draw({ kind: "random" })).toEqual(["Totally random"]);
    expect(draw({ kind: "varied", spread: 20, from: "real" })).toEqual([
      "Random factor is added",
      "±20",
      "The real engine",
    ]);
    expect(draw({ kind: "varied", spread: 5, from: "last" })).toEqual([
      "Random factor is added",
      "±5",
      "Last year's engine",
    ]);
  });

  it("says every team running an engine moves with it, every year only on the era's screen", () => {
    const answers = [{ kind: "random" }, { kind: "varied", spread: 5, from: "real" }] as const;
    for (const value of answers) {
      const draw = (unit: "season" | "era") =>
        renderToStaticMarkup(<EnginePerformanceSetting enginePerformance={value} unit={unit} />);
      for (const unit of ["season", "era"] as const) {
        expect(draw(unit)).toContain("the same for every team that uses it");
      }
      expect(draw("era")).toContain("Every year");
      expect(draw("season")).not.toMatch(/every (year|season)/i);
    }
  });

  it("sits after Chassis performance and before In-season development, on both screens", () => {
    for (const html of [settingsForm("era"), settingsForm("season")]) {
      const at = (label: string) => html.indexOf(`aria-label="${label}"`);
      expect(at("Engine performance")).toBeGreaterThan(at("Chassis performance"));
      expect(at("In-season development")).toBeGreaterThan(at("Engine performance"));
      expect(at("Mechanical failures")).toBeGreaterThan(at("In-season development"));
    }
  });

  it("is named on the settings line when not historical", () => {
    const walking = eraYear({
      ...HISTORICAL_SETTINGS,
      enginePerformance: { kind: "varied", spread: 5, from: "last" },
    });
    expect(settingsOf(walking)).toContainEqual({
      name: "Engine performance",
      value: "Random factor ±5 from last year's engine",
    });
    expect(settingsOf(eraYear(HISTORICAL_SETTINGS)).map((line) => line.name)).not.toContain(
      "Engine performance",
    );
  });
});

describe("the in-season development setting", () => {
  it("presses Historical, Random or Off, with a note only for a what-if", () => {
    const draw = (value: RunSettings["development"]) =>
      renderToStaticMarkup(<DevelopmentSetting development={value} unit="era" />);
    expect(pressed(draw(null))).toEqual(["Historical"]);
    expect(pressed(draw("random"))).toEqual(["Random"]);
    expect(pressed(draw("none"))).toEqual(["Off"]);
    expect(draw(null)).not.toContain("pace");
    expect(draw("none")).toContain("same pace all season");
  });

  it("talks about every year on the era's screen and about the one on a season's", () => {
    const draw = (unit: "season" | "era") =>
      renderToStaticMarkup(<DevelopmentSetting development="random" unit={unit} />);
    expect(draw("era")).toContain("Every year");
    expect(draw("season")).not.toMatch(/every (year|season)/i);
  });

  it("is named on the settings line when not historical", () => {
    expect(settingsOf(eraYear({ ...HISTORICAL_SETTINGS, development: "none" }))).toContainEqual({
      name: "In-season development",
      value: "Off",
    });
  });
});

describe("the livery and engine supplier settings", () => {
  it("press Yes while historical, and No otherwise", () => {
    const pairs = [
      [<LiveriesSetting key="h" liveries={null} />, <LiveriesSetting key="k" liveries="first" />],
      [
        <EngineSuppliersSetting key="h" engineSuppliers={null} />,
        <EngineSuppliersSetting key="k" engineSuppliers="first" />,
      ],
    ] as const;
    for (const [historical, kept] of pairs) {
      expect(pressed(renderToStaticMarkup(historical))).toEqual(["Yes"]);
      expect(pressed(renderToStaticMarkup(kept))).toEqual(["No"]);
    }
  });

  it("sit in Over the years after Team name changes, and not on a season's screen", () => {
    const era = settingsForm("era");
    const at = (label: string) => era.indexOf(`aria-label="${label}"`);
    expect(at("Livery changes")).toBeGreaterThan(at("Team name changes"));
    expect(at("Engine supplier changes")).toBeGreaterThan(at("Livery changes"));
    expect(at("Keep the first season&#x27;s teams")).toBeGreaterThan(at("Engine supplier changes"));

    const season = settingsForm("season");
    expect(season).not.toContain('aria-label="Livery changes"');
    expect(season).not.toContain('aria-label="Engine supplier changes"');
  });

  it("are named on the settings line when kept", () => {
    const world = eraYear({ ...HISTORICAL_SETTINGS, liveries: "first", engineSuppliers: "first" });
    expect(settingsOf(world)).toContainEqual({ name: "Livery changes", value: "No" });
    expect(settingsOf(world)).toContainEqual({ name: "Engine supplier changes", value: "No" });
  });
});

describe("the notes, with every what-if on", () => {
  const everything: RunSettings = {
    ...HISTORICAL_SETTINGS,
    carPerformance: { kind: "varied", spread: 5, from: "last" },
    enginePerformance: { kind: "random" },
    development: "random",
    teamNames: "first",
    liveries: "first",
    engineSuppliers: "first",
    teams: OPENING_TEAMS,
  };

  it("no longer say engines or colours stay as they were", () => {
    for (const unit of ["season", "era"] as const) {
      const html = renderToStaticMarkup(
        <RunSettingsForm
          choice={{ randomness: 1, settings: everything }}
          year={YEAR}
          unit={unit}
          eraSettings={unit === "era"}
        />,
      );
      expect(html).not.toContain("Engines stay historical");
      expect(html).not.toContain("colours still change");
    }
  });
});

/**
 * A team entered in `from` and again in a later `year` in other colours —
 * found by search, so re-authoring a team's eras moves the case rather than
 * breaking the test.
 */
function repainted(): { teamId: string; from: number; year: number } | undefined {
  const teams = teamsById();
  for (const from of authoredSeasons) {
    for (const year of authoredSeasons.filter((later) => later > from)) {
      for (const entry of seasonSeed(from).entries) {
        const team = teams.get(entry.teamId);
        if (
          team !== undefined &&
          seasonSeed(year).entries.some((each) => each.teamId === entry.teamId) &&
          teamLiveryIn(team, from).primaryColor !== teamLiveryIn(team, year).primaryColor
        ) {
          return { teamId: team.id, from, year };
        }
      }
    }
  }
  return undefined;
}

describe("a team's colours under kept liveries", () => {
  const found = repainted();

  it("finds a team to test against", () => {
    expect(found).toBeDefined();
  });

  it("paints the first season's livery, and leaves the name to its own setting", () => {
    if (found === undefined) {
      return;
    }
    const { teamId, from, year } = found;
    const team = teamsById().get(teamId);
    if (team === undefined) {
      return;
    }
    const draw = (keptFrom: number | null) =>
      renderToStaticMarkup(
        <KeptNames from={null}>
          <KeptLiveries from={keptFrom}>
            <Liveries year={year}>
              <TeamName teamId={teamId} badge />
            </Liveries>
          </KeptLiveries>
        </KeptNames>,
      );
    expect(draw(from)).toContain(badgeBackground(teamLiveryIn(team, from)));
    expect(draw(null)).toContain(badgeBackground(teamLiveryIn(team, year)));
    // The name is read at the year itself: the livery setting does not keep it.
    expect(draw(from)).toBe(
      draw(null).replace(
        badgeBackground(teamLiveryIn(team, year)),
        badgeBackground(teamLiveryIn(team, from)),
      ),
    );
  });

  it("paints the grid's cards in the first season's livery too", () => {
    if (found === undefined) {
      return;
    }
    const { teamId, from, year } = found;
    const team = teamsById().get(teamId);
    if (team === undefined) {
      return;
    }
    const field = createWorld(3, year).field;
    const draw = (keptFrom: number | null) =>
      renderToStaticMarkup(
        <KeptLiveries from={keptFrom}>
          <SeasonGrid field={field} seasonYear={year} ratingMode={ERA_RATING_MODE} />
        </KeptLiveries>,
      );
    expect(draw(from)).toContain(badgeBackground(teamLiveryIn(team, from)));
    expect(draw(null)).toContain(badgeBackground(teamLiveryIn(team, year)));
    expect(draw(null)).not.toContain(badgeBackground(teamLiveryIn(team, from)));
  });
});
