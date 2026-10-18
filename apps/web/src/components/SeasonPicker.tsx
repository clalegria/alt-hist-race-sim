import type { RandomnessLevel } from "@alt-hist/engine";
import { useState } from "react";
import {
  readRandomness,
  readRatingMode,
  readRunSettings,
  readSeasonYear,
  rememberRandomness,
  rememberRatingMode,
  rememberRunSettings,
  rememberSeasonYear,
} from "../lib/preferences.js";
import type { RunSettings, RunUnit } from "../lib/run-settings.js";
import { FIRST_SEASON, LAST_SEASON, PLAYABLE_SEASONS } from "../lib/seasons.js";
import { ERA_RATING_MODE } from "../store/season.js";
import { PageHeading } from "./PageHeading.js";
import type { RunChoice } from "./RunSettingsDialog.js";
import { Button } from "./ui/button.js";
import { WhatIfCard } from "./WhatIfPresets.js";
import { YearPicker } from "./YearPicker.js";

/**
 * The setup screen: which year to run, under what rules, and a button to go.
 *
 * **Nothing is simulated until the button under the year.** Every control on
 * this screen only *answers* something; one button commits all of it at once,
 * so the year and the settings reach `onStart` together and what was on screen
 * is what gets simulated.
 *
 * Two cards: the year (`YearPicker`, a rail of decades and the years in one of
 * them, controlled by the selected year alone) and *What if?* (`WhatIfCard`:
 * the presets, the ⚙ button that opens every setting, and what is in force).
 * One column, year first, then What if?, then the button; from `lg` the year
 * and the button on the left and What if? on the right, as Home splits, so a
 * laptop sees the whole screen without scrolling.
 *
 * Every answer is seeded from the remembered preference and written back when
 * it is given — a year on the moment it is picked, the settings when a preset
 * is picked or the dialog is closed with Done — so they survive a reader who
 * goes back to the menu, or who comes back tomorrow. See `readSeasonYear`.
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
  yearTitle = "Season",
  yearLead = `Every season from ${FIRST_SEASON} to ${LAST_SEASON}. Pick a decade, then a year in it.`,
  describeYear = (year: number) => `Simulate the ${year} season`,
  describeStart = (year: number) => `Begin the ${year} season`,
  unit = "season",
}: {
  onStart: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void;
  title?: string;
  /** The year panel's own heading, and the how-to under it: the page's only lead. */
  yearTitle?: string;
  yearLead?: string;
  /** The accessible label on a playable year's button. */
  describeYear?: (year: number) => string;
  /** What the button under the year says. */
  describeStart?: (year: number) => string;
  /**
   * What the settings are fixed for, which their copy follows. An era's screen
   * offers the era-only settings; a season's hides them, and the store drops
   * them from a season (`seasonSettings`) whatever is remembered.
   */
  unit?: RunUnit;
}) {
  // Read once, on mount: this is the seed for the controls, not a live mirror
  // of storage, and nothing else on the screen can change it underneath.
  // An era always runs drivers as they were, and its screen does not offer the
  // choice, so it neither reads nor remembers the season's.
  const [choice, setChoice] = useState<RunChoice>(() => ({
    randomness: readRandomness(),
    ratingMode: unit === "season" ? readRatingMode() : ERA_RATING_MODE,
    settings: readRunSettings(),
  }));
  // Read once on mount for the same reason, and validated in `readSeasonYear`
  // against the playable list — a stored year with no seed file behind it would
  // reach `seasonSeed` and throw.
  const [year, setYear] = useState<number>(readSeasonYear);
  const commit = (changed: RunChoice) => {
    setChoice(changed);
    rememberRandomness(changed.randomness);
    rememberRunSettings(changed.settings);
    if (unit === "season") {
      rememberRatingMode(changed.ratingMode);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeading title={title} />

      {/*
        One grid for both layouts, in reading order: year, What if?, button. From
        `lg` What if? spans both rows on the right, and the button sits under
        the year, the second row taking any height What if? needs.
      */}
      <div className="grid gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-1 lg:row-start-1">
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
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <WhatIfCard choice={choice} year={year} unit={unit} onCommit={commit} />
        </div>

        {/*
          Full width of its column, and after every question, because it is the
          only thing here that does anything: this is the answer being handed
          over. It names the year it will start so the commitment is legible
          without looking back to check which button is lit.
        */}
        <Button
          className="h-12 w-full text-base lg:col-start-1 lg:row-start-2"
          onClick={() => {
            onStart(year, choice.randomness, choice.settings);
          }}
        >
          {describeStart(year)}
        </Button>
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
  onStart: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void;
}) {
  return (
    <SeasonPicker
      onStart={onStart}
      title="Simulate an era"
      yearTitle="Starting season"
      yearLead={`Pick the year to start from. The era carries on one season at a time, for as long as you like or until ${PLAYABLE_SEASONS.at(-1) ?? ""}.`}
      describeYear={(year) => `Start an era in ${year}`}
      describeStart={(year) => `Begin an era starting in ${year}`}
      unit="era"
    />
  );
}
