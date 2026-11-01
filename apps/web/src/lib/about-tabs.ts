/**
 * The About page's tabs, as a search param (`/about?tab=whats-new`) like the
 * season page's (`season-tabs.ts`): a place in the address bar, checked, and
 * About itself when the URL names none.
 */

import { linkOptions } from "@tanstack/react-router";

export const ABOUT_TABS = ["about", "whats-new", "known-issues", "submit-bug"] as const;

export type AboutTab = (typeof ABOUT_TABS)[number];

const LABELS: Record<AboutTab, string> = {
  about: "About",
  "whats-new": "What's new",
  "known-issues": "Known issues",
  "submit-bug": "Submit bug",
};

const HEADINGS: Record<AboutTab, string> = {
  about: "About this project",
  "whats-new": "Changelog",
  "known-issues": "Known issues and limitations",
  "submit-bug": "Submit a bug report",
};

/** The page's heading on `tab`: the tab's name written out in full. */
export function aboutHeading(tab: AboutTab): string {
  return HEADINGS[tab];
}

/** The page's search params, checked: the route's `validateSearch`. */
export function aboutSearch(search: Record<string, unknown>): { tab?: AboutTab } {
  const tab = ABOUT_TABS.find((one) => one === search.tab);
  return tab === undefined ? {} : { tab };
}

function aboutTabLink(tab: AboutTab) {
  return linkOptions({ to: "/about", search: { tab } });
}

export interface AboutTabLink {
  readonly key: AboutTab;
  readonly label: string;
  readonly link: ReturnType<typeof aboutTabLink>;
  readonly current: boolean;
}

/** The tabs, in order, `current` marking the one on screen. */
export function aboutTabLinks(current: AboutTab): readonly AboutTabLink[] {
  return ABOUT_TABS.map((tab) => ({
    key: tab,
    label: LABELS[tab],
    link: aboutTabLink(tab),
    current: tab === current,
  }));
}
