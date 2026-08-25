import { isPlayable, PLAYABLE_SEASONS, playableSummary, SEASON_YEARS } from "../lib/seasons.js";
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
 *
 * One picker serves both modes. A season and an era ask the same question of
 * the same years and differ only in what the answer starts — which is copy, so
 * it arrives as copy rather than as a second component that would drift out of
 * step the first time the range changes.
 */
export function SeasonPicker({
  onStart,
  title = "Simulate a season",
  lead = `Pick the year to run. ${playableSummary()} — the rest of the grid is what this becomes.`,
  describeYear = (year: number) => `Simulate the ${year} season`,
}: {
  onStart: (year: number) => void;
  title?: string;
  lead?: string;
  /** The accessible label on a playable year's button. */
  describeYear?: (year: number) => string;
}) {
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{lead}</p>
      </header>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {SEASON_YEARS.map((year) => {
          const playable = isPlayable(year);
          return (
            <button
              key={year}
              type="button"
              disabled={!playable}
              aria-label={playable ? describeYear(year) : `${year} is not available yet`}
              onClick={() => {
                onStart(year);
              }}
              className={cn(
                "focus-visible:ring-ring h-11 rounded-md border text-sm font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                playable
                  ? "border-primary/50 bg-primary/10 text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
                  : "border-border text-subtle cursor-not-allowed",
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

/**
 * The picker as the era mode asks the question: which year the run starts from.
 *
 * The year it can run to is read off the authored seasons rather than written
 * into the sentence: "until 2026" is only true until a later one is authored,
 * and it is where the era actually stops — see `nextEraYear`.
 */
export function EraPicker({ onStart }: { onStart: (year: number) => void }) {
  return (
    <SeasonPicker
      onStart={onStart}
      title="Simulate an era"
      lead={`Pick the year the era starts from. It runs on from there season by season — each year on the grid that year actually had — for as long as you keep going, or until ${PLAYABLE_SEASONS.at(-1) ?? ""}. ${playableSummary()}.`}
      describeYear={(year) => `Start an era in ${year}`}
    />
  );
}
