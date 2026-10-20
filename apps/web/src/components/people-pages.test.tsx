/**
 * The driver and team pages and the two index lists, as markup.
 *
 * Every count comes off the run the page was handed — its roster, its
 * cursor — never a name or a figure, so the tests hold whatever the seed and
 * the ratings produce.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverSeasonsBefore, seasonsBefore } from "../lib/barcode.js";
import { driverBirthYear, driverName } from "../lib/names.js";
import { careerRecords } from "../lib/records.js";
import { revealed } from "../lib/reveal.js";
import { bestOverall, rosterOf } from "../lib/roster.js";
import { driversLink, PAGE_OF, teamsLink } from "../lib/roster-places.js";
import { isPlayable, PLAYABLE_SEASONS } from "../lib/seasons.js";
import type { Run } from "../store/season.js";
import { inRouter } from "../test-router.js";
import { seededWorld, textOf, YEAR } from "../test-support.js";
import { DriverPage, TeamPage } from "./PersonPages.js";
import { RosterIndex } from "./RosterIndex.js";
import { SeasonHistoryProvider } from "./SeasonHistory.js";
import { CAR_SIZES } from "./TeamCar.js";
import { TitleCount, titlesLabel } from "./TitleCount.js";

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

/** Each column heading's words, and whether a phone hides its column. */
function phoneHeadings(html: string): [string, boolean][] {
  return [...html.matchAll(/<th [^>]*class="([^"]*)"[^>]*>(.*?)<\/th>/g)].map(
    ([, classes = "", inner = ""]) => [
      textOf(inner).replace(/[↑↓]/g, "").trim(),
      classes.includes("hidden sm:table-cell"),
    ],
  );
}

/**
 * A page's showcase: one to three large cars, none turning, the row hidden on a
 * phone, each with a plain tooltip naming its team and year.
 */
function expectShowcase(html: string): void {
  const cars = html.split(CAR_SIZES.large).length - 1;
  expect(cars).toBeGreaterThanOrEqual(1);
  expect(cars).toBeLessThanOrEqual(3);
  expect(html.match(/<figure title="[^"]+ \(\d{4}\)"/g)?.length).toBe(cars);
  expect(html).not.toContain("animate-wheel");
  expect(html).toContain('class="hidden shrink-0 items-end gap-4 sm:flex"');
}

/** Someone on both years' grids, so their page has two rows. */
const twoYears = second.field.find((entrant) =>
  first.field.some((each) => each.driverId === entrant.driverId),
);

describe("a driver's page", () => {
  it("draws a row per year on the grid, every one shut", () => {
    const roster = rosterOf(midSeason);
    for (const entrant of second.field) {
      const html = renderToStaticMarkup(
        <DriverPage years={midSeason} driverId={entrant.driverId} />,
      );
      expect(disclosures(html)).toEqual({
        all: roster.drivers.get(entrant.driverId)?.length,
        open: 0,
      });
    }
  });

  it("draws the cars they raced, large and standing still, at most three, and none on a phone", () => {
    for (const entrant of second.field) {
      expectShowcase(
        renderToStaticMarkup(<DriverPage years={midSeason} driverId={entrant.driverId} />),
      );
    }
  });

  it("says a place in a year still being written is a place so far", () => {
    const driverId = twoYears?.driverId ?? "";
    const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={driverId} />);
    expect(html).toContain(`after round ${HALFWAY}`);
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

  it("gives the age in the year the run has reached, and their team as their last, off its grid", () => {
    // Two adjacent seasons where someone with a known birth year drops out —
    // searched for rather than named.
    for (const year of PLAYABLE_SEASONS.filter((each) => isPlayable(each + 1))) {
      const before = seededWorld(3, "aged", year);
      const after = seededWorld(4, "aged", year + 1);
      const gone = before.field.find(
        (entrant) =>
          !after.field.some((each) => each.driverId === entrant.driverId) &&
          driverBirthYear(entrant.driverId) !== undefined,
      );
      if (gone === undefined) {
        continue;
      }
      const years = revealed({
        kind: "era",
        run: { startYear: year, seasons: [before] },
        world: after,
        cursor: { kind: "grid" },
      }).years;
      const born = driverBirthYear(gone.driverId) ?? 0;
      const html = renderToStaticMarkup(<DriverPage years={years} driverId={gone.driverId} />);
      expect(html).toContain(`${year + 1 - born} years old in ${year + 1}`);
      expect(html).toContain("last with");
      // Someone still on the grid is simply with their team.
      const stayed = after.field[0]?.driverId ?? "";
      expect(renderToStaticMarkup(<DriverPage years={years} driverId={stayed} />)).not.toContain(
        "last with",
      );
      return;
    }
    throw new Error("No season loses a driver with a known birth year");
  });

  it("rates them by their best year of the run, and says which", () => {
    for (const entrant of second.field) {
      const best = bestOverall(midSeason, entrant.driverId);
      const html = renderToStaticMarkup(
        <DriverPage years={midSeason} driverId={entrant.driverId} />,
      );
      expect(html, entrant.driverId).toContain(
        `rated ${best?.overall} at their peak, in ${best?.year}`,
      );
    }
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

describe("the title trophy on a page's heading", () => {
  // A year in progress crowns nobody, so only the first year's champions have one.
  const records = careerRecords(midSeason);
  /** The trophy's tooltip in a page's `<h1>`, or null where it has none. */
  const headingTrophy = (html: string): string | null =>
    /<h1[^>]*>.*?role="img" aria-label="([^"]+)".*?<\/h1>/
      .exec(html)?.[1]
      ?.replaceAll("&#x27;", "'") ?? null;

  it("counts a driver's titles of the run, and draws nothing for none", () => {
    for (const record of records.drivers) {
      const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={record.id} />);
      expect(headingTrophy(html), record.id).toBe(
        record.titles === 0 ? null : titlesLabel(record.titles, "driver"),
      );
    }
  });

  it("counts a team's constructors' titles of the run, and draws nothing for none", () => {
    for (const record of records.teams) {
      const html = renderToStaticMarkup(<TeamPage years={midSeason} teamId={record.id} />);
      expect(headingTrophy(html), record.id).toBe(
        record.titles === 0 ? null : titlesLabel(record.titles, "team"),
      );
    }
  });

  it("is a count from the second title, and says which championship", () => {
    expect(renderToStaticMarkup(<TitleCount titles={0} kind="driver" />)).toBe("");
    const one = renderToStaticMarkup(<TitleCount titles={1} kind="driver" />);
    expect(one).toContain("1 drivers&#x27; title");
    expect(one).not.toContain("×");
    const three = renderToStaticMarkup(<TitleCount titles={3} kind="team" />);
    expect(three).toContain("3 constructors&#x27; titles");
    expect(three).toContain("×3");
    // Drawn by the stylesheet: a flag is the only `<svg>` beside a name.
    expect(three).not.toContain("<svg");
  });
});

describe("a team's page", () => {
  it("draws a row per year on the grid, every one shut", () => {
    const roster = rosterOf(midSeason);
    for (const teamId of new Set(second.field.map((entrant) => entrant.teamId))) {
      const html = renderToStaticMarkup(<TeamPage years={midSeason} teamId={teamId} />);
      expect(disclosures(html)).toEqual({ all: roster.teams.get(teamId)?.length, open: 0 });
    }
  });

  it("draws its cars large and standing still, at most three, and none on a phone", () => {
    for (const teamId of new Set(second.field.map((entrant) => entrant.teamId))) {
      expectShowcase(renderToStaticMarkup(<TeamPage years={midSeason} teamId={teamId} />));
    }
  });

  it("draws a livery stripe per season of its life, up to the run's year and no further", () => {
    const roster = rosterOf(midSeason);
    for (const teamId of new Set([...first.field, ...second.field].map(({ teamId }) => teamId))) {
      const html = renderToStaticMarkup(<TeamPage years={midSeason} teamId={teamId} />);
      const start = seasonsBefore(teamId, YEAR)[0] ?? roster.teams.get(teamId)?.[0]?.year;
      expectBarcode(html, start ?? second.year);
    }
  });
});

/**
 * A strip from `start` to the run's year, the caret on that year whether the
 * page's own latest season is it or not, and every year sat out a chequer.
 */
function expectBarcode(html: string, start: number): Stripe[] {
  const now = second.year;
  const stripes = [
    ...html.matchAll(
      /data-year="(\d+)" title="\d+(?: \(([^)]+)\)|(, not racing))?" class="([^"]*)"/g,
    ),
  ].map(([, year, name, gap, classes]) => ({
    year: Number(year),
    name,
    gap: gap !== undefined,
    chequer: classes?.includes("barcode-gap") ?? false,
  }));
  expect(stripes.map(({ year }) => year)).toEqual(
    Array.from({ length: now - start + 1 }, (_, i) => start + i),
  );
  for (const { gap, chequer } of stripes) {
    expect(chequer).toBe(gap);
  }
  expect(html.match(/data-year="(\d+)"[^>]*>(?:(?!<\/span>).)*data-caret/)?.[1]).toBe(String(now));
  expect(html.split("data-caret").length - 1).toBe(1);
  return stripes;
}

interface Stripe {
  readonly year: number;
  readonly name: string | undefined;
  readonly gap: boolean;
}

describe("a driver's barcode", () => {
  it("runs from their first season to the run's year, naming the team on every one raced", () => {
    const roster = rosterOf(midSeason);
    for (const { driverId } of [...first.field, ...second.field]) {
      const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={driverId} />);
      const start =
        [...driverSeasonsBefore(driverId, YEAR).keys()][0] ??
        roster.drivers.get(driverId)?.[0]?.year;
      const stripes = expectBarcode(html, start ?? second.year);
      for (const { name, gap } of stripes) {
        expect(gap || name !== undefined).toBe(true);
      }
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

  it("are headed by their one h1", async () => {
    const html = await inRouter(
      <RosterIndex
        kind="drivers"
        years={midSeason}
        sort="name"
        linkFor={driversLink}
        pageOf={PAGE_OF}
      />,
    );
    expect(html.split("<h1").length - 1).toBe(1);
    expect(textOf(html.slice(html.indexOf("<h1"), html.indexOf("</h1>")))).toBe("Drivers");
  });

  it("keep the name, wins, points and the sorted column on a phone", async () => {
    for (const sort of ["name", "seasons", "poles"] as const) {
      const html = await inRouter(
        <RosterIndex
          kind="drivers"
          years={midSeason}
          sort={sort}
          linkFor={driversLink}
          pageOf={PAGE_OF}
        />,
      );
      const kept = new Set(["Driver", "Wins", "Pts"]);
      if (sort === "seasons") kept.add("Seasons");
      if (sort === "poles") kept.add("Poles");
      for (const [label, hidden] of phoneHeadings(html)) {
        expect(hidden, `${sort}: ${label}`).toBe(!kept.has(label));
      }
    }
  });
});

describe("a person's page on a phone", () => {
  it("keeps points and wins, as a standings row does", () => {
    const entrant = twoYears ?? second.field[0];
    if (entrant === undefined) {
      throw new Error("no driver on the grid");
    }
    const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={entrant.driverId} />);
    const hidden = new Map(phoneHeadings(html));
    expect([...hidden].filter(([, off]) => off).map(([label]) => label)).toEqual([
      "Podiums",
      "Poles",
    ]);
    // Every body cell under a hidden heading goes with it: two per year raced.
    expect(html.split("hidden sm:table-cell").length - 1).toBeGreaterThan(2);
  });

  it("is headed by the name, in its one h1", () => {
    const entrant = second.field[0];
    if (entrant === undefined) {
      throw new Error("no driver on the grid");
    }
    const html = renderToStaticMarkup(<DriverPage years={midSeason} driverId={entrant.driverId} />);
    expect(html.split("<h1").length - 1).toBe(1);
    // Through a render, so a name with an apostrophe is escaped as the page's
    // is; the end of the text, since the flag's own title comes first.
    const name = textOf(renderToStaticMarkup(<span>{driverName(entrant.driverId)}</span>));
    const heading = textOf(html.slice(html.indexOf("<h1"), html.indexOf("</h1>")));
    expect(heading.slice(-name.length)).toBe(name);
  });
});
