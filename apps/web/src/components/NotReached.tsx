import { Link } from "@tanstack/react-router";
import type { RunLink } from "../lib/run-places.js";
import type { Place } from "../lib/timeline.js";

/** A place in words, the way the breadcrumbs spell it. */
export function placeLabel(place: Place): string {
  const beat = place.beat;
  switch (beat.kind) {
    case "grid":
      return `${place.year} · Grid`;
    case "qualifying":
      return `${place.year} · Round ${beat.round + 1} · Qualifying`;
    case "race":
      return `${place.year} · Round ${beat.round + 1} · Race`;
    case "summary":
      return `${place.year} · Season summary`;
    case "review":
      return "The era's roll of honour";
  }
}

/**
 * A URL for a place the run will get to but has not yet: typed, or kept from
 * an older tab. Said rather than silently redirected, so the reader knows the
 * address was right and the run simply has not got there.
 *
 * The way there is Continue, in the run bar above, as on every page: **pages
 * read, the run bar acts.** The link back to the cursor is navigation, not an
 * action, so it belongs here.
 */
export function NotReached({
  place,
  cursor,
  link,
}: {
  place: Place;
  /** Where the run is, as the run bar says it. */
  cursor: string;
  /** The cursor's page. */
  link: RunLink;
}) {
  return (
    <section className="bg-card flex flex-col items-start gap-2 rounded-xl border p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Not reached yet</h1>
      <p className="text-muted-foreground text-sm">
        {placeLabel(place)} is still ahead of the run. Continue to get there.
      </p>
      <Link
        {...link}
        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
      >
        Back to where the run is: {cursor}
      </Link>
    </section>
  );
}
