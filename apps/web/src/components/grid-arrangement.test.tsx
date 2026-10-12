/**
 * Rearranging the whole grid by rule.
 *
 * Rendered statically, like everything else here, so what these reach is the
 * markup each state produces. The split is the same one the rest of the editor
 * is under: **the rules themselves are unit-tested in `@alt-hist/data`**, where
 * an arrangement is a pure function of a season and a cast; **where the
 * settings' reseat ends up is tested in the store**, every year of an era
 * included; and what is left for this level is what the reader is *told* —
 * which rule the panel says is chosen, and what the grid says about the season
 * afterwards.
 */

import {
  ARRANGEMENT_KINDS,
  type ArrangementKind,
  authoredLineup,
  DEFAULT_DRIVER_FILTERS,
  type DriverFilters,
  type GridArrangement,
  type RatingMode,
  reserveDrivers,
  swapDrivers,
} from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HISTORICAL_SETTINGS, type RunSettings } from "../lib/run-settings.js";
import { enteredSeason } from "../lib/seasons.js";
import { createWorld } from "../store/season.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { GridArrangements } from "./GridStage.js";
import { ARRANGEMENT_LABELS, ArrangementNote, arrangementNote } from "./LineupChanges.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

/** The mode every fixture here is built and drawn in. */
const MODE: RatingMode = "peak";

const authored = authoredLineup(SEED);
const SEATED = SEED.entries[0]?.drivers[0] ?? "";
const RESERVE = reserveDrivers(authored)[0]?.id ?? "";
if (SEATED === "" || RESERVE === "") {
  throw new Error("the season needs a seated driver and a driver without a drive");
}

/** A rule as the editor hands one over, with the pool it was allowed to draw on. */
const rules = (
  kind: ArrangementKind,
  {
    includeUnemployed = false,
    filters = DEFAULT_DRIVER_FILTERS,
  }: { includeUnemployed?: boolean; filters?: DriverFilters } = {},
): GridArrangement => ({ kind, includeUnemployed, filters });

const RANKED = rules("fastest-in-fastest");
const RANKED_LABEL = ARRANGEMENT_LABELS["fastest-in-fastest"];

/** A run whose settings reseat the grid by the ranked rule. */
const RESEATED: RunSettings = {
  ...HISTORICAL_SETTINGS,
  seating: { kind: "fastest-in-fastest", includeUnemployed: false },
};
/** A season under the rule and nothing else: no hand edit. */
const unchangedWorld = createWorld(3, YEAR, MODE, null, null, undefined, null, RESEATED);
/** The same season with a hand swap over the reseat, so the change list is non-empty too. */
const arrangedWorld = createWorld(
  3,
  YEAR,
  MODE,
  swapDrivers(authoredLineup(enteredSeason(unchangedWorld)), SEATED, RESERVE),
  null,
  undefined,
  null,
  RESEATED,
);
const plainWorld = seededWorld(3, MODE);

/** Whether a button in the markup is pressed, by the label inside it. */
function pressed(html: string, label: string): boolean {
  const at = html.indexOf(label);
  if (at === -1) {
    throw new Error(`no button labelled "${label}"`);
  }
  // Back to the opening tag of the button this label sits in, then read the
  // attribute off it. React writes `aria-pressed="true"` or `"false"`, so the
  // absent case is a missing attribute and not a silent pass.
  const tag = html.slice(html.lastIndexOf("<button", at), at);
  return tag.includes('aria-pressed="true"');
}

/** The `checked` state of a checkbox, by the label text beside it. */
function ticked(html: string, label: string): boolean {
  const at = html.indexOf(label);
  if (at === -1) {
    throw new Error(`no checkbox labelled "${label}"`);
  }
  const input = html.slice(html.lastIndexOf("<input", at), at);
  return input.includes('checked=""');
}

describe("what the rules are called", () => {
  it("names every rule there is", () => {
    // A fourth rule added to the data package without a label here would render
    // an empty button, which is why this counts the map against the list.
    for (const kind of ARRANGEMENT_KINDS) {
      expect(ARRANGEMENT_LABELS[kind], kind).not.toBe("");
    }
    expect(Object.keys(ARRANGEMENT_LABELS).sort()).toEqual([...ARRANGEMENT_KINDS].sort());
  });

  it("says which cast a rule drew on", () => {
    expect(arrangementNote(rules("random"), MODE)).toContain("Only that season");
    expect(arrangementNote(rules("random", { includeUnemployed: true }), MODE)).toContain(
      "without a seat",
    );
  });

  it("names the pool it was allowed to draw on, since the reader chose it", () => {
    // The filters travel inside the arrangement, so a rule kept across an era
    // draws on a set that is no longer on screen anywhere.
    const wide: DriverFilters = { ...DEFAULT_DRIVER_FILTERS, maxAge: 45 };
    const note = arrangementNote(rules("random", { includeUnemployed: true, filters: wide }), MODE);
    expect(note).toContain(`to ${wide.maxAge}`);
  });

  it("names the age band with the word the filter panel uses", () => {
    // The band is read against `ratedAge`, which is peak age in `peak` mode:
    // "aged 18 to 42" beside a 1980 season would be read as 1980 ages.
    const open = rules("random", { includeUnemployed: true });
    expect(arrangementNote(open, "peak")).toContain("peak age");
    expect(arrangementNote(open, "aged")).not.toContain("peak age");
  });
});

describe("the panel of rules", () => {
  const html = renderToStaticMarkup(<GridArrangements chosen={null} includeUnemployed={false} />);

  it("offers all three, and says what pressing one costs", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      expect(html, kind).toContain(ARRANGEMENT_LABELS[kind]);
    }
    expect(html).toContain("Rearrange the whole grid");
    expect(html).toContain("by hand");
  });

  it("presses none of them until one is chosen", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      expect(pressed(html, ARRANGEMENT_LABELS[kind]), kind).toBe(false);
    }
  });

  it("marks exactly the chosen rule, whichever it is", () => {
    for (const chosen of ARRANGEMENT_KINDS) {
      const drawn = renderToStaticMarkup(
        <GridArrangements chosen={chosen} includeUnemployed={false} />,
      );
      for (const kind of ARRANGEMENT_KINDS) {
        expect(pressed(drawn, ARRANGEMENT_LABELS[kind]), `${chosen}/${kind}`).toBe(kind === chosen);
      }
    }
  });

  it("offers the pool, unticked by default", () => {
    expect(html).toContain("Include unemployed drivers");
    expect(ticked(html, "Include unemployed drivers")).toBe(false);
    const wide = renderToStaticMarkup(<GridArrangements chosen={null} includeUnemployed />);
    expect(ticked(wide, "Include unemployed drivers")).toBe(true);
  });
});

describe("what the grid says about a rule in force", () => {
  const html = renderToStaticMarkup(
    <SeasonView {...shownAt(arrangedWorld, { kind: "grid" })} canChooseAbility={false} />,
  );
  const plain = renderToStaticMarkup(
    <SeasonView {...shownAt(plainWorld, { kind: "grid" })} canChooseAbility={false} />,
  );

  it("names the rule on the grid the reader comes back to", () => {
    expect(html).toContain("This grid was edited");
    expect(html).toContain(RANKED_LABEL);
  });

  it("says nothing about a rule when nobody pressed one", () => {
    expect(plain).not.toContain(RANKED_LABEL);
    expect(plain).not.toContain("This grid was edited");
  });

  it("keeps the panel of rules out of the way until the editor is opened", () => {
    // The rules are part of the editor, not of the page: the grid opens as
    // something to read.
    expect(html).not.toContain("Rearrange the whole grid");
    expect(html).toContain("Edit grid");
  });

  it("says it with no hand edit at all, since the reseat is the starting grid", () => {
    // The reseat is the baseline, so there is no swap to list, and the reader
    // is still owed the word — which is why the notice does not hang off the
    // change list.
    const landed = renderToStaticMarkup(
      <SeasonView {...shownAt(unchangedWorld, { kind: "grid" })} canChooseAbility={false} />,
    );
    expect(unchangedWorld.lineup).toBeNull();
    expect(landed).toContain(RANKED_LABEL);
  });

  it("draws the note on its own, with no change list beside it", () => {
    const note = renderToStaticMarkup(<ArrangementNote arrangement={RANKED} ratingMode={MODE} />);
    expect(note).toContain(RANKED_LABEL);
    expect(note).toContain(arrangementNote(RANKED, MODE).replaceAll("'", "&#x27;"));
  });
});

describe("what the season summary says about a rule", () => {
  const html = renderToStaticMarkup(
    <SeasonView
      {...shownAt(arrangedWorld, { kind: "summary" })}
      canChooseAbility={false}
      tab="grid"
    />,
  );
  const plain = renderToStaticMarkup(
    <SeasonView
      {...shownAt(plainWorld, { kind: "summary" })}
      canChooseAbility={false}
      tab="grid"
    />,
  );

  it("names it on the grid tab, not in the banner of hand edits", () => {
    // The reseat is a setting, not an edit: the banner lists only what the
    // reader changed by hand.
    expect(html.split(RANKED_LABEL)).toHaveLength(2);
    expect(html.indexOf(RANKED_LABEL)).toBeGreaterThan(html.indexOf("champion"));
  });

  it("says nothing of it on a season nobody rearranged", () => {
    expect(plain).not.toContain(RANKED_LABEL);
  });

  it("still does not borrow the accent the champions wear", () => {
    expect(html.split("bg-primary/5")).toHaveLength(plain.split("bg-primary/5").length);
  });
});

describe("the grid card on its own", () => {
  it("draws the notice for a rule with no other changes at all", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid
        field={plainWorld.field}
        seasonYear={YEAR}
        ratingMode={MODE}
        arrangement={RANKED}
      />,
    );
    expect(html).toContain(RANKED_LABEL);
  });

  it("draws no notice without one", () => {
    const html = renderToStaticMarkup(
      <SeasonGrid field={plainWorld.field} seasonYear={YEAR} ratingMode={MODE} />,
    );
    expect(html).not.toContain("This grid was edited");
    for (const kind of ARRANGEMENT_KINDS) {
      expect(html, kind).not.toContain(ARRANGEMENT_LABELS[kind]);
    }
  });
});
