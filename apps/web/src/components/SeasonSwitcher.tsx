import { adjacentSeason } from "../lib/seasons.js";
import { Button } from "./ui/button.js";

/**
 * The two seasons either side of this one, offered on the grid.
 *
 * A shortcut, not a navigation change: everything here can already be reached
 * by going Back and picking a year. What made it worth a control is where a
 * reader actually is when they want it — Restart season lands them on the grid,
 * and the thing they most often want next is the year before or the year after
 * the one they have just watched. Two clicks and a decade rail to answer a
 * question that is one button wide.
 *
 * On the grid stage and nowhere else, for the same reason `RatingModeToggle` is:
 * past it the reader has seen results that switching would throw away. It also
 * draws only in a standalone season — an era's year is decided by the run, and
 * a button that jumped out of it would be leaving the mode, not stepping within
 * it.
 *
 * The neighbours come from `adjacentSeason`, which walks the *playable* list
 * rather than adding one, so a year without seed data is skipped rather than
 * offered. Either side may be absent — at the ends of the range one button
 * draws alone, and the whole row is gone if a season is somehow the only one.
 */
export function SeasonSwitcher({
  year,
  onSwitch,
}: {
  year: number;
  /** Absent in tests, where nothing is clicked. The row still renders. */
  onSwitch?: (year: number) => void;
}) {
  const previous = adjacentSeason(year, -1);
  const next = adjacentSeason(year, 1);

  if (previous === null && next === null) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      <span>Another year</span>
      {previous === null ? null : (
        <Button
          variant="outline"
          className="h-8 px-3 text-xs"
          aria-label={`Simulate the ${previous} season instead`}
          onClick={() => {
            onSwitch?.(previous);
          }}
        >
          &larr; {previous}
        </Button>
      )}
      {next === null ? null : (
        <Button
          variant="outline"
          className="h-8 px-3 text-xs"
          aria-label={`Simulate the ${next} season instead`}
          onClick={() => {
            onSwitch?.(next);
          }}
        >
          {next} &rarr;
        </Button>
      )}
    </div>
  );
}
