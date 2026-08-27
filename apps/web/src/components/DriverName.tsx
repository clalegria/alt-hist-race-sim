import { driverCountry, driverName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { useEntryName } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { TeamBadge } from "./TeamBadge.js";

/**
 * A driver, as every table shows them: flag, name, and their team underneath.
 *
 * One component so the flag cannot end up in some tables and not others, and so
 * a change to how people are labelled happens in one place.
 */
export function DriverName({
  driverId,
  teamId,
  className,
  emphasis = false,
  badge = false,
}: {
  driverId: string | null;
  /** Omit to show the name alone, with no team line. */
  teamId?: string | undefined;
  className?: string;
  emphasis?: boolean;
  /**
   * Draw the team's livery badge left of the flag. Off by default and opted
   * into per table — the race classification wears it today. A badge on every
   * name in the app is a decision to make once it has been seen somewhere.
   */
  badge?: boolean;
}) {
  const nameOf = useEntryName();
  if (driverId === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const nationality = driverCountry(driverId);

  return (
    // The badge sits in a column of its own, outside the two text lines rather
    // than inside the first — so the team line keeps its one fixed inset and
    // nothing has to add a badge's width to it. An arithmetic indent was the
    // first attempt, and it also put a literal "+1em" in the class list, which
    // the classification's own "no gap on a retirement" test reads as a gap.
    <div className={cn("flex items-center gap-1.5", className)}>
      {badge && teamId !== undefined ? (
        // Centred against the whole two-line block, not against the name: the
        // badge belongs to the entry — driver, team and all — rather than to
        // the line of text it happens to start beside.
        <TeamBadge teamId={teamId} />
      ) : null}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          {nationality === undefined ? null : <Flag country={nationality} title={nationality} />}
          <span className={cn(emphasis && "font-semibold")}>{driverName(driverId)}</span>
        </span>
        {teamId === undefined ? null : (
          // Indented to start under the name rather than under the flag.
          <span className="text-muted-foreground pl-[1.625rem] text-xs">{nameOf(teamId)}</span>
        )}
      </div>
    </div>
  );
}
