import { driverCountry, driverName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { useEntryName } from "./EntryNames.js";
import { FittedDriverName, SplitName } from "./FittedName.js";
import { Flag } from "./Flag.js";
import { TeamBadge } from "./TeamBadge.js";

/**
 * The indent that sets the team line under the name rather than under the flag.
 *
 * Exported as a marker, the way `BADGE_SHAPE` is: it is how a test asks whether
 * a table drew the team line at all, and the career records deliberately do not
 * — a driver's era is not one team's.
 */
export const TEAM_LINE = "pl-[1.625rem]";

/**
 * A driver, as every table shows them: flag, name in `SplitName`'s timing-screen
 * style, and their team underneath, plain.
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
  tight = false,
}: {
  driverId: string | null;
  /** Omit to show the name alone, with no team line. */
  teamId?: string | undefined;
  className?: string;
  emphasis?: boolean;
  /**
   * Fit the two lines to the width they are given instead of taking the width
   * the name wants: the driver shortens to initials, the team line ends in an
   * ellipsis, and both keep the full text as a `title`.
   *
   * Opted into per table rather than always on, because it is a trade and the
   * right side of it depends on the column. In the sidebar the name is beside a
   * race result and the column cannot grow, so a sixties entry — "Lola-Coventry
   * Climax" — put a scrollbar under an eight-row table. The full classification
   * has the opposite deal: the name column takes the slack and **wraps**, which
   * costs a line of height and loses nothing, so it does not ask for this.
   */
  tight?: boolean;
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
    //
    // Spans rather than divs, both of them: `SeasonHistory` puts this whole
    // block inside a `<button>`, which may only contain phrasing content. The
    // layout is unchanged — `flex` is a display, and a span takes it as
    // happily as a div does.
    <span className={cn("flex items-center gap-1.5", tight && "min-w-0", className)}>
      {badge && teamId !== undefined ? (
        // Centred against the whole two-line block, not against the name: the
        // badge belongs to the entry — driver, team and all — rather than to
        // the line of text it happens to start beside.
        <TeamBadge teamId={teamId} />
      ) : null}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex min-w-0 items-center gap-1.5">
          {nationality === undefined ? null : <Flag country={nationality} title={nationality} />}
          {tight ? (
            <FittedDriverName
              driverId={driverId}
              className={cn(emphasis && "font-semibold")}
              split
            />
          ) : (
            <span className={cn(emphasis && "font-semibold")}>
              <SplitName name={driverName(driverId)} />
            </span>
          )}
        </span>
        {teamId === undefined ? null : (
          // Indented to start under the name rather than under the flag.
          <span
            className={cn("text-muted-foreground text-xs", TEAM_LINE, tight && "truncate")}
            {...(tight ? { title: nameOf(teamId) } : {})}
          >
            {nameOf(teamId)}
          </span>
        )}
      </span>
    </span>
  );
}
