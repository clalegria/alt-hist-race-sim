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
  driversById,
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverName, entryName, teamName } from "../lib/names.js";
import { ageInSeason } from "../lib/people.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, YEAR } from "../test-support.js";
import { GridStage, pickUp, ReserveList } from "./GridStage.js";
import { changeCount, EditedGridBanner, GridChanges } from "./LineupChanges.js";
import { SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const authored = authoredLineup(SEED);

/**
 * A seated driver and one without a drive, picked out of the data rather than
 * named: roadmap 2 adds privateer entries, which promotes some of today's
 * reserves. See the testing rule in `CLAUDE.md`.
 */
const FIRST_ENTRY = SEED.entries[0];
const SECOND_ENTRY = SEED.entries[1];
const SEATED = FIRST_ENTRY?.drivers[0] ?? "";
const TEAM_MATE = FIRST_ENTRY?.drivers[1] ?? "";
const ELSEWHERE = SECOND_ENTRY?.drivers[0] ?? "";
const [FREE, ALSO_FREE] = reserveDrivers(authored);
if (FIRST_ENTRY === undefined || FREE === undefined || ALSO_FREE === undefined) {
  throw new Error("the season needs an entry list and two drivers without a seat");
}
const RESERVE = FREE.id;
const SEATED_TEAM = FIRST_ENTRY.teamId;
/** How that team is named on the grid now that the engine is part of it. */
const ENTRY_NAME = entryName(SEATED_TEAM, FIRST_ENTRY.engineId);

/** One swap: the reserve takes the first seat on the entry list. */
const edited = swapDrivers(authored, SEATED, RESERVE);
const changes = lineupChanges(SEED, edited);
const world = seededWorld();
const editedWorld = createWorld(3, YEAR, "peak", edited);
const SEATS = world.field.length;
const SPARE = reserveDrivers(authored).length;
const swapLine = `${driverName(RESERVE)} for ${driverName(SEATED)}`;

/** How many times a class string appears. No regex: these contain slashes. */
function occurrences(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

describe("the grid before it is edited", () => {
  const html = renderToStaticMarkup(
    <GridStage field={world.field} year={YEAR} ratingMode="peak" lineup={null} engines={null} />,
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
      ratingMode="peak"
      lineup={edited}
      engines={null}
    />,
  );

  it("seats the swapped-in driver at their new team", () => {
    const card = html.slice(html.indexOf(`>${ENTRY_NAME}<`));
    expect(card.slice(0, card.indexOf("</li></ul></li>"))).toContain(driverName(RESERVE));
  });

  it("leaves the driver who lost the seat off the grid entirely", () => {
    // Named in the note above the cards, but in nobody's car: matching the
    // wrapped name rather than the bare string keeps the two apart.
    expect(html).not.toContain(`>${driverName(SEATED)}<`);
    expect(html).toContain(`for ${driverName(SEATED)}`);
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
    selectedDriverId: SEATED,
    onSelect: () => {},
    engineIds: SEED.engines.map((engine) => engine.engineId),
    onEngineChange: () => {},
  };
  const html = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={YEAR} edit={editing} changes={[]} />,
  );

  it("explains that every change is a swap", () => {
    expect(html).toContain("teams keep the number of cars they entered");
  });

  it("turns every driver into something to select, and marks the one picked up", () => {
    // Every seat is a pressable button; exactly one of them is held.
    expect(occurrences(html, "aria-pressed")).toBe(SEATS);
    expect(occurrences(html, 'aria-pressed="true"')).toBe(1);
    const pressed = html.slice(html.indexOf('aria-pressed="true"'));
    expect(pressed.slice(0, pressed.indexOf("</button>"))).toContain(driverName(SEATED));
  });

  it("still shows the age and overall the reader is choosing on", () => {
    const record = driversById().get(TEAM_MATE === "" ? SEATED : TEAM_MATE);
    expect(record).toBeDefined();
    expect(html).toContain(record?.name ?? "");
    expect(html).toContain(`(${ageInSeason(YEAR, record?.birthYear ?? YEAR)}y)`);
  });
});

describe("the drivers without a drive", () => {
  const reserve = reserveDrivers(authored);
  const html = renderToStaticMarkup(
    <ReserveList
      drivers={reserve}
      seasonYear={YEAR}
      ratingMode="peak"
      selectedDriverId={null}
      onSelect={() => {}}
    />,
  );

  it("lists everyone in the pool without a seat, and nobody with one", () => {
    expect(reserve.length).toBeGreaterThan(0);
    expect(html).toContain(`${SPARE} in the pool`);
    for (const driver of reserve) {
      expect(html, `missing ${driver.id}`).toContain(driver.name);
    }
    for (const driverId of seatedDriverIds(authored)) {
      expect(html, `${driverId} has a seat`).not.toContain(`>${driverName(driverId)}<`);
    }
  });

  it("shows the same age and overall the grid does, so the two compare", () => {
    const record = driversById().get(RESERVE);
    expect(record).toBeDefined();
    expect(html).toContain(record?.name ?? "");
    expect(html).toContain(`(${ageInSeason(YEAR, record?.birthYear ?? YEAR)}y)`);
  });

  it("trades one for one as seats change hands", () => {
    const after = reserveDrivers(edited).map((driver) => driver.id);
    expect(after).toHaveLength(SPARE);
    expect(after).toContain(SEATED);
    expect(after).not.toContain(RESERVE);
  });
});

describe("what the season summary says about an edited grid", () => {
  const html = renderToStaticMarkup(<SeasonView world={editedWorld} view={{ kind: "summary" }} />);
  const plain = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);

  it("declares it at the top, before the champions", () => {
    expect(html).toContain("Alternate grid");
    expect(html.indexOf("Alternate grid")).toBeLessThan(html.indexOf("champion"));
  });

  it("repeats it at the foot, on the grid it happened to", () => {
    expect(html).toContain("This grid was edited");
    expect(html.indexOf("This grid was edited")).toBeGreaterThan(html.indexOf("Alternate grid"));
  });

  it("names the swap in both places", () => {
    expect(occurrences(html, swapLine)).toBe(2);
  });

  it("counts the changes rather than just admitting to some", () => {
    expect(html).toContain("1 change from the season as it was entered");
  });

  it("says none of it when the grid was left alone", () => {
    expect(plain).not.toContain("Alternate grid");
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
    expect(html).toContain(`${ALSO_FREE.name} for ${driverName(TEAM_MATE)}`);
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
      expect(html, driverId).toContain(driverName(driverId));
    }
  });
});

describe("selecting drivers to swap", () => {
  it("picks a driver up, and puts them down again on a second press", () => {
    expect(pickUp(authored, null, SEATED)).toEqual({ lineup: authored, selected: SEATED });
    expect(pickUp(authored, SEATED, SEATED)).toEqual({ lineup: authored, selected: null });
  });

  it("swaps a held driver with the seat that is chosen next", () => {
    const result = pickUp(authored, SEATED, ELSEWHERE);
    expect(result.selected).toBeNull();
    expect(seatOf(result.lineup, SEATED)).toBe(seatOf(authored, ELSEWHERE));
    expect(seatOf(result.lineup, ELSEWHERE)).toBe(SEATED_TEAM);
  });

  it("gives a seat to a driver who had none, whichever end was held first", () => {
    const fromSeat = pickUp(authored, SEATED, RESERVE);
    const fromPool = pickUp(authored, RESERVE, SEATED);
    expect(fromSeat).toEqual(fromPool);
    expect(seatOf(fromSeat.lineup, RESERVE)).toBe(SEATED_TEAM);
    expect(seatOf(fromSeat.lineup, SEATED)).toBeNull();
  });

  it("moves the selection rather than failing when neither driver has a seat", () => {
    // Two reserves is not a swap, and a press that visibly did nothing would
    // read as a bug.
    const result = pickUp(authored, RESERVE, ALSO_FREE.id);
    expect(result).toEqual({ lineup: authored, selected: ALSO_FREE.id });
  });

  it("never changes the size of the field, whatever it is handed", () => {
    let lineup: SeasonLineup = authored;
    let selected: string | null = null;
    for (const driverId of [
      SEATED,
      RESERVE,
      ALSO_FREE.id,
      ELSEWHERE,
      ELSEWHERE,
      TEAM_MATE,
      SEATED,
    ]) {
      const result = pickUp(lineup, selected, driverId);
      lineup = result.lineup;
      selected = result.selected;
      expect(seatedDriverIds(lineup)).toHaveLength(SEATS);
      expect(new Set(seatedDriverIds(lineup)).size).toBe(SEATS);
    }
  });
});
