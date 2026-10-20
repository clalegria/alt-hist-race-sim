import { Link } from "@tanstack/react-router";
import { driverCountry, driverName, teamName } from "../lib/names.js";
import { driversLink, teamsLink } from "../lib/roster-places.js";
import type { RunLink } from "../lib/run-places.js";
import type { Place } from "../lib/timeline.js";
import { useTeamCountryIn } from "./EntryNames.js";
import { PageHeading } from "./PageHeading.js";
import { TeamBadge } from "./TeamBadge.js";
import { buttonClass } from "./ui/button.js";
import { Card } from "./ui/card.js";

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
    <div className="flex flex-col gap-6">
      <header>
        <PageHeading title="Not reached yet" sub={placeLabel(place)} />
      </header>
      <Card className="flex flex-col items-start gap-2 p-4">
        <p className="text-muted-foreground text-sm">
          Still ahead of the run. Continue to get there.
        </p>
        <Link {...link} className={buttonClass("link", "-mx-1.5", "inline")}>
          Back to where the run is: {cursor}
        </Link>
      </Card>
    </div>
  );
}

/**
 * A driver's or team's address the run has not had: typed, or a tab kept from
 * before a restart. Said by name, like `NotReached`, rather than sent to the
 * index without a word. It promises nothing: a year is made only when the run
 * reaches it, so whether they will ever race in it is not known yet.
 */
export function NotInRun({ page, id }: { page: "driver" | "team"; id: string }) {
  const driver = page === "driver";
  const teamCountry = useTeamCountryIn();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <PageHeading
          title={driver ? driverName(id) : teamName(id)}
          flag={driver ? driverCountry(id) : teamCountry(id)}
          badge={driver ? undefined : <TeamBadge teamId={id} />}
          sub="Not in this run yet"
        />
      </header>
      <Card className="flex flex-col items-start gap-2 p-4">
        <p className="text-muted-foreground text-sm">Hasn't raced in this run so far.</p>
        <Link
          {...(driver ? driversLink() : teamsLink())}
          className={buttonClass("link", "-mx-1.5", "inline")}
        >
          {driver ? "All drivers in the run" : "All teams in the run"}
        </Link>
      </Card>
    </div>
  );
}
