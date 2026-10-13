/**
 * Picking the grid.
 *
 * Rendered statically, like everything else here, so what these can reach is
 * the markup each state produces — not the clicks that move between them. The
 * two halves are covered where they live: the swap rules are unit-tested in
 * `@alt-hist/data`, and where an applied lineup ends up is tested in the store.
 */

import {
  authoredLineup,
  type Driver,
  driverAt,
  driversById,
  emptySeats,
  filledLineup,
  type GridPick,
  type LineupDraft,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { driverName, entryName, teamName } from "../lib/names.js";
import {
  AGE_RANGE,
  DEFAULT_DRIVER_FILTERS,
  type DriverFilters,
  matchesFilters,
  ratedAge,
} from "../lib/people.js";
import { carOverall, driverOverall } from "../lib/rating.js";
import { DEFAULT_SORT_ORDER, type SortOrder } from "../lib/sort.js";
import { resetSortOrder, setSortOrder } from "../lib/sort-preference.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { GridStage } from "./GridStage.js";
import { changeCount, EditedGridBanner, GridChanges } from "./LineupChanges.js";
import { ReserveList } from "./ReserveList.js";
import { byTeam, SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";
import { pickUp, previewField } from "./useGridDraft.js";

const authored = authoredLineup(SEED);

/**
 * The mode every fixture here is built and drawn in.
 *
 * Named rather than repeated as a literal because it is load-bearing: the ages
 * the grid prints and the ages the filters read are both `ratedAge` under this
 * mode, and a test that renders in one mode and expects the other passes or
 * fails for the wrong reason.
 */
const MODE: RatingMode = "peak";

/**
 * A seated driver and one without a drive, picked out of the data rather than
 * named: the driver market adds privateer entries, which promotes some of today's
 * reserves. See the testing rule in `CLAUDE.md`.
 */
const FIRST_ENTRY = SEED.entries[0];
const SECOND_ENTRY = SEED.entries[1];
const SEATED = FIRST_ENTRY?.drivers[0] ?? "";
const TEAM_MATE = FIRST_ENTRY?.drivers[1] ?? "";
const ELSEWHERE = SECOND_ENTRY?.drivers[0] ?? "";
// Reserves the widest filters would actually draw: the pool spans every
// authored season, so plenty of it is unborn in the fixture year and never
// reaches the list.
const [FREE, ALSO_FREE] = reserveDrivers(authored).filter((driver) => {
  const age = ratedAge(driver, YEAR, MODE);
  return age >= AGE_RANGE.min && age <= AGE_RANGE.max;
});
if (FIRST_ENTRY === undefined || FREE === undefined || ALSO_FREE === undefined) {
  throw new Error("the season needs an entry list and two drivers without a seat");
}
const RESERVE = FREE.id;
const SEATED_TEAM = FIRST_ENTRY.teamId;
const OTHER_TEAM = SECOND_ENTRY?.teamId ?? "";

/** A driver, as the editor holds one. The other kind of pick is a seat. */
const held = (driverId: string): GridPick => ({ kind: "driver", driverId });
/** How that team is named on the grid now that the engine is part of it. */
const ENTRY_NAME = entryName(SEATED_TEAM, FIRST_ENTRY.engineId);

/** One swap: the reserve takes the first seat on the entry list. */
const edited = swapDrivers(authored, SEATED, RESERVE);
const changes = lineupChanges(SEED, edited);
const world = seededWorld();
const editedWorld = createWorld(3, YEAR, MODE, edited);
const SEATS = world.field.length;
const SPARE = reserveDrivers(authored).length;
const swapLine = `${driverName(RESERVE)} for ${driverName(SEATED)}`;

/**
 * The widest the filters go, for the tests that are not about filtering.
 *
 * Widest is not "everybody": the age band bottoms out at `AGE_RANGE.min`, and
 * the pool now spans enough seasons that a driver can be younger than that in
 * the year on screen — a 1990 debutant is a child in 1980. Tests that need the
 * set actually on screen derive it rather than assuming the whole pool.
 */
const SHOW_ALL: DriverFilters = {
  hideRetired: false,
  hideFuture: false,
  minAge: AGE_RANGE.min,
  maxAge: AGE_RANGE.max,
};

/**
 * A name as it appears in the markup.
 *
 * React escapes apostrophes, and the pool is full of them — d'Ambrosio, De
 * Angelis's team-mates, every `L'` and `d'` in seventy-six seasons. Matching the
 * raw name looks fine right up until a filter widens far enough to draw one of
 * them, and a *negative* assertion on a raw name never matches at all, which is
 * the worse failure: it passes whatever the component does.
 */
const escaped = (name: string) => name.replace(/'/g, "&#x27;");

/** How many times a class string appears. No regex: these contain slashes. */
function occurrences(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

describe("the grid before it is edited", () => {
  const html = renderToStaticMarkup(
    <GridStage field={world.field} year={YEAR} ratingMode={MODE} lineup={null} engines={null} />,
  );

  it("offers a way in", () => {
    expect(html).toContain("Edit grid");
  });

  it("says nothing about swapping until the reader asks", () => {
    // The opening page is a grid to read, not a form to fill in.
    expect(html).not.toContain("Without a drive");
    expect(html).not.toContain("Apply grid");
    expect(html).not.toContain("Cancel");
  });

  it("claims no changes were made", () => {
    expect(html).not.toContain("This grid was edited");
    expect(occurrences(html, SWAPPED_IN)).toBe(0);
  });

  it("keeps the ratings behind their popovers, as it always did", () => {
    expect(html).not.toContain("Adaptability");
  });
});

describe("the grid once a lineup is applied", () => {
  const html = renderToStaticMarkup(
    <GridStage
      field={editedWorld.field}
      year={YEAR}
      ratingMode={MODE}
      lineup={edited}
      engines={null}
    />,
  );

  it("seats the swapped-in driver at their new team", () => {
    const card = html.slice(html.indexOf(`>${ENTRY_NAME}<`));
    expect(card.slice(0, card.indexOf("</li></ul></li>"))).toContain(escaped(driverName(RESERVE)));
  });

  it("leaves the driver who lost the seat off the grid entirely", () => {
    // Named in the note above the cards, but in nobody's car: matching the
    // wrapped name rather than the bare string keeps the two apart.
    expect(html).not.toContain(`>${escaped(driverName(SEATED))}<`);
    expect(html).toContain(`for ${escaped(driverName(SEATED))}`);
  });

  it("says what was changed, and marks who is new", () => {
    expect(html).toContain("This grid was edited");
    expect(html).toContain(swapLine);
    // One driver arrived, so exactly one row carries the mark.
    expect(occurrences(html, SWAPPED_IN)).toBe(1);
  });

  it("still offers the editor rather than locking the grid in", () => {
    expect(html).toContain("Edit grid");
  });
});

describe("the grid in edit mode", () => {
  const editing = {
    selected: { kind: "driver", driverId: SEATED } as const,
    onSelect: () => {},
    engineIds: SEED.engines.map((engine) => engine.engineId),
    onEngineChange: () => {},
    onChassisStep: () => {},
    onEngineStep: () => {},
  };
  const html = renderToStaticMarkup(
    <SeasonGrid
      field={world.field}
      seasonYear={YEAR}
      ratingMode={MODE}
      edit={editing}
      changes={[]}
    />,
  );

  it("says how to make a change", () => {
    expect(html).toContain("then who takes their seat");
  });

  it("turns every driver into something to select, and marks the one picked up", () => {
    // Every seat is a pressable button; exactly one of them is held.
    expect(occurrences(html, "aria-pressed")).toBe(SEATS);
    expect(occurrences(html, 'aria-pressed="true"')).toBe(1);
    const pressed = html.slice(html.indexOf('aria-pressed="true"'));
    expect(pressed.slice(0, pressed.indexOf("</button>"))).toContain(escaped(driverName(SEATED)));
  });

  it("still shows the age and overall the reader is choosing on", () => {
    const record = driversById().get(TEAM_MATE === "" ? SEATED : TEAM_MATE);
    expect(record).toBeDefined();
    expect(html).toContain(escaped(record?.name ?? ""));
    expect(html).toContain(`(${record === undefined ? "" : ratedAge(record, YEAR, MODE)}y)`);
  });
});

describe("the drivers without a drive", () => {
  const reserve = reserveDrivers(authored);
  const html = renderToStaticMarkup(
    <ReserveList
      drivers={reserve}
      seasonYear={YEAR}
      ratingMode={MODE}
      selectedDriverId={null}
      onSelect={() => {}}
      filters={SHOW_ALL}
    />,
  );

  it("lists everyone in the pool without a seat, and nobody with one", () => {
    // Everyone the widest filters allow: someone too young for the year on
    // screen is out of the band, and out of the band is out of the list.
    const shown = reserve.filter((driver) => matchesFilters(driver, YEAR, SHOW_ALL, MODE));
    expect(shown.length).toBeGreaterThan(0);
    expect(html).toContain(`${SPARE} drivers available`);
    for (const driver of shown) {
      expect(html, `missing ${driver.id}`).toContain(escaped(driver.name));
    }
    for (const driverId of seatedDriverIds(authored)) {
      expect(html, `${driverId} has a seat`).not.toContain(`>${escaped(driverName(driverId))}<`);
    }
  });

  it("shows the same age and overall the grid does, so the two compare", () => {
    const record = driversById().get(RESERVE);
    expect(record).toBeDefined();
    expect(html).toContain(escaped(record?.name ?? ""));
    expect(html).toContain(`(${record === undefined ? "" : ratedAge(record, YEAR, MODE)}y)`);
  });

  it("trades one for one as seats change hands", () => {
    const after = reserveDrivers(edited).map((driver) => driver.id);
    expect(after).toHaveLength(SPARE);
    expect(after).toContain(SEATED);
    expect(after).not.toContain(RESERVE);
  });
});

/**
 * Narrowing the pool.
 *
 * The rules themselves are unit-tested against synthetic careers in
 * `lib/people.test.ts`; what these cover is that the list is actually drawn
 * from the filtered set, and that it says how much it is hiding. Every expected
 * count is derived from the seed data rather than written down — the pool grows
 * every time a season is authored.
 */
describe("filtering the drivers without a drive", () => {
  const reserve = reserveDrivers(authored);

  const render = (filters: DriverFilters, options: { selected?: string } = {}) =>
    renderToStaticMarkup(
      <ReserveList
        drivers={reserve}
        seasonYear={YEAR}
        ratingMode={MODE}
        selectedDriverId={options.selected ?? null}
        onSelect={() => {}}
        filters={filters}
      />,
    );

  /** Who a set of filters is expected to leave, straight off the pool. */
  const survivors = (filters: DriverFilters) =>
    reserve.filter((driver) => matchesFilters(driver, YEAR, filters, MODE));

  /** Rendered names, so "hidden" means hidden rather than merely unmentioned. */
  const listed = (html: string, driver: Driver) => html.includes(`>${escaped(driver.name)}<`);

  /**
   * Ticked *filters*. Matched on the input itself rather than on a bare
   * `checked=""`, because the sort switch beside them is a radio and one of its
   * two options is always checked.
   */
  const ticked = (html: string) =>
    (html.match(/<input type="checkbox"[^>]*checked=""/g) ?? []).length;

  it("offers all three filters, and opens on the year as it was", () => {
    const html = render(DEFAULT_DRIVER_FILTERS);
    expect(html).toContain(`Retired before ${YEAR}`);
    expect(html).toContain(`Debuting after ${YEAR}`);
    // Both career filters on, so the list opens on the drivers who were around.
    expect(occurrences(html, 'type="checkbox"')).toBe(2);
    expect(ticked(html)).toBe(2);
    expect(html).toContain(`value="${DEFAULT_DRIVER_FILTERS.minAge}"`);
    expect(html).toContain(`value="${DEFAULT_DRIVER_FILTERS.maxAge}"`);
  });

  it("ticks the boxes it was handed, and only those", () => {
    expect(ticked(render(SHOW_ALL))).toBe(0);
    expect(ticked(render({ ...SHOW_ALL, hideRetired: true }))).toBe(1);
    expect(ticked(render({ ...SHOW_ALL, hideRetired: true, hideFuture: true }))).toBe(2);
  });

  it("draws the filtered list, not the whole pool", () => {
    const filters = DEFAULT_DRIVER_FILTERS;
    const left = survivors(filters);
    // The seed data has to contain someone each filter removes, or this passes
    // by having nothing to do.
    expect(left.length).toBeLessThan(reserve.length);
    expect(left.length).toBeGreaterThan(0);

    const html = render(filters);
    for (const driver of reserve) {
      expect(listed(html, driver), driver.id).toBe(left.includes(driver));
    }
  });

  it("says how many it is hiding, rather than quietly shrinking", () => {
    const filters = DEFAULT_DRIVER_FILTERS;
    const left = survivors(filters);
    expect(left.length).toBeLessThan(reserve.length);
    expect(render(filters)).toContain(`${left.length} of ${reserve.length} drivers available`);
  });

  it("says nothing of the sort when it is hiding nobody", () => {
    // Handed only the drivers the filters already allow, so nothing is hidden.
    // No filter set can do this on the whole pool: the age band cannot reach
    // below `AGE_RANGE.min`, and the pool has drivers younger than that.
    const shown = survivors(SHOW_ALL);
    const html = renderToStaticMarkup(
      <ReserveList
        drivers={shown}
        seasonYear={YEAR}
        ratingMode={MODE}
        selectedDriverId={null}
        onSelect={() => {}}
        filters={SHOW_ALL}
      />,
    );
    expect(html).toContain(`${shown.length} drivers available`);
    expect(html).not.toContain(`of ${shown.length} drivers available`);
  });

  it("holds the age range against the season on screen", () => {
    const oldest = Math.max(...reserve.map((driver) => ratedAge(driver, YEAR, MODE)));
    const filters = { ...SHOW_ALL, maxAge: oldest - 1 };
    const html = render(filters);
    const left = new Set(survivors(filters).map((driver) => driver.id));
    for (const driver of reserve) {
      const age = ratedAge(driver, YEAR, MODE);
      // Both ends of the band bite: the oldest are out by the cap just set,
      // and anyone below `AGE_RANGE.min` in this year was never in it.
      expect(listed(html, driver), `${driver.id} aged ${age}`).toBe(left.has(driver.id));
    }
    expect(left.size).toBeLessThan(reserve.length);
    expect(left.size).toBeGreaterThan(0);
  });

  it("narrows a driver dropped from the grid like anyone else in the pool", () => {
    // Losing a seat is not an exemption. A driver the season entered joins the
    // pool on the same terms as the rest of it, so the filters bite on them and
    // the counts describe a list that has nothing hidden inside it.
    const pool = reserveDrivers(edited);
    const dropped = pool.find((driver) => driver.id === SEATED);
    expect(dropped, "the swap should have freed the seated driver").toBeDefined();

    // An age band nobody is in, so what is asserted is the filter biting rather
    // than one that happened to let this driver through.
    const filters = { hideRetired: false, hideFuture: false, minAge: 16, maxAge: 16 };
    expect(matchesFilters(dropped as Driver, YEAR, filters, MODE)).toBe(false);

    const html = renderToStaticMarkup(
      <ReserveList
        drivers={pool}
        seasonYear={YEAR}
        ratingMode={MODE}
        selectedDriverId={null}
        onSelect={() => {}}
        filters={filters}
      />,
    );
    expect(html).not.toContain(`>${escaped(driverName(SEATED))}<`);
  });

  it("still holds a dropped driver on screen while they are selected", () => {
    // The one exemption left: a pick the filters hide is a pick that cannot be
    // put down, so whoever is held stays listed however narrow the band is.
    const pool = reserveDrivers(edited);
    const html = renderToStaticMarkup(
      <ReserveList
        drivers={pool}
        seasonYear={YEAR}
        ratingMode={MODE}
        selectedDriverId={SEATED}
        onSelect={() => {}}
        filters={{ hideRetired: false, hideFuture: false, minAge: 16, maxAge: 16 }}
      />,
    );
    expect(html).toContain(escaped(driverName(SEATED)));
  });

  it("keeps whoever is selected, so a pick cannot vanish mid-swap", () => {
    const html = render({ ...SHOW_ALL, minAge: 16, maxAge: 16 }, { selected: RESERVE });
    expect(html).toContain(escaped(driverName(RESERVE)));
    expect(html).toContain('aria-pressed="true"');
  });

  it("can reach every driver in history under peak ratings", () => {
    // The point of reading peak age: a field of the best drivers ever, which is
    // impossible on the season scale because most of the pool was a child or a
    // pensioner in whatever year is loaded. Widest range, career filters off —
    // and nobody is left out. Derived from the pool rather than a count, since
    // it grows with every season authored.
    const html = render(SHOW_ALL);
    expect(reserve.length).toBeGreaterThan(0);
    for (const driver of reserve) {
      expect(listed(html, driver), `${driver.id} unreachable`).toBe(true);
    }
    expect(html).toContain(`${reserve.length} drivers available`);
    expect(html).not.toContain(`of ${reserve.length} drivers available`);

    // And the same range against the season scale cannot: this is a real
    // difference, not a filter that stopped filtering.
    const bySeason = reserve.filter((driver) => matchesFilters(driver, YEAR, SHOW_ALL, "aged"));
    expect(bySeason.length).toBeLessThan(reserve.length);
  });

  it("explains an empty list instead of showing a blank panel", () => {
    // Nobody exempt, and an age nobody in the pool is — searched for rather
    // than written down, since which ages the pool covers keeps changing.
    const ages = new Set(reserve.map((driver) => ratedAge(driver, YEAR, MODE)));
    const spare = Array.from(
      { length: AGE_RANGE.max - AGE_RANGE.min + 1 },
      (_, offset) => AGE_RANGE.min + offset,
    ).find((age) => !ages.has(age));
    expect(spare, "no age in the range is free of the pool").toBeDefined();

    const html = renderToStaticMarkup(
      <ReserveList
        drivers={reserve}
        seasonYear={YEAR}
        ratingMode={MODE}
        selectedDriverId={null}
        onSelect={() => {}}
        filters={{ ...SHOW_ALL, minAge: spare ?? 0, maxAge: spare ?? 0 }}
      />,
    );
    expect(html).toContain("widening the filters");
    // Nothing to pick, so it does not ask for a pick.
    expect(html).not.toContain("Pick one");
    expect(render(SHOW_ALL)).toContain("Pick one");
  });

  it("counts a single driver in the singular", () => {
    const one = (filters: DriverFilters) =>
      renderToStaticMarkup(
        <ReserveList
          drivers={[FREE]}
          seasonYear={YEAR}
          ratingMode={MODE}
          selectedDriverId={null}
          onSelect={() => {}}
          filters={filters}
        />,
      );
    expect(one(SHOW_ALL)).toContain("1 driver available.");
    // An age band the one driver is outside, so the list is empty.
    const age = ratedAge(FREE, YEAR, MODE);
    const other = age === AGE_RANGE.min ? AGE_RANGE.max : AGE_RANGE.min;
    expect(one({ ...SHOW_ALL, minAge: other, maxAge: other })).toContain(
      "0 of 1 driver available.",
    );
  });
});

describe("what the season summary says about an edited grid", () => {
  // The grid tab: the banner heads every tab, and the grid is this one.
  const html = renderToStaticMarkup(
    <SeasonView {...shownAt(editedWorld, { kind: "summary" })} tab="grid" />,
  );
  const plain = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);

  it("declares it at the top, before the champions", () => {
    expect(html).toContain("Edited grid");
    expect(html.indexOf("Edited grid")).toBeLessThan(html.indexOf("champion"));
  });

  it("repeats it on the grid tab, on the grid it happened to", () => {
    expect(html).toContain("This grid was edited");
    expect(html.indexOf("This grid was edited")).toBeGreaterThan(html.indexOf("Edited grid"));
  });

  it("names the swap in both places", () => {
    expect(occurrences(html, swapLine)).toBe(2);
  });

  it("counts the changes rather than just admitting to some", () => {
    expect(html).toContain("You made 1 change to this");
  });

  it("says none of it when the grid was left alone", () => {
    expect(plain).not.toContain("Edited grid");
    expect(plain).not.toContain("This grid was edited");
  });

  it("does not borrow the accent the champions wear", () => {
    // "The grid was changed" is a caveat on the result, not a thing that was
    // won — and the accent test counts exactly two accented cards per summary.
    expect(occurrences(html, "bg-primary/5")).toBe(occurrences(plain, "bg-primary/5"));
  });
});

describe("counting the changes", () => {
  it("counts seats taken, not teams affected", () => {
    // A swap between two teams shows up as two changed teams but is one change.
    const betweenTeams = lineupChanges(SEED, swapDrivers(authored, SEATED, ELSEWHERE));
    expect(betweenTeams).toHaveLength(2);
    expect(changeCount(betweenTeams)).toBe("2 changes");
    expect(changeCount(changes)).toBe("1 change");
    expect(changeCount([])).toBe("0 changes");
  });

  it("pairs each arrival with the driver they replaced", () => {
    let lineup = swapDrivers(authored, SEATED, RESERVE);
    lineup = swapDrivers(lineup, TEAM_MATE, ALSO_FREE.id);
    const html = renderToStaticMarkup(<GridChanges changes={lineupChanges(SEED, lineup)} />);
    expect(html).toContain(swapLine);
    expect(html).toContain(escaped(`${ALSO_FREE.name} for ${driverName(TEAM_MATE)}`));
  });

  it("lists the teams alphabetically, as the grid does", () => {
    let lineup = swapDrivers(authored, SEATED, RESERVE);
    lineup = swapDrivers(lineup, ELSEWHERE, ALSO_FREE.id);
    const changed = lineupChanges(SEED, lineup);
    const html = renderToStaticMarkup(<EditedGridBanner changes={changed} />);

    const names = changed.map((change) => teamName(change.teamId));
    const drawn = [...names].sort((a, b) => html.indexOf(a) - html.indexOf(b));
    expect(drawn).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(html).toContain("2 changes");
    for (const driverId of [SEATED, RESERVE, ELSEWHERE, ALSO_FREE.id]) {
      expect(html, driverId).toContain(escaped(driverName(driverId)));
    }
  });
});

describe("selecting drivers to swap", () => {
  it("picks a driver up, and puts them down again on a second press", () => {
    expect(pickUp(authored, null, held(SEATED))).toEqual({
      lineup: authored,
      selected: held(SEATED),
    });
    expect(pickUp(authored, held(SEATED), held(SEATED))).toEqual({
      lineup: authored,
      selected: null,
    });
  });

  it("swaps a held driver with the seat that is chosen next", () => {
    const result = pickUp(authored, held(SEATED), held(ELSEWHERE));
    expect(result.selected).toBeNull();
    expect(seatOf(result.lineup, SEATED)).toBe(seatOf(authored, ELSEWHERE));
    expect(seatOf(result.lineup, ELSEWHERE)).toBe(SEATED_TEAM);
  });

  it("gives a seat to a driver who had none, whichever end was held first", () => {
    const fromSeat = pickUp(authored, held(SEATED), held(RESERVE));
    const fromPool = pickUp(authored, held(RESERVE), held(SEATED));
    expect(fromSeat).toEqual(fromPool);
    expect(seatOf(fromSeat.lineup, RESERVE)).toBe(SEATED_TEAM);
    expect(seatOf(fromSeat.lineup, SEATED)).toBeNull();
  });

  it("moves the selection rather than failing when neither driver has a seat", () => {
    // Two reserves is not a swap, and a press that visibly did nothing would
    // read as a bug.
    const result = pickUp(authored, held(RESERVE), held(ALSO_FREE.id));
    expect(result).toEqual({ lineup: authored, selected: held(ALSO_FREE.id) });
  });

  it("never changes the size of the field, whatever it is handed", () => {
    let lineup: LineupDraft = authored;
    let selected: GridPick | null = null;
    for (const driverId of [
      SEATED,
      RESERVE,
      ALSO_FREE.id,
      ELSEWHERE,
      ELSEWHERE,
      TEAM_MATE,
      SEATED,
    ]) {
      const result = pickUp(lineup, selected, held(driverId));
      lineup = result.lineup;
      selected = result.selected;
      expect(seatedDriverIds(lineup)).toHaveLength(SEATS);
      expect(new Set(seatedDriverIds(lineup)).size).toBe(SEATS);
    }
  });
});

/**
 * The car nobody is in.
 *
 * It arrives with the carry-over, which pulls drivers back to last year's teams
 * and leaves whatever they were driving this year empty — swapping cannot make
 * one, which is why the fixture below is written out rather than clicked into
 * existence. It is the one state the editor can reach that cannot be applied,
 * so what is checked here is that it is drawn, that it says so, and that
 * filling it closes it again.
 */
describe("an empty seat", () => {
  /** The authored grid with the lead car of the first entry left open. */
  const vacated: LineupDraft = {
    ...authored,
    [SEATED_TEAM]: [null, ...(authored[SEATED_TEAM] ?? []).slice(1)],
  };
  const seat: GridPick = { kind: "seat", teamId: SEATED_TEAM, seat: 0 };

  it("holds nobody, and leaves its driver without a drive", () => {
    expect(driverAt(vacated, { teamId: SEATED_TEAM, seat: 0 })).toBeNull();
    expect(seatOf(vacated, SEATED)).toBeNull();
    expect(emptySeats(vacated)).toEqual([{ teamId: SEATED_TEAM, seat: 0 }]);
  });

  it("keeps every team the number of cars it entered", () => {
    for (const entry of SEED.entries) {
      expect(vacated[entry.teamId], entry.teamId).toHaveLength(entry.drivers.length);
    }
  });

  it("cannot be applied while it is open, and can be once it is filled", () => {
    expect(filledLineup(vacated)).toBeNull();
    const filled = pickUp(vacated, seat, held(RESERVE)).lineup;
    expect(emptySeats(filled)).toHaveLength(0);
    expect(filledLineup(filled)).not.toBeNull();
    expect(seatOf(filled, RESERVE)).toBe(SEATED_TEAM);
  });

  it("takes a driver out of another car, leaving that one open instead", () => {
    // The seat count never moves: filling one hole by moving a seated driver
    // opens the hole they came from.
    const moved = pickUp(vacated, seat, held(ELSEWHERE)).lineup;
    expect(seatOf(moved, ELSEWHERE)).toBe(SEATED_TEAM);
    expect(emptySeats(moved)).toEqual([{ teamId: OTHER_TEAM, seat: 0 }]);
  });

  it("is drawn as a seat to fill, and says how many are left", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid
        field={previewField(SEED, vacated, MODE)}
        seasonYear={YEAR}
        ratingMode={MODE}
        openSeats={emptySeats(vacated).length}
        edit={{
          selected: null,
          onSelect: () => {},
          engineIds: SEED.engines.map((engine) => engine.engineId),
          onEngineChange: () => {},
          onChassisStep: () => {},
          onEngineStep: () => {},
        }}
        changes={lineupChanges(SEED, vacated)}
      />,
    );
    expect(html).toContain("Empty seat");
    expect(html).toContain("1 empty seat");
    // The team keeps its card, and the driver who left is named in the change
    // list rather than silently dropped.
    expect(html).toContain(ENTRY_NAME);
    expect(html).toContain(escaped(`${driverName(SEATED)} out, seat empty`));
  });

  it("is not drawn outside the editor, where the world can never hold one", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={previewField(SEED, vacated, MODE)} seasonYear={YEAR} ratingMode={MODE} />,
    );
    expect(html).not.toContain("Empty seat");
  });
});

/**
 * Ordering the two lists.
 *
 * The rule itself is unit-tested in `lib/sort.test.ts` against synthetic
 * ratings; what is checked here is that each list applies it, read back off the
 * component's *own* output rather than recomputed from the seed data — the
 * numbers down the right-hand edge of the rendered rows have to be the ones the
 * order was made from, or the page disagrees with itself.
 */
describe("ordering the grid and the pool", () => {
  /** Every overall the markup printed, in the order it printed them. */
  const overalls = (html: string) =>
    [...html.matchAll(/tabular-nums[^>]*>(\d+)</g)].map((match) => Number(match[1]));

  /**
   * The option each switch has chosen, read out of the radio group by name.
   * Parsed rather than substring-matched: which order React writes an input's
   * attributes in is not something this should depend on.
   */
  const chosen = (html: string, group: string) =>
    [...html.matchAll(/<input([^>]*)\/>/g)]
      .map((match) => match[1] ?? "")
      .filter((attrs) => attrs.includes(`name="${group}"`) && attrs.includes('checked=""'))
      .map((attrs) => /value="([^"]+)"/.exec(attrs)?.[1]);

  const descending = (values: readonly number[]) =>
    values.every((value, index) => index === 0 || (values[index - 1] ?? 0) >= value);

  describe("the team cards", () => {
    const names = (order: SortOrder) => byTeam(world.field, order).map((e) => teamName(e.teamId));

    it("opens alphabetically, so the pecking order is not given away", () => {
      expect(names("name")).toEqual([...names("name")].sort((a, b) => a.localeCompare(b)));
    });

    it("puts the best car first when asked, and keeps every team", () => {
      const ranked = byTeam(world.field, "overall");
      expect(descending(ranked.map((entry) => carOverall(entry.chassis, entry.engine)))).toBe(true);
      expect(new Set(names("overall"))).toEqual(new Set(names("name")));
      // The alphabet is not already the pecking order, or the check above is
      // satisfied by a component that ignores the switch entirely.
      expect(names("overall")).not.toEqual(names("name"));
    });

    it("draws the cards in that order", () => {
      const html = renderToStaticMarkup(
        <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={MODE} sort="overall" />,
      );
      const positions = byTeam(world.field, "overall").map((entry) =>
        html.indexOf(`>${entryName(entry.teamId, entry.engineId)}<`),
      );
      expect(positions.every((at) => at >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      // And not still alphabetical, which is what a switch nothing reads
      // would leave on screen.
      const alphabetical = byTeam(world.field, "name").map((entry) =>
        html.indexOf(`>${entryName(entry.teamId, entry.engineId)}<`),
      );
      expect(alphabetical).not.toEqual([...alphabetical].sort((a, b) => a - b));
    });

    it("lists a team's own drivers best first, whatever order the cards are in", () => {
      // The pecking order *inside* a card is not the sort switch's business:
      // which of a team's drivers is its first driver is the comparison the
      // card exists to make, so it holds in the alphabetical default too.
      const html = renderToStaticMarkup(
        <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={MODE} />,
      );
      const at = (driverId: string) => html.indexOf(`>${driverName(driverId)}<`);

      let reordered = 0;
      for (const entry of byTeam(world.field, "name")) {
        const drawn = [...entry.drivers].sort((a, b) => at(a.driverId) - at(b.driverId));
        expect(drawn.map((entrant) => at(entrant.driverId)).every((index) => index >= 0)).toBe(
          true,
        );
        expect(descending(drawn.map((entrant) => driverOverall(entrant.driver)))).toBe(true);
        if (drawn.some((entrant, seat) => entrant !== entry.drivers[seat])) {
          reordered += 1;
        }
      }
      // Somewhere on the grid a team entered its drivers in an order this
      // undoes — otherwise every assertion above is satisfied by a card that
      // draws them exactly as the season lists them, and orders nothing.
      expect(reordered).toBeGreaterThan(0);
    });

    it("offers the switch, with the order it is in already chosen", () => {
      const html = renderToStaticMarkup(
        <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={MODE} sort="overall" />,
      );
      expect(chosen(html, "team-sort")).toEqual(["overall"]);
    });
  });

  describe("the drivers without a drive", () => {
    const render = (sort: SortOrder) =>
      renderToStaticMarkup(
        <ReserveList
          drivers={reserveDrivers(authored)}
          seasonYear={YEAR}
          ratingMode={MODE}
          selectedDriverId={null}
          onSelect={() => {}}
          filters={DEFAULT_DRIVER_FILTERS}
          sort={sort}
        />,
      );

    it("lists the best of them first when asked", () => {
      const ranked = overalls(render("overall"));
      // Enough of a list for an order to mean anything.
      expect(ranked.length).toBeGreaterThan(2);
      expect(descending(ranked)).toBe(true);
      // And the alphabet is not already that order, so the check has work to do.
      expect(descending(overalls(render("name")))).toBe(false);
    });

    it("holds the same people either way round", () => {
      expect(overalls(render("overall")).toSorted()).toEqual(overalls(render("name")).toSorted());
    });

    it("opens alphabetically", () => {
      const html = render("name");
      const at = reserveDrivers(authored)
        .filter((driver) => matchesFilters(driver, YEAR, DEFAULT_DRIVER_FILTERS, MODE))
        .map((driver) => html.indexOf(`>${escaped(driver.name)}<`));
      // `reserveDrivers` hands them over by name, so the rendered order is the
      // order it was given.
      expect(at.every((index) => index >= 0)).toBe(true);
      expect(at).toEqual([...at].sort((a, b) => a - b));
    });

    it("carries its own radio group, so the two switches do not collide", () => {
      // Separate `name` attributes, not separate choices: what they are set to
      // is one shared preference — see `lib/sort-preference.test.ts`. Two radio
      // groups sharing a name on one page would move together for the wrong
      // reason, and the pool renders beside the grid while the editor is open.
      expect(chosen(render("name"), "reserve-sort")).toEqual(["name"]);
      expect(chosen(render("name"), "team-sort")).toEqual([]);
    });
  });
});

/**
 * One sort order, across every screen that has a switch.
 *
 * Setting it on the grid and being handed an alphabetical pool a click later is
 * the behaviour these replace. Static renders cannot click a switch, so what is
 * asserted is the half that matters and that a render *can* see: both screens
 * read the shared preference rather than a default of their own.
 */
describe("remembering how the reader wants lists ordered", () => {
  afterEach(() => {
    resetSortOrder();
  });

  const gridStage = () =>
    renderToStaticMarkup(
      <GridStage field={world.field} year={YEAR} ratingMode={MODE} lineup={null} engines={null} />,
    );
  const summary = () =>
    renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} tab="grid" />);

  /**
   * The order the grid's switch has chosen. Parsed attribute by attribute, like
   * `chosen` above: which order React writes them in is not something to depend
   * on, and a regex that silently stops matching would turn every case here into
   * `null === null`.
   */
  const order = (html: string) => {
    const radios = [...html.matchAll(/<input([^>]*)\/>/g)]
      .map((match) => match[1] ?? "")
      .filter((attrs) => attrs.includes('name="team-sort"') && attrs.includes('checked=""'));
    expect(radios, "the grid should render exactly one chosen order").toHaveLength(1);
    return /value="([^"]*)"/.exec(radios[0] ?? "")?.[1] ?? null;
  };

  it("opens both screens on the default", () => {
    expect(order(gridStage())).toBe(DEFAULT_SORT_ORDER);
    expect(order(summary())).toBe(DEFAULT_SORT_ORDER);
  });

  it("carries a chosen order onto the other screen", () => {
    setSortOrder("overall");
    expect(order(gridStage())).toBe("overall");
    expect(order(summary())).toBe("overall");
  });

  it("carries it back again", () => {
    setSortOrder("overall");
    setSortOrder("name");
    expect(order(gridStage())).toBe("name");
    expect(order(summary())).toBe("name");
  });
});
