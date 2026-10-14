import { Link, type LinkOptions } from "@tanstack/react-router";
import { cn } from "../lib/utils.js";
import { SEGMENTED_GROUP, type SegmentState, segmentClass } from "./ui/segmented.js";

/** One tab between places: the page on screen, a link to another, or a place not reached (`link` null). */
export interface TabLinkItem {
  readonly key: string;
  readonly label: string;
  readonly current: boolean;
  readonly link: LinkOptions | null;
}

/** One tab between panels on the same screen. */
export interface TabPanelItem {
  readonly key: string;
  readonly label: string;
  /** Something on its panel is changed: a dot after the label. */
  readonly marked?: boolean;
}

/** The panel tabs and which is showing; `idPrefix` pairs each tab with its panel (`tabIds`). */
export interface TabPanels {
  readonly items: readonly TabPanelItem[];
  readonly selected: string;
  readonly idPrefix: string;
  /** Absent in tests, where nothing is clicked. */
  readonly onPick?: (key: string) => void;
}

const TAB =
  "narrow px-2 py-1.5 text-sm font-bold whitespace-nowrap uppercase sm:px-3 sm:tracking-wide";

/** The ids a panel tab and its panel carry, for `aria-controls` and `aria-labelledby`. */
export function tabIds(idPrefix: string, key: string): { tab: string; panel: string } {
  return { tab: `${idPrefix}-tab-${key}`, panel: `${idPrefix}-panel-${key}` };
}

/**
 * The tab a key moves to from `current`, or null for a key that does not move:
 * ← and → step round, Home and End go to either end.
 */
export function nextTab(keys: readonly string[], current: string, key: string): string | null {
  const at = keys.indexOf(current);
  if (keys.length === 0 || at === -1) {
    return null;
  }
  switch (key) {
    case "ArrowRight":
      return keys[(at + 1) % keys.length] ?? null;
    case "ArrowLeft":
      return keys[(at - 1 + keys.length) % keys.length] ?? null;
    case "Home":
      return keys[0] ?? null;
    case "End":
      return keys.at(-1) ?? null;
    default:
      return null;
  }
}

/**
 * The app's one tab strip, drawn as a segmented control, in two kinds that
 * look the same and never mix.
 *
 * **`links`: tabs between places** (the season page, a round's sessions). A
 * `nav` of links: each tab is an address Back returns to. The tab on screen is
 * not a link, and a place ahead is words, never an `<a>` (`web-season-pages.md`).
 * `exact` keeps a link whose search is empty from counting as active on every
 * tab — TanStack otherwise matches search as a subset.
 *
 * **`panels`: tabs between panels on one screen** (the run settings dialog).
 * The WAI-ARIA tabs pattern: a `tablist` of buttons, only the selected one in
 * the Tab order, ← → Home End to move (`nextTab`), each paired with its panel
 * by `tabIds`. The caller draws the panels.
 */
export function Tabs({
  label,
  className,
  ...kind
}: {
  /** The strip's accessible name. */
  label: string;
  className?: string;
} & ({ links: readonly TabLinkItem[] } | { panels: TabPanels })) {
  if ("links" in kind) {
    return (
      <nav aria-label={label} className={cn(SEGMENTED_GROUP, className)}>
        {kind.links.map((tab) =>
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

  const { items, selected, idPrefix, onPick } = kind.panels;
  const keys = items.map((item) => item.key);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(SEGMENTED_GROUP, "max-w-full overflow-x-auto", className)}
      onKeyDown={(event) => {
        const next = nextTab(keys, selected, event.key);
        if (next !== null) {
          event.preventDefault();
          onPick?.(next);
          document.getElementById(tabIds(idPrefix, next).tab)?.focus();
        }
      }}
    >
      {items.map((item) => {
        const chosen = item.key === selected;
        const ids = tabIds(idPrefix, item.key);
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={chosen}
            aria-controls={ids.panel}
            tabIndex={chosen ? 0 : -1}
            onClick={() => {
              if (!chosen) {
                onPick?.(item.key);
              }
            }}
            className={segmentClass(chosen ? "chosen" : "idle", cn(TAB, "gap-1"))}
          >
            {item.label}
            {item.marked === true ? <ChangedDot state={chosen ? "chosen" : "idle"} /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The mark on a tab whose panel holds a change, in the label's colour on the chosen tab. */
function ChangedDot({ state }: { state: SegmentState }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          state === "chosen" ? "bg-primary-foreground" : "bg-primary",
        )}
      />
      <span className="sr-only">, changed</span>
    </>
  );
}
