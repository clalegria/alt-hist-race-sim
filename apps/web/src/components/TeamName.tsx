import { cn } from "../lib/utils.js";
import { useEntryName, useTeamCountry } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { TeamBadge } from "./TeamBadge.js";

/**
 * A team with the flag of its base, mirroring `DriverName`.
 *
 * One component for the same reason: a flag that appears in one table and not
 * another reads as a bug, and this is the only place to change how teams are
 * labelled — including whether the engine is named alongside the chassis.
 */
export function TeamName({
  teamId,
  emphasis = false,
  className,
  badge = false,
  tight = false,
}: {
  teamId: string;
  emphasis?: boolean;
  className?: string;
  /** Draw the team's livery badge left of the flag. Opted into per table. */
  badge?: boolean;
  /** End the name in an ellipsis rather than widen the column. See `DriverName`. */
  tight?: boolean;
}) {
  const base = useTeamCountry()(teamId);
  const nameOf = useEntryName();
  return (
    <span className={cn("flex items-center gap-1.5", tight && "min-w-0", className)}>
      {badge ? <TeamBadge teamId={teamId} /> : null}
      {base === undefined ? null : <Flag country={base} title={base} />}
      <span
        className={cn(emphasis && "font-semibold", tight && "truncate")}
        {...(tight ? { title: nameOf(teamId) } : {})}
      >
        {nameOf(teamId)}
      </span>
    </span>
  );
}
