import { STANDOUT_BORDER, STANDOUT_TEXT } from "../lib/highlight.js";
import { count } from "../lib/history.js";
import { cn } from "../lib/utils.js";

/** What the tooltip calls a title: "3 drivers' titles", "1 constructors' title". */
export function titlesLabel(titles: number, kind: "driver" | "team"): string {
  const title = kind === "driver" ? "drivers' title" : "constructors' title";
  return count(titles, title, `${title}s`);
}

/**
 * The trophy after a champion's name: the trophy alone for one title, with a
 * count (`×3`) from two, and **nothing at all** for none, as the home star
 * draws nothing for a visitor.
 *
 * A trophy rather than a row of stars, which would clash with the home star.
 * Teal, because a title is the thing the accent means: won. Drawn by the
 * stylesheet (`.trophy-icon`), so it adds no `<svg>` beside a name.
 *
 * It counts only the titles this run has simulated; *Historical career
 * records* (`docs/ROADMAP.md`) will add each career's opening balance to it.
 */
export function TitleCount({
  titles,
  kind,
  size = "inline",
  className,
}: {
  titles: number;
  kind: "driver" | "team";
  /** `heading` beside a page's `<h1>`; `inline` beside a name in a table. */
  size?: "inline" | "heading";
  className?: string;
}) {
  if (titles < 1) {
    return null;
  }
  const label = titlesLabel(titles, kind);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 border font-mono font-semibold tracking-normal normal-case tabular-nums",
        STANDOUT_TEXT,
        STANDOUT_BORDER,
        size === "heading" ? "px-1.5 py-0.5 text-base leading-none" : "px-1 text-xs leading-4",
        className,
      )}
    >
      <span aria-hidden="true" className="trophy-icon" />
      {titles > 1 ? `×${titles}` : null}
    </span>
  );
}
