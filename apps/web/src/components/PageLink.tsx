import { Link } from "@tanstack/react-router";
import type { RosterLink } from "../lib/roster-places.js";
import type { RunLink } from "../lib/run-places.js";

/**
 * The way from a name or a year to its page: a small box-and-arrow icon right
 * beside it, the mark Wikipedia puts on a link.
 *
 * Beside the thing it links rather than at the foot of a panel, because the
 * name or the year is where the reader is looking. The icon has no text, so the
 * link is named by `aria-label` for a screen reader and by `title` for a hover.
 * It is drawn by the stylesheet (`.page-link-icon` in `index.css`), so it adds
 * no `<svg>` to the markup.
 */
export function PageLink({ link, label }: { link: RosterLink | RunLink; label: string }) {
  return (
    <Link
      {...link}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-primary focus-visible:ring-ring inline-flex shrink-0 items-center rounded p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span aria-hidden="true" className="page-link-icon" />
    </Link>
  );
}
