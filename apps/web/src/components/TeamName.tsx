import { teamsById } from "@alt-hist/data";
import { teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";

const teams = teamsById();

/**
 * A team with the flag of its base, mirroring `DriverName`.
 *
 * One component for the same reason: a flag that appears in one table and not
 * another reads as a bug, and this is the only place to change how teams are
 * labelled.
 */
export function TeamName({
  teamId,
  emphasis = false,
  className,
}: {
  teamId: string;
  emphasis?: boolean;
  className?: string;
}) {
  const base = teams.get(teamId)?.base;
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {base === undefined ? null : <Flag country={base} title={base} />}
      <span className={cn(emphasis && "font-semibold")}>{teamName(teamId)}</span>
    </span>
  );
}
