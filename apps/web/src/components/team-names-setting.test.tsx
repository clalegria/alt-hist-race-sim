/**
 * The Team names setting, where a run states it, and what it does to a name on
 * screen. Rendered without a DOM, like the rest of the setup screen; what it
 * records on a run is the era's store tests.
 */

import {
  authoredSeasons,
  FIRST_AUTHORED_SEASON,
  seasonSeed,
  teamIdentityIn,
  teamLiveryIn,
  teamsById,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HISTORICAL_SETTINGS } from "../lib/run-settings.js";
import { createWorld, ERA_RATING_MODE } from "../store/season.js";
import { settingsForm } from "../test-support.js";
import { KeptNames } from "./EntryNames.js";
import { Liveries } from "./Liveries.js";
import { settingsOf } from "./SimulationSettings.js";
import { badgeBackground } from "./TeamBadge.js";
import { TeamName } from "./TeamName.js";
import { TeamNamesSetting } from "./TeamNamesSetting.js";

/**
 * A team entered in `from` and again in a later `year` under another name, a
 * different base and other colours — found by search, so re-authoring a team's
 * eras moves the case rather than breaking the test.
 */
function renamed(): { teamId: string; from: number; year: number } | undefined {
  const teams = teamsById();
  for (const from of authoredSeasons) {
    for (const year of authoredSeasons.filter((later) => later > from)) {
      for (const entry of seasonSeed(from).entries) {
        const team = teams.get(entry.teamId);
        if (
          team !== undefined &&
          seasonSeed(year).entries.some((each) => each.teamId === entry.teamId) &&
          teamIdentityIn(team, from).name !== teamIdentityIn(team, year).name &&
          teamIdentityIn(team, from).base !== teamIdentityIn(team, year).base &&
          teamLiveryIn(team, from).primaryColor !== teamLiveryIn(team, year).primaryColor
        ) {
          return { teamId: team.id, from, year };
        }
      }
    }
  }
  return undefined;
}

describe("the team names setting", () => {
  it("presses As they happened while historical, and Keep the first otherwise", () => {
    const historical = renderToStaticMarkup(<TeamNamesSetting teamNames={null} />);
    expect(historical).toMatch(/aria-pressed="true"[^>]*>As they happened</);
    const kept = renderToStaticMarkup(<TeamNamesSetting teamNames="first" />);
    expect(kept).toMatch(/aria-pressed="true"[^>]*>Keep the first</);
    for (const html of [historical, kept]) {
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });

  it("is offered on the era's setup screen, in the Over the years group after Career events, and not on a season's", () => {
    const era = settingsForm("era");
    const at = (label: string) => era.indexOf(`aria-label="${label}"`);
    expect(at("Team names")).toBeGreaterThan(at("Over the years"));
    expect(at("Team names")).toBeGreaterThan(at("Career events"));

    const season = settingsForm("season");
    expect(season).not.toContain('aria-label="Over the years"');
    expect(season).not.toContain('aria-label="Team names"');
  });

  it("is named on the settings line when kept", () => {
    const world = createWorld(
      3,
      FIRST_AUTHORED_SEASON,
      ERA_RATING_MODE,
      null,
      null,
      undefined,
      null,
      null,
      { ...HISTORICAL_SETTINGS, teamNames: "first" },
    );
    expect(settingsOf(world)).toContainEqual({ name: "Team names", value: "Keep the first" });
  });
});

describe("a team name under kept names", () => {
  const found = renamed();

  it("finds a team to test against", () => {
    expect(found).toBeDefined();
  });

  it("keeps the first name and flag, and paints the year's own livery", () => {
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
        <KeptNames from={keptFrom}>
          <Liveries year={year}>
            <TeamName teamId={teamId} badge />
          </Liveries>
        </KeptNames>,
      );
    const kept = draw(from);
    expect(kept).toContain(teamIdentityIn(team, from).name);
    expect(kept).not.toContain(teamIdentityIn(team, year).name);
    expect(kept).toContain(`<title>${teamIdentityIn(team, from).base}</title>`);
    expect(kept).toContain(badgeBackground(teamLiveryIn(team, year)));

    const historical = draw(null);
    expect(historical).toContain(teamIdentityIn(team, year).name);
    expect(historical).toContain(`<title>${teamIdentityIn(team, year).base}</title>`);
  });
});
