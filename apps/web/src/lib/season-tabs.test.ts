/** The season page's tab, read from the URL as untrusted input. */

import { describe, expect, it } from "vitest";
import { YEAR } from "../test-support.js";
import { SEASON_TABS, seasonSearch, seasonTabLinks } from "./season-tabs.js";

describe("the season page's tab", () => {
  it("reads every tab back from the URL", () => {
    for (const tab of SEASON_TABS) {
      expect(seasonSearch({ tab })).toEqual({ tab });
    }
  });

  it("reads anything else as no tab, rather than sending the reader away", () => {
    for (const bad of [undefined, null, "", "Calendar", "grid ", 3, ["grid"], { tab: "grid" }]) {
      expect(seasonSearch({ tab: bad }), JSON.stringify(bad)).toEqual({});
    }
  });

  it("names every tab in its own link, standings included", () => {
    // A URL with no tab opens the one last left on, so a link to the
    // standings has to say so.
    const links = seasonTabLinks(YEAR, "calendar");
    expect(links.map((each) => each.link.search)).toEqual(SEASON_TABS.map((tab) => ({ tab })));
  });

  it("marks exactly the tab on screen as current", () => {
    for (const current of SEASON_TABS) {
      const links = seasonTabLinks(YEAR, current);
      expect(links.filter((each) => each.current).map((each) => each.tab)).toEqual([current]);
    }
  });
});
