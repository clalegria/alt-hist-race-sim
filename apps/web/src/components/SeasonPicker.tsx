import type { RandomnessLevel } from "@alt-hist/engine";
import { useState } from "react";
import { readRandomness, rememberRandomness } from "../lib/preferences.js";
import {
  DEFAULT_SEASON_YEAR,
  FIRST_SEASON,
  LAST_SEASON,
  PLAYABLE_SEASONS,
  playableSummary,
} from "../lib/seasons.js";
import { Preferences } from "./Preferences.js";
import { RandomnessSlider } from "./RandomnessSlider.js";
import { Button } from "./ui/button.js";
import { YearPicker } from "./YearPicker.js";

/**
 * The setup screen: which year to run, under what rules, and a button to go.
 *
 * **Nothing is simulated until the button at the foot of the page.** Picking a
 * year used to start the run on the spot, which made the preferences above it a
 * trap — a reader who reached for a year first, as most will, was into the
 * season before they had seen that randomness was theirs to choose. Every
 * control on this screen now only *answers* something; one button commits all
 * of it at once. That also means the year and the level are handed to `onStart`
 * together, so what was on screen is what gets simulated.
 *
 * The year picker itself is `YearPicker` — a rail of decades and the years in
 * one of them, controlled by the selected year alone. Randomness lives in
 * `Preferences`, which is named for the category rather than for its one
 * occupant because it is going to gain others.
 *
 * The level is seeded from the remembered preference and written back the
 * moment it moves — so it survives a reader who changes their mind about the
 * year, goes back to the menu, or comes back tomorrow. The *year* is
 * deliberately not remembered: it is the question the screen is asking, and
 * opening on wherever someone was last time is a different feature.
 *
 * One picker serves both modes. A season and an era ask the same question of
 * the same years and differ only in what the answer starts — which is copy, so
 * it arrives as copy rather than as a second component that would drift out of
 * step the first time the range changes.
 *
 * Nothing but the choice: the way back lives in the sticky bar, with every other
 * screen's navigation, and is `BackBar` in `App.tsx`.
 */
export function SeasonPicker({
  onStart,
  title = "Simulate a season",
  lead = `Pick the year to run. ${playableSummary()} — the rest of the grid is what this becomes.`,
  yearTitle = "Season",
  yearLead = `Every season from ${FIRST_SEASON} to ${LAST_SEASON}. Pick a decade, then a year in it.`,
  describeYear = (year: number) => `Simulate the ${year} season`,
  describeStart = (year: number) => `Begin the ${year} season`,
}: {
  onStart: (year: number, randomness: RandomnessLevel) => void;
  title?: string;
  lead?: string;
  /** The year panel's own heading, and the subtitle under it. */
  yearTitle?: string;
  yearLead?: string;
  /** The accessible label on a playable year's button. */
  describeYear?: (year: number) => string;
  /** What the button at the foot of the page says. */
  describeStart?: (year: number) => string;
}) {
  // Read once, on mount: this is the seed for the control, not a live mirror of
  // storage, and nothing else on the screen can change it underneath.
  const [randomness, setRandomness] = useState<RandomnessLevel>(readRandomness);
  const [year, setYear] = useState<number>(DEFAULT_SEASON_YEAR);

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {/*
          Capped, unlike the notes inside the panels below. This one is a real
          paragraph that runs to two or three lines and is read down, which is
          the case `max-w-prose` exists for; a single sentence sitting in a
          full-width card is not.
        */}
        <p className="text-muted-foreground max-w-prose text-sm">{lead}</p>
      </header>

      <YearPicker
        year={year}
        onSelect={setYear}
        title={yearTitle}
        lead={yearLead}
        describeYear={describeYear}
      />

      <Preferences>
        <RandomnessSlider
          level={randomness}
          onChange={(level) => {
            setRandomness(level);
            rememberRandomness(level);
          }}
        />
      </Preferences>

      {/*
        Full width and last on the page, because it is the only thing here that
        does anything: everything above it is a question, and this is the answer
        being handed over. It names the year it will start so the commitment is
        legible without scrolling back up to check which button is lit.
      */}
      <Button
        className="h-12 w-full text-base"
        onClick={() => {
          onStart(year, randomness);
        }}
      >
        {describeStart(year)}
      </Button>
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
      lead={`Pick the year the era starts from. It runs on from there season by season — each year on the grid that year actually had — for as long as you keep going, or until ${PLAYABLE_SEASONS.at(-1) ?? ""}. ${playableSummary()}.`}
      yearTitle="Starting season"
      yearLead="Where the era begins. Pick a decade, then a year in it — it runs on from there."
      describeYear={(year) => `Start an era in ${year}`}
      describeStart={(year) => `Begin an era from ${year}`}
    />
  );
}
