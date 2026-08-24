import { isPlayable, playableSummary, SEASON_YEARS } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";

/**
 * Which year to start from.
 *
 * Every season in the range is listed, and the ones without seed data are
 * disabled. Showing the whole range rather than the years that work is
 * deliberate: it says what the app is for, and it means adding a season is a
 * file of data rather than a redesign. `isPlayable` is the only thing that
 * decides which are live and `playableSummary` writes the subtitle, so neither
 * the buttons nor the copy can fall out of step with the data.
 *
 * Nothing but the choice: the way back lives in the sticky bar, with every other
 * screen's navigation, and is `BackBar` in `App.tsx`.
 */
export function SeasonPicker({ onStart }: { onStart: (year: number) => void }) {
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simulate a season</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Pick the year to run. {playableSummary()} — the rest of the grid is what this becomes.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {SEASON_YEARS.map((year) => {
          const playable = isPlayable(year);
          return (
            <button
              key={year}
              type="button"
              disabled={!playable}
              aria-label={playable ? `Simulate the ${year} season` : `${year} is not available yet`}
              onClick={() => {
                onStart(year);
              }}
              className={cn(
                "focus-visible:ring-ring h-11 rounded-md border text-sm font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                playable
                  ? "border-primary/50 bg-primary/10 text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
                  : "border-border text-muted-foreground/50 cursor-not-allowed",
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
