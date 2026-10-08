/**
 * The driver and team pages and the two index lists, as markup.
 *
 * Every count comes off the run the page was handed — its roster, its
 * cursor — never a name or a figure, so the tests hold whatever the seed and
 * the ratings produce.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { revealed } from "../lib/reveal.js";
import { rosterOf } from "../lib/roster.js";
import { driversLink, PAGE_OF, teamsLink } from "../lib/roster-places.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import type { Run } from "../store/season.js";
import { inRouter } from "../test-router.js";
import { seededWorld, YEAR } from "../test-support.js";
import { DriverPage, TeamPage } from "./PersonPages.js";
import { RosterIndex } from "./RosterIndex.js";
import { SeasonHistoryProvider } from "./SeasonHistory.js";

const first = seededWorld(3, "aged", YEAR);
const second = seededWorld(4, "aged", YEAR + 1);
const HALFWAY = Math.floor(second.season.races.length / 2);

/** An era in its second year, the first crowned behind it. */
function era(cursor: Run["cursor"]): Run {
  return { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: second, cursor };
}

const midSeason = revealed(era({ kind: "race", round: HALFWAY - 1 })).years;

/** How many rows open into a year, and how many of them are open. */
function disclosures(html: string): { all: number; open: number } {
  return {
    all: html.split("aria-expanded=").length - 1,
    open: html.split('aria-expanded="true"').length - 1,
  };
}

/** Someone on both years' grids, so their page has two rows. */
const twoYears = second.field.find((entrant) =>
  first.field.some((each) => each.driverId === entrant.driverId),
);

describe("a driver's page", () => {
  it("draws a row per year on the grid, the latest one open", () => {
    const roster = rosterOf(midSeason);
    for (const entrant of second.field) {
      const html = renderToStaticMarkup(
        <DriverPage years={midSeason} driverId={entrant.driverId} />,
      );
      expect(disclosures(html)).toEqual({
        all: roster.drivers.get(entrant.driverId)?.length,
        open: 1,
      });
    }
  });

  it("says a place in a year still being written is a place so far", () => {
    const driverId = twoYears?.driverId ?? "";
    const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={driverId} />);
    expect(html).toContain(`after round ${HALFWAY}`);
    expect(html).toContain(" to come");
  });

  it("names a year on the grid with no race in it as just that", () => {
    // A later year that brings in someone new, searched for rather than named.
    const later = PLAYABLE_SEASONS.filter((year) => year > YEAR)
      .map((year) => seededWorld(4, "aged", year))
      .find((world) =>
        world.field.some(
          (entrant) => !first.field.some((each) => each.driverId === entrant.driverId),
        ),
      );
    if (later === undefined) {
      throw new Error("No later season brings in a new driver");
    }
    const newcomer = later.field.find(
      (entrant) => !first.field.some((each) => each.driverId === entrant.driverId),
    );
    const years = revealed({
      kind: "era",
      run: { startYear: YEAR, seasons: [first] },
      world: later,
      cursor: { kind: "grid" },
    }).years;
    const html = renderToStaticMarkup(
      <DriverPage years={years} driverId={newcomer?.driverId ?? ""} />,
    );
    expect(html).toContain("On the grid");
    expect(html).toContain("No races yet");
  });

  it("links each year's row to that year's season page, inside the run's frame only", async () => {
    const driverId = twoYears?.driverId ?? "";
    const years = (rosterOf(midSeason).drivers.get(driverId) ?? []).map((each) => each.year);
    const html = await inRouter(
      <SeasonHistoryProvider seasons={midSeason} pageOf={PAGE_OF}>
        <DriverPage years={midSeason} driverId={driverId} />
      </SeasonHistoryProvider>,
    );
    expect(years.length).toBeGreaterThan(1);
    for (const year of years) {
      expect(html.split(`href="/run/${year}"`).length - 1, `${year}`).toBe(1);
    }
    const bare = renderToStaticMarkup(<DriverPage years={midSeason} driverId={driverId} />);
    expect(bare).not.toContain("<a ");
  });
});

describe("a team's page", () => {
  it("draws a row per year on the grid, the latest one open", () => {
    const roster = rosterOf(midSeason);
    for (const teamId of new Set(second.field.map((entrant) => entrant.teamId))) {
      const html = renderToStaticMarkup(<TeamPage years={midSeason} teamId={teamId} />);
      expect(disclosures(html)).toEqual({ all: roster.teams.get(teamId)?.length, open: 1 });
    }
  });
});

describe("the index lists", () => {
  it("list everyone on the roster, each name a link to their page", async () => {
    const roster = rosterOf(midSeason);
    const html = await inRouter(
      <RosterIndex
        kind="drivers"
        years={midSeason}
        sort="titles"
        linkFor={driversLink}
        pageOf={PAGE_OF}
      />,
    );
    expect(html.split('href="/run/driver/').length - 1).toBe(roster.drivers.size);
    // One heading is the order the list is in.
    expect(html.split('aria-sort="descending"').length - 1).toBe(1);
    expect(html.split('aria-sort="none"').length - 1).toBe(6);
  });

  it("list every team, by its lineage id", async () => {
    const roster = rosterOf(midSeason);
    const html = await inRouter(
      <RosterIndex
        kind="teams"
        years={midSeason}
        sort="name"
        linkFor={teamsLink}
        pageOf={PAGE_OF}
      />,
    );
    for (const teamId of roster.teams.keys()) {
      expect(html).toContain(`href="/run/team/${teamId}"`);
    }
    expect(html.split('aria-sort="ascending"').length - 1).toBe(1);
  });
});
