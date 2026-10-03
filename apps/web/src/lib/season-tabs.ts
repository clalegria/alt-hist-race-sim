/**
 * The season page's tabs: which one the URL asks for, and the link to each.
 *
 * A tab is a **search param** (`/run/1984?tab=calendar`), not a path segment:
 * the path says *which* season, the query *how* it is viewed. It is still a
 * place in the address bar, so Back moves between tabs and a link can name one.
 * Like any URL it comes from the reader, so it is checked, and anything that is
 * not a tab reads as the default rather than sending the reader elsewhere.
 */

import { linkOptions } from "@tanstack/react-router";

export const SEASON_TABS = ["standings", "calendar", "grid"] as const;

export type SeasonTab = (typeof SEASON_TABS)[number];

const LABELS: Record<SeasonTab, string> = {
  standings: "Standings",
  calendar: "Calendar",
  grid: "Grid",
};

/** The tab a URL's `tab` names; the standings for anything else. */
export function parseTab(raw: unknown): SeasonTab {
  return SEASON_TABS.find((tab) => tab === raw) ?? "standings";
}

/**
 * The season page's search params, checked: the route's `validateSearch`.
 * The default tab is left out, so `/run/1984` is its one address.
 */
export function seasonSearch(search: Record<string, unknown>): { tab?: SeasonTab } {
  const tab = parseTab(search.tab);
  return tab === "standings" ? {} : { tab };
}

/** The link to one tab of `year`'s season page. */
export function seasonTabLink(year: number, tab: SeasonTab) {
  return linkOptions({
    to: "/run/$year",
    params: { year: String(year) },
    search: tab === "standings" ? {} : { tab },
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
