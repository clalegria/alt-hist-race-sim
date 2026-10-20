import { eraSectionTabs, type RunSection } from "../lib/run-bar.js";
import { Tabs } from "./Tabs.js";

/**
 * The era's three sections as a tab strip, drawn like the season page's:
 * Champions, Drivers, Teams, with `current` the page on screen. Each is its own
 * page, so the strip is links and nothing remembers the last one (the sections
 * menu in the breadcrumbs reads the same list, `eraSectionTabs`).
 */
export function EraTabs({ current }: { current: RunSection }) {
  return <Tabs label="Era" className="self-start" links={eraSectionTabs(current)} />;
}
