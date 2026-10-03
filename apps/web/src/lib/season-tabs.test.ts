/** The season page's tab, read from the URL as untrusted input. */

import { describe, expect, it } from "vitest";
import { YEAR } from "../test-support.js";
import { parseTab, SEASON_TABS, seasonSearch, seasonTabLinks } from "./season-tabs.js";

describe("the season page's tab", () => {
  it("reads every tab back from the URL", () => {
    for (const tab of SEASON_TABS) {
      expect(parseTab(tab)).toBe(tab);
    }
  });

  it("reads anything else as the standings, rather than sending the reader away", () => {
    for (const bad of [undefined, null, "", "Calendar", "grid ", 3, ["grid"], { tab: "grid" }]) {
      expect(parseTab(bad), JSON.stringify(bad)).toBe("standings");
    }
  });

  it("leaves the default out of the URL, so the season has one address", () => {
    expect(seasonSearch({ tab: "standings" })).toEqual({});
    expect(seasonSearch({ tab: "nonsense" })).toEqual({});
    expect(seasonSearch({ tab: "calendar" })).toEqual({ tab: "calendar" });
    const links = seasonTabLinks(YEAR, "calendar");
    expect(links.map((each) => each.link.search)).toEqual(
      SEASON_TABS.map((tab) => (tab === "standings" ? {} : { tab })),
    );
  });

  it("marks exactly the tab on screen as current", () => {
    for (const current of SEASON_TABS) {
      const links = seasonTabLinks(YEAR, current);
      expect(links.filter((each) => each.current).map((each) => each.tab)).toEqual([current]);
    }
  });
});
