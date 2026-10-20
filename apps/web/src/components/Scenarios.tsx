import { type ReactNode, useState } from "react";
import { type Preset, presetsFor } from "../lib/presets.js";
import {
  type RunSettings,
  type RunUnit,
  sameSettings,
  seasonSettings,
  settingsInForce,
} from "../lib/run-settings.js";
import { cn, DISPLAY_CAPS } from "../lib/utils.js";
import { defaultChoice, type RunChoice } from "./RunSettingsDialog.js";
import { RunSettingsButton, SettingsSummary } from "./RunSettingsLine.js";
import { Card, CardBand } from "./ui/card.js";

/**
 * A preset applied to a choice: everything back to what Restore defaults puts
 * it to (`defaultChoice`), then the preset's own answers. A season's screen
 * keeps the era-only answers it does not show, as Restore defaults does.
 */
export function presetChoice(preset: Preset, choice: RunChoice, unit: RunUnit): RunChoice {
  const defaults = defaultChoice(choice, unit === "era");
  return {
    randomness: preset.randomness ?? defaults.randomness,
    ratingMode: unit === "era" ? defaults.ratingMode : (preset.ratingMode ?? defaults.ratingMode),
    settings: { ...defaults.settings, ...preset.settings },
  };
}

/** The settings as the screen runs them: a season's only, and only what is in force. */
function shown(settings: RunSettings, unit: RunUnit): RunSettings {
  return settingsInForce(unit === "era" ? settings : seasonSettings(settings));
}

/**
 * The preset a choice is on, or null when it is on none: the one whose answers
 * it gives, read as the screen runs them. Derived rather than remembered, so
 * it can never disagree with the settings it names.
 */
export function chosenPreset(choice: RunChoice, unit: RunUnit): Preset | null {
  return (
    presetsFor(unit).find((preset) => {
      const applied = presetChoice(preset, choice, unit);
      return (
        applied.randomness === choice.randomness &&
        applied.ratingMode === choice.ratingMode &&
        sameSettings(shown(applied.settings, unit), shown(choice.settings, unit))
      );
    }) ?? null
  );
}

/** What the description says when Custom is lit. */
export const OWN_MIX = "Your own mix of settings.";

/** The line above the rows, saying what they are. */
export const SCENARIOS_INTRO = "Pick a scenario to start from, or open Settings to make your own.";

/** One row of the list: a bar down its left edge, lit when `lit`. */
function ScenarioRow({
  lit,
  title,
  onClick,
  dialog = false,
  children,
}: {
  lit: boolean;
  title: string;
  onClick: () => void;
  /** Whether a press opens a dialog rather than picking. */
  dialog?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={lit}
      {...(dialog ? { "aria-haspopup": "dialog" } : {})}
      title={title}
      onClick={onClick}
      className={cn(
        "group ring-border focus-visible:ring-ring grid grid-cols-[0.375rem_minmax(0,1fr)] gap-3 pr-3 text-left ring-1 transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed",
        lit ? "bg-primary/12 disabled:bg-muted" : "hover:not-disabled:bg-accent cursor-pointer",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("self-stretch", lit ? "bg-primary group-disabled:bg-subtle" : "bg-border")}
      />
      <span className={cn(DISPLAY_CAPS, "group-disabled:text-subtle py-2 text-base leading-tight")}>
        {children}
      </span>
    </button>
  );
}

/**
 * The scenarios a screen offers, as a tower of titled rows like Home's modes,
 * then **Custom**, and under them what the lit one does — the luck slider's
 * shape, one description at a time, so the rows stay one line each. Picking is
 * free until the run begins, so a reader browses by clicking; each row also
 * carries its description as a tooltip.
 *
 * Always exactly one row lit, as a graphics menu's Low / High / Custom: the
 * preset the answers equal (`chosenPreset`), or Custom when they equal none.
 * Custom picks nothing; pressing it opens the settings (`onCustom`).
 *
 * `aria-pressed` buttons, like the year picker's, since each one acts the
 * moment it is pressed. `columns` lays the rows out.
 */
export function PresetList({
  choice,
  unit,
  columns = "sm:grid-cols-2",
  onPick,
  onCustom,
}: {
  choice: RunChoice;
  unit: RunUnit;
  columns?: string;
  /** Absent in tests, where nothing is clicked. */
  onPick?: (choice: RunChoice) => void;
  /** Absent in tests, where nothing is clicked. */
  onCustom?: () => void;
}) {
  const chosen = chosenPreset(choice, unit);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{SCENARIOS_INTRO}</p>
      {/* Every row ringed in the border colour, so neighbours meet in the gap as one line. */}
      <fieldset
        aria-label="Scenarios"
        className={cn("m-0 grid min-w-0 gap-px border-0 p-px", columns)}
      >
        {presetsFor(unit).map((preset) => {
          const lit = preset.id === chosen?.id;
          return (
            <ScenarioRow
              key={preset.id}
              lit={lit}
              title={preset.blurb(unit)}
              onClick={() => {
                if (!lit) {
                  onPick?.(presetChoice(preset, choice, unit));
                }
              }}
            >
              {preset.name}
            </ScenarioRow>
          );
        })}
        <ScenarioRow lit={chosen === null} title={OWN_MIX} dialog onClick={() => onCustom?.()}>
          Custom
        </ScenarioRow>
      </fieldset>
      {/* Polite: a pick is announced after the press itself. */}
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {chosen?.blurb(unit) ?? OWN_MIX}
      </p>
    </div>
  );
}

/**
 * The setup screen's *Scenarios* card: the scenarios, the ⚙ button that opens
 * every setting in its band, and what is in force at its foot — the grid's
 * settings line, folded into the one card about how the run is simulated. A
 * pick commits at once, like Restore defaults; nothing is simulated until
 * Begin. Custom opens the same dialog as the ⚙ button.
 */
export function ScenarioCard({
  choice,
  year,
  unit,
  onCommit,
}: {
  choice: RunChoice;
  /** The selected year, which the dialog's Points names the table of. */
  year: number;
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onCommit?: (choice: RunChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const settings = {
    choice,
    unit,
    eraSettings: unit === "era",
    ...(onCommit === undefined ? {} : { onCommit }),
  };
  return (
    <Card>
      <CardBand title="Scenarios">
        <RunSettingsButton {...settings} year={year} open={open} onOpenChange={setOpen} />
      </CardBand>
      <div className="px-5 py-4">
        <PresetList
          choice={choice}
          unit={unit}
          // Two across a full-width card; one in the wide screen's half.
          columns="sm:grid-cols-2 lg:grid-cols-1"
          onCustom={() => {
            setOpen(true);
          }}
          {...(onCommit === undefined ? {} : { onPick: onCommit })}
        />
      </div>
      <SettingsSummary {...settings} className="border-border border-t px-5 py-2.5" />
    </Card>
  );
}
