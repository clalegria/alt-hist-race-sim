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
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  season1980,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverName } from "../lib/names.js";
import { createWorld } from "../store/season.js";
import { GridStage, pickUp, ReserveList } from "./GridStage.js";
import { changeCount, EditedGridBanner, LineupChanges } from "./LineupChanges.js";
import { SeasonGrid, SWAPPED_IN } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const authored = authoredLineup(season1980);
/** Mansell, who had no 1980 drive, in the Williams that won it. */
const edited = swapDrivers(authored, "jones", "mansell");
const changes = lineupChanges(season1980, edited);
const world = createWorld(3, 1980);
const editedWorld = createWorld(3, 1980, "peak", edited);

/** How many times a class string appears. No regex: these contain slashes. */
function occurrences(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

describe("the grid before it is edited", () => {
  const html = renderToStaticMarkup(
    <GridStage field={world.field} year={1980} ratingMode="peak" lineup={null} />,
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
    <GridStage field={editedWorld.field} year={1980} ratingMode="peak" lineup={edited} />,
  );

  it("seats the swapped-in driver at their new team", () => {
    const williams = html.slice(html.indexOf(">Williams<"));
    expect(williams.slice(0, williams.indexOf("</li>"))).toContain("Nigel Mansell");
  });

  it("leaves the driver who lost the seat off the grid entirely", () => {
    // Named in the note above the cards, but in nobody's car: matching the
    // wrapped name rather than the bare string keeps the two apart.
    expect(html).not.toContain(">Alan Jones<");
    expect(html).toContain("for Alan Jones");
  });

  it("says what was changed, and marks who is new", () => {
    expect(html).toContain("This grid was edited");
    expect(html).toContain("Nigel Mansell for Alan Jones");
    // One driver arrived, so exactly one row carries the mark.
    expect(occurrences(html, SWAPPED_IN)).toBe(1);
  });

  it("still offers the editor rather than locking the grid in", () => {
    expect(html).toContain("Edit grid");
  });
});

describe("the grid in edit mode", () => {
  const editing = { selectedDriverId: "jones", onSelect: () => {} };
  const html = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={1980} edit={editing} changes={[]} />,
  );

  it("explains that every change is a swap", () => {
    expect(html).toContain("Teams keep the number of cars they entered");
  });

  it("turns every driver into something to select, and marks the one picked up", () => {
    // 28 seats, each a pressable button; exactly one of them is held.
    expect(occurrences(html, "aria-pressed")).toBe(28);
    expect(occurrences(html, 'aria-pressed="true"')).toBe(1);
    const pressed = html.slice(html.indexOf('aria-pressed="true"'));
    expect(pressed.slice(0, pressed.indexOf("</button>"))).toContain("Alan Jones");
  });

  it("still shows the age and overall the reader is choosing on", () => {
    expect(html).toContain("(34y)");
    expect(html).toContain("Carlos Reutemann");
  });
});

describe("the drivers without a drive", () => {
  const reserve = reserveDrivers(authored);
  const html = renderToStaticMarkup(
    <ReserveList
      drivers={reserve}
      seasonYear={1980}
      ratingMode="peak"
      selectedDriverId={null}
      onSelect={() => {}}
    />,
  );

  it("lists everyone in the pool without a seat, and nobody with one", () => {
    expect(reserve).toHaveLength(13);
    expect(html).toContain("13 in the pool");
    for (const driver of reserve) {
      expect(html, `missing ${driver.id}`).toContain(driver.name);
    }
    expect(html).not.toContain("Alan Jones");
  });

  it("shows the same age and overall the grid does, so the two compare", () => {
    expect(html).toContain("Nigel Mansell");
    expect(html).toContain("(27y)"); // Mansell, born 1953
  });

  it("shrinks as seats are taken", () => {
    expect(reserveDrivers(edited)).toHaveLength(13);
    expect(reserveDrivers(edited).map((driver) => driver.id)).toContain("jones");
    expect(reserveDrivers(edited).map((driver) => driver.id)).not.toContain("mansell");
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
    expect(occurrences(html, "Nigel Mansell for Alan Jones")).toBe(2);
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
    const betweenTeams = lineupChanges(season1980, swapDrivers(authored, "jones", "villeneuve_g"));
    expect(betweenTeams).toHaveLength(2);
    expect(changeCount(betweenTeams)).toBe("2 changes");
    expect(changeCount(changes)).toBe("1 change");
    expect(changeCount([])).toBe("0 changes");
  });

  it("pairs each arrival with the driver they replaced", () => {
    let lineup = swapDrivers(authored, "jones", "mansell");
    lineup = swapDrivers(lineup, "reutemann", "decesaris");
    const html = renderToStaticMarkup(
      <LineupChanges changes={lineupChanges(season1980, lineup)} />,
    );
    expect(html).toContain("Nigel Mansell for Alan Jones");
    expect(html).toContain("Andrea de Cesaris for Carlos Reutemann");
  });

  it("lists the teams alphabetically, as the grid does", () => {
    let lineup = swapDrivers(authored, "villeneuve_g", "mansell");
    lineup = swapDrivers(lineup, "jones", "decesaris");
    const html = renderToStaticMarkup(
      <EditedGridBanner changes={lineupChanges(season1980, lineup)} />,
    );
    expect(html.indexOf("Ferrari")).toBeLessThan(html.indexOf("Williams"));
    expect(html).toContain("2 changes");
    for (const driverId of ["mansell", "decesaris", "jones", "villeneuve_g"]) {
      expect(html, driverId).toContain(driverName(driverId));
    }
  });
});

describe("selecting drivers to swap", () => {
  it("picks a driver up, and puts them down again on a second press", () => {
    expect(pickUp(authored, null, "jones")).toEqual({ lineup: authored, selected: "jones" });
    expect(pickUp(authored, "jones", "jones")).toEqual({ lineup: authored, selected: null });
  });

  it("swaps a held driver with the seat that is chosen next", () => {
    const result = pickUp(authored, "jones", "villeneuve_g");
    expect(result.selected).toBeNull();
    expect(seatOf(result.lineup, "jones")).toBe("ferrari");
    expect(seatOf(result.lineup, "villeneuve_g")).toBe("williams");
  });

  it("gives a seat to a driver who had none, whichever end was held first", () => {
    const fromSeat = pickUp(authored, "jones", "mansell");
    const fromPool = pickUp(authored, "mansell", "jones");
    expect(fromSeat).toEqual(fromPool);
    expect(seatOf(fromSeat.lineup, "mansell")).toBe("williams");
    expect(seatOf(fromSeat.lineup, "jones")).toBeNull();
  });

  it("moves the selection rather than failing when neither driver has a seat", () => {
    // Two reserves is not a swap, and a press that visibly did nothing would
    // read as a bug.
    const result = pickUp(authored, "mansell", "decesaris");
    expect(result).toEqual({ lineup: authored, selected: "decesaris" });
  });

  it("never changes the size of the field, whatever it is handed", () => {
    let lineup: SeasonLineup = authored;
    let selected: string | null = null;
    for (const driverId of [
      "jones",
      "mansell",
      "decesaris",
      "villeneuve_g",
      "villeneuve_g",
      "reutemann",
      "jones",
    ]) {
      const result = pickUp(lineup, selected, driverId);
      lineup = result.lineup;
      selected = result.selected;
      expect(seatedDriverIds(lineup)).toHaveLength(28);
      expect(new Set(seatedDriverIds(lineup)).size).toBe(28);
    }
  });
});
