import type { RandomnessLevel } from "@alt-hist/engine";
import { useState } from "react";
import { readRandomness, rememberRandomness } from "../lib/preferences.js";
import { isPlayable, PLAYABLE_SEASONS, playableSummary, SEASON_YEARS } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { RandomnessSlider } from "./RandomnessSlider.js";

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
 *
 * The randomness slider is the second half of the question, and it is here in
 * both modes for the same reason the year is: picking a year *starts* the run,
 * so anything that has to be decided first has to be decided on this screen.
 * The level lives in component state seeded from the remembered preference and
 * is written back the moment it moves — so it survives a reader who changes
 * their mind about the year, goes back to the menu, or comes back tomorrow —
 * and it is handed to `onStart` explicitly rather than re-read from storage, so
 * what was on screen is what gets simulated.
 */
export function SeasonPicker({
  onStart,
  randomnessLead,
  title = "Simulate a season",
  lead = `Pick the year to run. ${playableSummary()} — the rest of the grid is what this becomes.`,
  describeYear = (year: number) => `Simulate the ${year} season`,
}: {
  onStart: (year: number, randomness: RandomnessLevel) => void;
  /** One line under the slider, where the two modes differ on what it binds. */
  randomnessLead?: string;
  title?: string;
  lead?: string;
  /** The accessible label on a playable year's button. */
  describeYear?: (year: number) => string;
}) {
  // Read once, on mount: this is the seed for the control, not a live mirror of
  // storage, and nothing else on the screen can change it underneath.
  const [randomness, setRandomness] = useState<RandomnessLevel>(readRandomness);

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{lead}</p>
      </header>

      <div className="flex flex-col gap-2">
        <RandomnessSlider
          level={randomness}
          onChange={(level) => {
            setRandomness(level);
            rememberRandomness(level);
          }}
        />
        {randomnessLead === undefined ? null : (
          <p className="text-muted-foreground max-w-prose text-xs">{randomnessLead}</p>
        )}
      </div>

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
                onStart(year, randomness);
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
export function EraPicker({
  onStart,
}: {
  onStart: (year: number, randomness: RandomnessLevel) => void;
}) {
  return (
    <SeasonPicker
      onStart={onStart}
      title="Simulate an era"
      randomnessLead="Chosen once: every season of the era is raced at this level, and it cannot be changed part-way through a run."
      lead={`Pick the year the era starts from. It runs on from there season by season — each year on the grid that year actually had — for as long as you keep going, or until ${PLAYABLE_SEASONS.at(-1) ?? ""}. ${playableSummary()}.`}
      describeYear={(year) => `Start an era in ${year}`}
    />
  );
}
