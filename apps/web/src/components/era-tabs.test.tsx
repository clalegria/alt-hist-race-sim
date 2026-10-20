/**
 * The era's section strip: Champions · Drivers · Teams on each of their pages,
 * from the one list the breadcrumb menu reads too.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PAGE_OF } from "../lib/roster-places.js";
import { eraSectionTabs, type RunSection, sectionsMenu } from "../lib/run-bar.js";
import { createWorld, type EraRun } from "../store/season.js";
import { inRouter } from "../test-router.js";
import { YEAR } from "../test-support.js";
import { EraChampions } from "./EraChampions.js";
import { EraTabs } from "./EraTabs.js";
import { SeasonHistoryProvider } from "./SeasonHistory.js";

const SECTIONS: readonly RunSection[] = ["overview", "drivers", "teams"];

/** The label of the one tab marked as the page on screen. */
function currentTab(html: string): string | null {
  return /aria-current="page"[^>]*>([^<]+)</.exec(html)?.[1] ?? null;
}

describe("the era's section tabs", () => {
  it("mark the page on screen, and no other", async () => {
    const labels = ["Champions", "Drivers", "Teams"];
    for (const [index, section] of SECTIONS.entries()) {
      const html = await inRouter(<EraTabs current={section} />);
      expect(html).toContain('aria-label="Era"');
      expect(currentTab(html)).toBe(labels[index]);
      expect(html.split('aria-current="page"').length - 1).toBe(1);
      // The other two are links to their pages.
      expect(html.split("<a ").length - 1).toBe(2);
    }
  });

  it("share one list with the breadcrumbs' sections menu", () => {
    for (const section of SECTIONS) {
      const tabs = eraSectionTabs(section);
      const items = sectionsMenu(section).items;
      expect(tabs.map((tab) => tab.link)).toEqual(items.map((item) => item.link));
      expect(tabs.map((tab) => tab.current)).toEqual(items.map((item) => item.current));
    }
  });

  it("head the champions page inside a run, and not outside one", async () => {
    const run: EraRun = { startYear: YEAR, seasons: [createWorld(1, YEAR)] };
    const inside = await inRouter(
      <SeasonHistoryProvider seasons={run.seasons} pageOf={PAGE_OF}>
        <EraChampions run={run} />
      </SeasonHistoryProvider>,
    );
    expect(currentTab(inside)).toBe("Champions");
    expect(renderToStaticMarkup(<EraChampions run={run} />)).not.toContain('aria-label="Era"');
  });
});
