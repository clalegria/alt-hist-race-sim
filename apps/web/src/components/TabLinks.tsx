import { Link, type LinkOptions } from "@tanstack/react-router";
import { cn } from "../lib/utils.js";
import { SEGMENTED_GROUP, segmentClass } from "./ui/segmented.js";

/** One tab: the page on screen, a link to another, or a place not reached (`link` null). */
export interface TabLinkItem {
  readonly key: string;
  readonly label: string;
  readonly current: boolean;
  readonly link: LinkOptions | null;
}

const TAB = "narrow px-3 py-1.5 text-sm font-bold tracking-wide uppercase";

/**
 * Tabs between places, drawn as a segmented control: the tab on screen is not a
 * link, and a place ahead is words, never an `<a>` (`web-season-pages.md`).
 * `exact` keeps a link whose search is empty from counting as active on every
 * tab — TanStack otherwise matches search as a subset.
 */
export function TabLinks({
  label,
  tabs,
  className,
}: {
  /** The nav's accessible name. */
  label: string;
  tabs: readonly TabLinkItem[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(SEGMENTED_GROUP, className)}>
      {tabs.map((tab) =>
        tab.current ? (
          <span key={tab.key} aria-current="page" className={segmentClass("chosen", TAB)}>
            {tab.label}
          </span>
        ) : tab.link === null ? (
          <span
            key={tab.key}
            aria-disabled="true"
            title="Not reached yet"
            className={segmentClass("disabled", TAB)}
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            {...tab.link}
            activeOptions={{ exact: true }}
            className={segmentClass("idle", TAB)}
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
