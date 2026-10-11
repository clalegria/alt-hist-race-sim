import type { RandomnessLevel } from "@alt-hist/engine";
import { useState } from "react";
import {
  readRandomness,
  readRunSettings,
  readSeasonYear,
  rememberRandomness,
  rememberRunSettings,
  rememberSeasonYear,
} from "../lib/preferences.js";
import type { RunSettings, RunUnit } from "../lib/run-settings.js";
import { FIRST_SEASON, LAST_SEASON, PLAYABLE_SEASONS } from "../lib/seasons.js";
import type { RunChoice } from "./RunSettingsDialog.js";
import { RunSettingsLine } from "./RunSettingsLine.js";
import { Button } from "./ui/button.js";
import { YearPicker } from "./YearPicker.js";

/**
 * The setup screen: which year to run, under what rules, and a button to go.
 *
 * **Nothing is simulated until the button at the foot of the page.** Every
 * control on this screen only *answers* something; one button commits all of
 * it at once, so the year and the settings reach `onStart` together and what
 * was on screen is what gets simulated.
 *
 * The year picker is `YearPicker` — a rail of decades and the years in one of
 * them, controlled by the selected year alone. The run settings are a line
 * under the heading (`RunSettingsLine`) whose ⚙ button opens them in a dialog,
 * the same line in the same place the grid has.
 *
 * Every answer is seeded from the remembered preference and written back when
 * it is given — a year on the moment it is picked, the settings when the dialog
 * is closed with Done — so they survive a reader who goes back to the menu, or
 * who comes back tomorrow. See `readSeasonYear`.
 *
 * One picker serves both modes. A season and an era ask the same question of
 * the same years and differ only in what the answer starts — which is copy, so
 * it arrives as copy rather than as a second component that would drift out of
 * step the first time the range changes.
 *
 * Nothing but the choice: there is no bar on a setup page — the run bar starts
 * at the grid — and the top nav is the way elsewhere.
 */
export function SeasonPicker({
  onStart,
  title = "Simulate a season",
  lead = "Pick the year to run.",
  yearTitle = "Season",
  yearLead = `Every season from ${FIRST_SEASON} to ${LAST_SEASON}. Pick a decade, then a year in it.`,
  describeYear = (year: number) => `Simulate the ${year} season`,
  describeStart = (year: number) => `Begin the ${year} season`,
  unit = "season",
  eraSettings = false,
}: {
  onStart: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void;
  title?: string;
  lead?: string;
  /** The year panel's own heading, and the subtitle under it. */
  yearTitle?: string;
  yearLead?: string;
  /** The accessible label on a playable year's button. */
  describeYear?: (year: number) => string;
  /** What the button at the foot of the page says. */
  describeStart?: (year: number) => string;
  /** What the settings are fixed for, which their copy follows. */
  unit?: RunUnit;
  /**
   * Whether to offer the era-only settings. A season's screen hides them, and
   * the store drops them from a season (`seasonSettings`) whatever is remembered.
   */
  eraSettings?: boolean;
}) {
  // Read once, on mount: this is the seed for the controls, not a live mirror
  // of storage, and nothing else on the screen can change it underneath.
  const [choice, setChoice] = useState<RunChoice>(() => ({
    randomness: readRandomness(),
    settings: readRunSettings(),
  }));
  // Read once on mount for the same reason, and validated in `readSeasonYear`
  // against the playable list — a stored year with no seed file behind it would
  // reach `seasonSeed` and throw.
  const [year, setYear] = useState<number>(readSeasonYear);

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

      <RunSettingsLine
        choice={choice}
        year={year}
        unit={unit}
        eraSettings={eraSettings}
        onCommit={(changed) => {
          setChoice(changed);
          rememberRandomness(changed.randomness);
          rememberRunSettings(changed.settings);
        }}
      />

      <YearPicker
        year={year}
        onSelect={(picked) => {
          setYear(picked);
          rememberSeasonYear(picked);
        }}
        title={yearTitle}
        lead={yearLead}
        describeYear={describeYear}
      />

      {/*
        Full width and last on the page, because it is the only thing here that
        does anything: everything above it is a question, and this is the answer
        being handed over. It names the year it will start so the commitment is
        legible without scrolling back up to check which button is lit.
      */}
      <Button
        className="h-12 w-full text-base"
        onClick={() => {
          onStart(year, choice.randomness, choice.settings);
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
  onStart: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void;
}) {
  return (
    <SeasonPicker
      onStart={onStart}
      title="Simulate an era"
      lead={`Pick the year to start from. The era carries on one season at a time, for as long as you like or until ${PLAYABLE_SEASONS.at(-1) ?? ""}.`}
      yearTitle="Starting season"
      yearLead="Pick a decade, then a year."
      describeYear={(year) => `Start an era in ${year}`}
      describeStart={(year) => `Begin an era from ${year}`}
      unit="era"
      eraSettings
    />
  );
}
