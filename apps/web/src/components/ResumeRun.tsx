import { Link } from "@tanstack/react-router";
import type { RunLink } from "../lib/run-places.js";

/**
 * The way back into a run from Home, while one is in progress.
 *
 * Going Home does not end a run — it waits, and this card is where it waits.
 * A `Link` to the cursor's page rather than a button, so it is a real address
 * that can be opened in a new tab, styled as the mode cards beside it are.
 */
export function ResumeRun({
  title,
  detail,
  link,
}: {
  /** Which run: "Era from 1980", "1984 season". */
  title: string;
  /** How far it has got, as the run bar says it. */
  detail: string;
  link: RunLink;
}) {
  return (
    <Link
      {...link}
      className="bg-card border-primary/60 hover:bg-accent focus-visible:ring-ring flex flex-col items-start gap-1 rounded-xl border p-5 text-left shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        Resume run
      </span>
      <span className="text-base font-semibold tracking-tight">{title}</span>
      <span className="text-muted-foreground text-sm">{detail}</span>
    </Link>
  );
}
