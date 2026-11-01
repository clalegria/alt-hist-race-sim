/**
 * The About page's tabs, as a search param (`/about?tab=whats-new`) like the
 * season page's (`season-tabs.ts`): a place in the address bar, checked, and
 * opening on the tab last left on when the URL names none.
 */

import { linkOptions } from "@tanstack/react-router";
import { tabMemory } from "./tab-memory.js";

export const ABOUT_TABS = ["about", "whats-new", "known-issues", "submit-bug"] as const;

export type AboutTab = (typeof ABOUT_TABS)[number];

const LABELS: Record<AboutTab, string> = {
  about: "About",
  "whats-new": "What's new",
  "known-issues": "Known issues",
  "submit-bug": "Submit bug",
};

const memory = tabMemory<AboutTab>("about", ABOUT_TABS);

/** The tab the page opens on when its URL names none: the one last left on. */
export const lastAboutTab = memory.last;

/** Notes the tab on screen, for the next visit that names none. */
export const rememberAboutTab = memory.remember;

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
