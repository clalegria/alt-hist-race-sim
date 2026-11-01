/**
 * The season page's tabs: which one the URL asks for, and the link to each.
 *
 * A tab is a **search param** (`/run/1984?tab=calendar`), not a path segment:
 * the path says *which* season, the query *how* it is viewed. It is still a
 * place in the address bar, so Back moves between tabs and a link can name one.
 * Like any URL it comes from the reader, so it is checked, and anything that is
 * not a tab reads as no tab rather than sending the reader elsewhere.
 *
 * **A URL with no tab opens the standings**, however the reader got there. Only
 * the steps to the season either side keep the tab on screen (`stepsFor`), so
 * reading calendars year after year stays on the calendar.
 */

import { linkOptions } from "@tanstack/react-router";

export const SEASON_TABS = ["standings", "calendar", "grid"] as const;

export type SeasonTab = (typeof SEASON_TABS)[number];

const LABELS: Record<SeasonTab, string> = {
  standings: "Standings",
  calendar: "Calendar",
  grid: "Grid",
};

/** The tab a season page opens on when its URL names none. */
export const FIRST_SEASON_TAB: SeasonTab = "standings";

/** The season page's search params, checked: the route's `validateSearch`. */
export function seasonSearch(search: Record<string, unknown>): { tab?: SeasonTab } {
  const tab = SEASON_TABS.find((one) => one === search.tab);
  return tab === undefined ? {} : { tab };
}

/** The link to one tab of `year`'s season page. */
export function seasonTabLink(year: number, tab: SeasonTab) {
  return linkOptions({
    to: "/run/$year",
    params: { year: String(year) },
    search: { tab },
  });
}

export interface SeasonTabLink {
  readonly tab: SeasonTab;
  readonly label: string;
  readonly link: ReturnType<typeof seasonTabLink>;
  readonly current: boolean;
}

/** Every tab of `year`'s season page, in order, `current` marking the one on screen. */
export function seasonTabLinks(year: number, current: SeasonTab): readonly SeasonTabLink[] {
  return SEASON_TABS.map((tab) => ({
    tab,
    label: LABELS[tab],
    link: seasonTabLink(year, tab),
    current: tab === current,
  }));
}
