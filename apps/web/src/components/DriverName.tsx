import { driversById } from "@alt-hist/data";
import { driverName, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";

const drivers = driversById();

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
}: {
  driverId: string | null;
  /** Omit to show the name alone, with no team line. */
  teamId?: string | undefined;
  className?: string;
  emphasis?: boolean;
}) {
  if (driverId === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const nationality = drivers.get(driverId)?.nationality;

  return (
    <div className={cn("flex flex-col leading-tight", className)}>
      <span className="flex items-center gap-1.5">
        {nationality === undefined ? null : <Flag country={nationality} title={nationality} />}
        <span className={cn(emphasis && "font-semibold")}>{driverName(driverId)}</span>
      </span>
      {teamId === undefined ? null : (
        <span className="text-muted-foreground pl-[1.625rem] text-xs">{teamName(teamId)}</span>
      )}
    </div>
  );
}
