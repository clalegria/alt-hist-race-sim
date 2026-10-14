/**
 * Component-level rendering checks.
 *
 * The expanded race classification cannot be reached from `App` in a static
 * render — opening it is a click, and there is no DOM here — so it is rendered
 * directly instead. Same for the grid, which is worth checking on its own
 * because it is the only place raw ratings are shown.
 */

import { driversById } from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  type RaceEntryResult,
} from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverName, entryName, nameParts, teamName } from "../lib/names.js";
import { ratedAge } from "../lib/people.js";
import { carOverall, driverOverall } from "../lib/rating.js";
import { driverRounds, teamRounds } from "../lib/results.js";
import { positionsOf } from "../lib/standings.js";
import type { World } from "../store/season.js";
import {
  findWorld,
  OVERSUBSCRIBED_YEAR,
  SEED,
  seededWorld,
  starterCount,
  teamCount,
  textOf,
  YEAR,
} from "../test-support.js";

import { CompactStandings } from "./CompactStandings.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceByRace } from "./RaceByRace.js";
import { RaceClassification } from "./RaceClassification.js";
import { NAME_TARGET, SeasonGrid } from "./SeasonGrid.js";
import { StandingsTable } from "./StandingsTable.js";

const world = seededWorld();
/** Counted off the grid rather than written down — it is going to grow. */
const SEATS = world.field.length;
const TEAMS = teamCount(world);
const STARTERS = starterCount(world);

/** How many times a string appears. No regex: some of these contain slashes. */
function occurrencesOf(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

/** A finishing result row, for the car counts the seed data does not contain. */
function syntheticEntry(driverId: string, gridPosition: number): RaceEntryResult {
  return {
    driverId,
    teamId: "team",
    gridPosition,
    started: true,
    finishPosition: gridPosition,
    retired: false,
    dnfCause: null,
    mechanicalFailure: false,
    driverError: false,
    qualifyingScore: 0,
    raceScore: 0,
    qualifyingGapToPole: 0,
    raceGapToWinner: null,
  };
}

describe("the race classification", () => {
  // Searched rather than pinned: this block checks that every scoring place is
  // paid and the first place outside them is not, so it needs an opening round
  // that classified more cars than the era's scale pays. Not every seed does —
  // wet rounds and a small early field can leave fewer finishers than places —
  // and which ones do is exactly the kind of fact `CLAUDE.md` forbids pinning.
  const classification = findWorld((candidate) => {
    const opener = candidate.season.races[0];
    return (
      opener !== undefined &&
      opener.entries.filter((entry) => entry.finishPosition !== null).length >
        candidate.points.length
    );
  });
  const race = classification.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }
  const html = renderToStaticMarkup(
    <RaceClassification race={race} points={classification.points} />,
  );

  it("lets the prose columns wrap, so a long name cannot force a scrollbar", () => {
    // The sheet shares its row with the championship sidebar, so it has about
    // two thirds of the page. Every column being `whitespace-nowrap` meant one
    // long engine name or one long driver pushed the whole table into a
    // horizontal scrollbar. The rule: the two prose columns wrap, the numeric
    // ones must not — a gap or a points total broken across lines is unreadable.
    const body = html.slice(html.indexOf("<tbody"));
    const cells = body
      .slice(0, body.indexOf("</tr>"))
      .split("<td")
      .slice(1)
      .map((cell) => cell.slice(0, cell.indexOf(">")));
    expect(cells.filter((cell) => cell.includes("whitespace-normal"))).toHaveLength(2);
    // Not just "two of them wrap": the ones that wrap are the ones with words
    // in, and every other column still refuses to.
    expect(cells.filter((cell) => cell.includes("tabular-nums")).length).toBeGreaterThan(0);
    for (const cell of cells.filter((cell) => cell.includes("tabular-nums"))) {
      expect(cell).toContain("whitespace-nowrap");
    }
  });

  it("draws its cells tighter than the default table padding", () => {
    // Applied per cell rather than by out-specifying the default from the
    // table, so `twMerge` resolves it and the winner is visible in the markup.
    expect(html).not.toContain("px-3");
    expect(html).toContain("px-2");
  });

  it("lists every car that entered, not just the finishers", () => {
    expect(race.entries).toHaveLength(SEATS);
    for (const entry of race.entries) {
      expect(textOf(html), `missing ${entry.driverId}`).toContain(driverName(entry.driverId));
    }
    // And one row each, so nobody is listed twice.
    expect(html.split("<tr").length - 1).toBe(SEATS + 1); // every car plus the header
  });

  it("shows what each finish was worth, and leaves the rest blank", () => {
    const rows = html.split("<tr").slice(1);
    const rowFor = (driverId: string): string => {
      const row = rows.find((candidate) => textOf(candidate).includes(driverName(driverId)));
      if (row === undefined) {
        throw new Error(`no row rendered for ${driverId}`);
      }
      return row;
    };
    const classified = [...race.entries]
      .filter((entry) => entry.finishPosition !== null)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

    // Each scoring place shows its own total, on whatever scale the era pays.
    const scale = classification.points;
    for (const [index, points] of scale.entries()) {
      const entry = classified[index];
      if (entry === undefined) {
        throw new Error("fewer finishers than scoring places in the seeded race");
      }
      expect(rowFor(entry.driverId), `P${index + 1}`).toContain(`>${points}<`);
    }
    // The first place outside the points scored nothing, and a column of zeroes
    // helps nobody.
    const unrewarded = classified[scale.length];
    if (unrewarded === undefined) {
      throw new Error("every finisher scored in the seeded race");
    }
    expect(rowFor(unrewarded.driverId)).not.toMatch(/>\d+<\/td><\/tr>/);
    expect(html).toContain(">Pts<");
  });

  it("gives no points to a car that did not finish", () => {
    const rows = html.split("<tr").slice(1);
    for (const entry of race.entries) {
      if (entry.finishPosition !== null) {
        continue;
      }
      const row = rows.find((candidate) => textOf(candidate).includes(driverName(entry.driverId)));
      expect(row, `no row for ${entry.driverId}`).toBeDefined();
      expect(row ?? "", `${entry.driverId} was awarded points`).not.toMatch(
        />[1-9]\d*<\/td>\s*<\/tr>/,
      );
    }
  });

  it("marks the winner and shows gaps for the rest", () => {
    expect(html).toContain("winner");
    expect(html).toMatch(/\+\d+\.\d{3}s/);
  });

  it("distinguishes retirements from non-qualifiers", () => {
    // Both outcomes have to be on screen at once, so the race is chosen for
    // having both rather than assumed to.
    const both = findWorld(
      (candidate) =>
        candidate.season.races.some(
          (round) =>
            round.entries.some((entry) => entry.retired) &&
            round.entries.some((entry) => !entry.started),
        ),
      // Only a year that enters more cars than the grid holds has a DNQ at all.
      { year: OVERSUBSCRIBED_YEAR },
    );
    const round = both.season.races.find(
      (candidate) =>
        candidate.entries.some((entry) => entry.retired) &&
        candidate.entries.some((entry) => !entry.started),
    );
    if (round === undefined) {
      throw new Error("no race had both a retirement and a non-qualifier");
    }
    const mixed = renderToStaticMarkup(<RaceClassification race={round} points={world.points} />);
    expect(mixed).toContain("Retired");
    expect(mixed).toContain("Did not qualify");
    // And in the gap column's short words, which are all a phone shows of them.
    expect(mixed).toContain(">DNF<");
    expect(mixed).toContain(">DNQ<");
  });

  it("keeps position, name, gap and points on a phone, and drops grid and status", () => {
    // The header's cells in order, each tagged with whether it hides below `md`.
    // From the header row, not `<thead`, which `<th` would also match.
    const head = html.slice(html.indexOf("<tr"), html.indexOf("</thead>"));
    const columns = head
      .split("<th")
      .slice(1)
      .map((cell) => ({
        name: textOf(`<th${cell}`),
        wideOnly: cell.slice(0, cell.indexOf(">")).includes("hidden md:table-cell"),
      }));
    const shown = columns.filter((column) => !column.wideOnly).map((column) => column.name);
    expect(shown).toEqual(["Pos", "Driver", "Gap", "Pts"]);
    expect(columns.filter((column) => column.wideOnly).map((column) => column.name)).toEqual([
      "Grid",
      "Status",
    ]);
  });

  it("gives a stopped car's short word the loss colour, and only on a phone", () => {
    const stopped = race.entries.filter((entry) => entry.finishPosition === null);
    expect(stopped.length).toBeGreaterThan(0);
    expect(occurrencesOf(html, '<span class="text-loss md:hidden">')).toBe(stopped.length);
  });

  it("never prints a gap on a row that did not finish", () => {
    // A retirement is not "n seconds behind" — it stopped. Asserting on the
    // rendered row rather than on the data, because the data is the engine's
    // business and it is this component that could still print a lie.
    const rows = html.split("<tr").slice(1);
    const rowFor = (driverId: string): string => {
      const name = driverName(driverId);
      const row = rows.find((candidate) => textOf(candidate).includes(name));
      if (row === undefined) {
        throw new Error(`no row rendered for ${driverId}`);
      }
      return row;
    };

    let checked = 0;
    for (const entry of race.entries) {
      if (entry.finishPosition !== null) {
        continue;
      }
      const row = rowFor(entry.driverId);
      expect(row, `${entry.driverId} was given a gap`).not.toMatch(/\+\d/);
      expect(row).toContain("—");
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the season grid", () => {
  const html = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={world.ratingMode} />,
  );

  it("groups every driver under their team", () => {
    for (const entrant of world.field) {
      const card = html.slice(html.indexOf(`>${entryName(entrant.teamId, entrant.engineId)}<`));
      expect(card.slice(0, card.indexOf("</li></ul></li>")), entrant.driverId).toContain(
        driverName(entrant.driverId),
      );
    }
  });

  it("marks a clickable name with a fill rather than an underline", () => {
    // The mark used to be a dotted underline, and forty-odd of them turned the
    // page into ruled paper. Both halves matter: that the old mark is gone, and
    // that every name still carries the affordance — a name that silently opens
    // a panel is worse than one that is over-decorated.
    expect(html).not.toContain("underline");
    // The whole shared string, not one class off it: `cn` keeps what it is
    // handed in order, so anything that reached for its own hover state instead
    // of `NAME_TARGET` fails to match here.
    expect(occurrencesOf(html, NAME_TARGET)).toBe(SEATS + TEAMS);
  });

  it("draws a flag for every driver and every team", () => {
    // One inline SVG per driver and one per team.
    expect(html.split("<svg").length - 1).toBe(SEATS + TEAMS);
  });

  it("shows each driver's age beside their name, not next to their rating", () => {
    // "Alan Jones (34y)  89" reads; "Alan Jones  34 89" reads as two ratings.
    // The age is the one the ratings on the row describe — `ratedAge` — rather
    // than the loaded year minus a birth year, because those are two different
    // numbers in peak mode and only one of them belongs beside those ratings.
    const drivers = driversById();
    for (const entrant of world.field) {
      const record = drivers.get(entrant.driverId);
      if (record === undefined) {
        throw new Error(`no record for ${entrant.driverId}`);
      }
      expect(html, entrant.driverId).toContain(`(${ratedAge(record, YEAR, world.ratingMode)}y)`);
    }
  });

  it("shows an overall for every driver and every car", () => {
    // One per driver, one per team: the number you can scan the grid by.
    for (const entrant of world.field) {
      expect(html, entrant.driverId).toContain(`>${driverOverall(entrant.driver)}<`);
      // Engine included: the headline number is the car that gets raced.
      expect(html, entrant.teamId).toContain(`>${carOverall(entrant.chassis, entrant.engine)}<`);
    }
  });

  it("keeps the individual ratings out of sight until a name is selected", () => {
    // The point of the reveal: the opening page shows one number per driver, not
    // the breakdown. Popover contents are not rendered while closed.
    expect(html).not.toContain("Reliability");
    expect(html).not.toContain("Adaptability");
    expect(html).not.toContain("Composure");
    // A car's development trend lives in the same panel, and stays behind it.
    expect(html).not.toContain("In-season development");
  });

  it("leaves a car's development trend out of its overall", () => {
    // The headline number says how good a car is; a trend rotates its pace
    // about mid-season and so says nothing about the average of the year.
    // Rendering the same grid with a trend on every car must change nothing at
    // all — same overalls, same order, same page.
    const trended = world.field.map((entrant) => ({ ...entrant, developmentTrend: 9 }));
    expect(
      renderToStaticMarkup(
        <SeasonGrid field={trended} seasonYear={YEAR} ratingMode={world.ratingMode} />,
      ),
    ).toBe(html);
  });

  it("orders teams alphabetically, not by pace", () => {
    // Sorting by car rating would give the season away before it started.
    // Located by the entry name the card carries, ordered by the team name it
    // is sorted on: a team does not move down the page for changing engine.
    const teamIds = [...new Set(world.field.map((entrant) => entrant.teamId))];
    const shown = new Map(
      world.field.map((entrant) => [entrant.teamId, entryName(entrant.teamId, entrant.engineId)]),
    );
    const at = (teamId: string) => html.indexOf(`>${shown.get(teamId) ?? ""}<`);
    const drawn = [...teamIds].sort((a, b) => at(a) - at(b));
    expect(drawn).toEqual([...teamIds].sort((a, b) => teamName(a).localeCompare(teamName(b))));
  });
});

describe("the compact standings", () => {
  // A season with more than eight teams, since a table that already fits is
  // deliberately not expandable and the fixture year fields exactly eight.
  const crowded = seededWorld(3, undefined, OVERSUBSCRIBED_YEAR);
  const CROWDED_TEAMS = teamCount(crowded);
  const drivers = championshipStandings(world.season, world.points);
  const teams = constructorStandings(crowded.season, crowded.points);
  const driverHtml = renderToStaticMarkup(<CompactStandings title="Drivers" standings={drivers} />);
  const teamHtml = renderToStaticMarkup(
    <CompactStandings title="Constructors" standings={teams} />,
  );

  it("shows only the top eight until it is expanded", () => {
    expect(drivers.length).toBe(SEATS);
    expect(teams.length).toBe(CROWDED_TEAMS);
    // One row each, and one flag per row, so counting flags counts rows.
    expect((driverHtml.match(/<svg/g) ?? []).length).toBe(8);
    expect((teamHtml.match(/<svg/g) ?? []).length).toBe(8);
    // The ninth-placed driver is out of sight.
    const ninth = drivers[8];
    if (ninth === undefined) {
      throw new Error("expected more than eight drivers");
    }
    expect(textOf(driverHtml)).not.toContain(driverName(ninth.driverId));
  });

  /*
   * The sidebar sits beside a race result and cannot grow, so a long entry
   * name — "Lola-Coventry Climax", and the sixties are full of them — used to
   * widen the table until the card scrolled sideways. What is asserted is the
   * pair that stops it: a name cell capped with `max-w-0 w-full`, and names
   * inside it that end rather than push. Verified in a real browser at the
   * time; a DOM-less render can only hold the mechanism in place.
   */
  it("caps its name column so a long entry name cannot widen the table", () => {
    expect(driverHtml).toContain("max-w-0");
    expect(teamHtml).toContain("max-w-0");
    // Every name in the column carries its full text as a title, since an
    // ellipsis is all the row itself has room to say. One per rendered row —
    // the team's name in one table, the driver's team line in the other — and
    // an attribute, not the `<title>` a flag draws inside its `<svg>`.
    expect((teamHtml.match(/title="/g) ?? []).length).toBe(8);
    expect((driverHtml.match(/title="/g) ?? []).length).toBe(8);
  });

  it("offers a way to see the rest, naming how many there are", () => {
    expect(driverHtml).toContain(`Show all ${SEATS}`);
    expect(teamHtml).toContain(`Show all ${CROWDED_TEAMS}`);
    expect(driverHtml).toContain('aria-expanded="false"');
  });

  it("does not offer to expand a table that already fits", () => {
    const short = renderToStaticMarkup(
      <CompactStandings title="Drivers" standings={drivers.slice(0, 5)} />,
    );
    expect(short).not.toContain("Show all");
    expect((short.match(/<svg/g) ?? []).length).toBe(5);
  });

  it("marks who gained and who lost places since the previous round", () => {
    // Positions after round 1 against positions after round 2: anyone whose
    // number went down climbed, and must carry an up arrow.
    const afterOne = championshipStandings({ races: world.season.races.slice(0, 1) }, world.points);
    const afterTwo = championshipStandings({ races: world.season.races.slice(0, 2) }, world.points);
    const previous = positionsOf(afterOne);
    const moved = afterTwo
      .map((standing, index) => ({
        name: driverName(standing.driverId),
        places: (previous.get(standing.driverId) ?? 0) - (index + 1),
      }))
      .slice(0, 8);
    expect(
      moved.some((row) => row.places > 0),
      "nobody climbed between rounds",
    ).toBe(true);
    expect(
      moved.some((row) => row.places < 0),
      "nobody dropped between rounds",
    ).toBe(true);

    const withArrows = renderToStaticMarkup(
      <CompactStandings title="Drivers" standings={afterTwo} previousPositions={previous} />,
    );
    expect((withArrows.match(/▲/g) ?? []).length).toBe(
      moved.filter((row) => row.places > 0).length,
    );
    expect((withArrows.match(/▼/g) ?? []).length).toBe(
      moved.filter((row) => row.places < 0).length,
    );
    expect(withArrows).toContain("text-gain");
    expect(withArrows).toContain("text-loss");
  });

  it("shows no arrows at all when there is no previous round", () => {
    // Round one: everyone would otherwise read as having climbed from nowhere.
    expect(driverHtml).not.toContain("▲");
    expect(driverHtml).not.toContain("▼");
  });

  it("says which way and how far, not just colour", () => {
    // An arrow distinguished only by hue tells a colourblind reader nothing.
    const afterOne = championshipStandings({ races: world.season.races.slice(0, 1) }, world.points);
    const afterTwo = championshipStandings({ races: world.season.races.slice(0, 2) }, world.points);
    const html = renderToStaticMarkup(
      <CompactStandings
        title="Drivers"
        standings={afterTwo}
        previousPositions={positionsOf(afterOne)}
      />,
    );
    expect(html).toMatch(/title="(Up|Down) \d+ places?"/);
  });

  it("names each driver's team, and carries points but no other column", () => {
    for (const standing of drivers.slice(0, 8)) {
      expect(driverHtml, standing.teamId).toContain(teamName(standing.teamId));
    }
    for (const column of ["Wins", "Pods", "Poles"]) {
      expect(driverHtml, `${column} should not be here`).not.toContain(`>${column}<`);
    }
  });

  it("sets each surname in capitals by CSS, and the team line plain", () => {
    const capitals = inCapitals(driverHtml);
    for (const standing of drivers.slice(0, 8)) {
      // The source case, so the capitals can only have come from `uppercase`.
      expect(capitals, standing.driverId).toContain(
        asRendered(nameParts(driverName(standing.driverId)).surname),
      );
      expect(capitals, standing.driverId).not.toContain(asRendered(teamName(standing.teamId)));
    }
  });

  it("sets the constructors in capitals", () => {
    const capitals = inCapitals(teamHtml);
    for (const standing of teams.slice(0, 8)) {
      expect(capitals, standing.teamId).toContain(asRendered(teamName(standing.teamId)));
    }
  });
});

/** The text of every span set in capitals, as rendered. */
function inCapitals(html: string): string[] {
  return [...html.matchAll(/<span class="[^"]*\buppercase\b[^"]*"[^>]*>([^<]*)<\/span>/g)].map(
    (match) => match[1] ?? "",
  );
}

/** A name the way `renderToStaticMarkup` escapes it. */
function asRendered(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
}

describe("the starting grid layout", () => {
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }
  const html = renderToStaticMarkup(<QualifyingResults race={race} />);

  it("sets back the even slots, and only those", () => {
    // The offset rides an `even:` variant, so the class string is identical on
    // every slot and CSS decides which ones move. Two things are checkable from
    // the markup: that the variant is `even` and not `odd` — swapping them puts
    // pole on the back row — and that every slot on the grid carries it, so no
    // car was left out of the formation.
    expect(html).toContain("sm:even:translate-y-");
    expect(html).not.toContain("odd:translate-y-");

    const grid = html.slice(0, html.indexOf("Did not qualify"));
    const slots = grid.split("<li").slice(1);
    expect(slots).toHaveLength(STARTERS);
    for (const [index, slot] of slots.entries()) {
      expect(slot.includes("even:translate-y"), `slot ${index + 1} is not in formation`).toBe(true);
    }
  });

  it("does not stagger the cars that failed to qualify", () => {
    // They never form up, so a staggered pair there would be pure decoration.
    const dnq = html.slice(html.indexOf("Did not qualify"));
    expect(dnq).not.toContain("even:translate-y");
  });

  it("offsets by exactly half a row, so the cars are evenly spaced", () => {
    // The geometry invariant. Car N sits at (N-1) x step/2 down the page only
    // while the offset is half the row height; drift them apart and P2 ends up
    // nearer P1 than P3 is, which stops looking like a grid.
    const rowHeight = html.match(/auto-rows-\[([\d.]+)rem\]/)?.[1];
    const offset = html.match(/even:translate-y-\[([\d.]+)rem\]/)?.[1];
    expect(rowHeight, "row height class missing").toBeDefined();
    expect(offset, "offset class missing").toBeDefined();
    expect(Number(offset)).toBeCloseTo(Number(rowHeight) / 2, 5);
  });

  it("marks pole and shows everyone else's gap to it", () => {
    expect(html).toContain("pole");
    expect(html).toMatch(/\+\d+\.\d{3}s/);
  });

  it("names every car's team on the grid", () => {
    for (const entry of race.entries) {
      expect(html, entry.teamId).toContain(teamName(entry.teamId));
    }
  });
});

/**
 * The championship expansions.
 *
 * Opening one is a click and there is no DOM here, so the two halves are
 * checked separately: that every row of the table *offers* the expansion and
 * gives nothing away while closed, and that the panel itself draws what it
 * should when rendered directly.
 */
describe("expanding a row of the championship", () => {
  const drivers = championshipStandings(world.season, world.points);
  const teams = constructorStandings(world.season, world.points);
  const firstRound = SEED.calendar[0];
  if (firstRound === undefined) {
    throw new Error("the season has no calendar");
  }

  const closed = renderToStaticMarkup(
    <StandingsTable
      title="Drivers’ Championship"
      label="Final"
      nameColumn="Driver"
      standings={drivers}
      season={world.season}
      points={world.points}
      calendar={SEED.calendar}
    />,
  );

  it("offers every row, and opens none of them", () => {
    expect(occurrencesOf(closed, 'aria-expanded="false"')).toBe(drivers.length);
    expect(closed).not.toContain('aria-expanded="true"');
  });

  it("keeps position, name, points and wins on a phone, and drops podiums and poles", () => {
    // The header's cells in order, each tagged with whether it hides below `sm`.
    const head = closed.slice(closed.indexOf("<tr"), closed.indexOf("</thead>"));
    const columns = head
      .split("<th")
      .slice(1)
      .map((cell) => ({
        name: textOf(`<th${cell}`),
        wideOnly: cell.slice(0, cell.indexOf(">")).includes("hidden sm:table-cell"),
      }));
    expect(columns.filter((column) => !column.wideOnly).map((column) => column.name)).toEqual([
      "Pos",
      "Driver",
      "Pts",
      "Wins",
    ]);
    expect(columns.filter((column) => column.wideOnly).map((column) => column.name)).toEqual([
      "Pods",
      "Poles",
    ]);
    // And every row's cells with them, two to a row.
    expect(occurrencesOf(closed, "hidden sm:table-cell")).toBe(2 + 2 * drivers.length);
  });

  it("keeps the race-by-race out of the closed table", () => {
    // A summary that shipped every driver's fourteen rounds in the markup would
    // be the whole season rendered 28 times over.
    expect(closed).not.toContain(firstRound.name);
    expect(closed).not.toContain("Did not qualify");
  });

  it("says what a row's arrow does, on the arrow", () => {
    // The head band holds a short label, not a how-to: the chevron names itself.
    // Counted rather than matched by name, which the markup may escape.
    expect(closed.split(' race by race"').length - 1).toBe(drivers.length);
  });

  it("gives a driver one row per round, naming each one", () => {
    const someone = drivers[0]?.driverId ?? "";
    const html = renderToStaticMarkup(
      <RaceByRace
        rounds={driverRounds(world.season, world.points, someone)}
        calendar={SEED.calendar}
      />,
    );
    // Every round of the year, named, plus the header row.
    expect(html.split("<tr").length - 1).toBe(SEED.calendar.length + 1);
    for (const round of SEED.calendar) {
      expect(html, `missing ${round.name}`).toContain(round.name);
    }
  });

  it("gives a team a row per car, and names the round once", () => {
    const teamId = teams[0]?.teamId ?? "";
    const rounds = teamRounds(world.season, world.points, teamId);
    const html = renderToStaticMarkup(
      <RaceByRace rounds={rounds} calendar={SEED.calendar} showDriver={true} />,
    );
    expect(html.split("<tr").length - 1).toBe(rounds.length + 1);
    // Two cars in a round must not read as two separate races.
    expect(occurrencesOf(html, firstRound.name)).toBe(1);
    // And every one of the team's drivers is named, however many there are.
    for (const driverId of new Set(rounds.map((round) => round.entry.driverId))) {
      expect(textOf(html), driverId).toContain(driverName(driverId));
    }
  });

  it("draws a one-car and a three-car round the same way", () => {
    // Synthetic, because no authored season enters anything but two cars — and
    // the earlier eras this is being built for did both.
    const rounds = [
      { round: 0, entry: syntheticEntry("solo", 1), points: 0 },
      { round: 1, entry: syntheticEntry("one", 1), points: 0 },
      { round: 1, entry: syntheticEntry("two", 2), points: 0 },
      { round: 1, entry: syntheticEntry("three", 3), points: 0 },
    ];
    const html = renderToStaticMarkup(
      <RaceByRace rounds={rounds} calendar={SEED.calendar} showDriver={true} />,
    );
    expect(html.split("<tr").length - 1).toBe(rounds.length + 1);
    // Round 2 is written once for its three cars, round 1 once for its one.
    const second = SEED.calendar[1];
    if (second === undefined) {
      throw new Error("the season has only one round");
    }
    expect(occurrencesOf(html, firstRound.name)).toBe(1);
    expect(occurrencesOf(html, second.name)).toBe(1);
  });

  it("names a status only when something went wrong", () => {
    // A season is mostly finishes, and "Finished" fourteen times down the page
    // says nothing the position column has not already said. The rounds that
    // got away are the whole reason to open the panel.
    const bothOutcomes = (of: World): string | undefined =>
      of.field.find((entrant) => {
        const rounds = driverRounds(of.season, of.points, entrant.driverId);
        return (
          rounds.some((round) => round.entry.finishPosition !== null) &&
          rounds.some((round) => round.entry.retired)
        );
      })?.driverId;

    // Searched for rather than assumed: a driver who finished everything would
    // pass the first assertion for the wrong reason.
    const mixed = findWorld((candidate) => bothOutcomes(candidate) !== undefined);
    const rounds = driverRounds(mixed.season, mixed.points, bothOutcomes(mixed) ?? "");
    const html = renderToStaticMarkup(<RaceByRace rounds={rounds} calendar={SEED.calendar} />);

    expect(html).not.toContain("Finished");
    // One line per round that ended badly, and no more than that.
    expect(occurrencesOf(html, "Retired")).toBe(
      rounds.filter((round) => round.entry.retired).length,
    );
    expect(occurrencesOf(html, "Did not qualify")).toBe(
      rounds.filter((round) => !round.entry.started).length,
    );
  });

  it("has nothing to draw for a competitor who entered no rounds", () => {
    const html = renderToStaticMarkup(<RaceByRace rounds={[]} calendar={SEED.calendar} />);
    expect(html).toContain("Entered no rounds");
  });
});
