import { type ReactNode, useState } from "react";
import { type RunUnit, seasonSettings } from "../lib/run-settings.js";
import { cn } from "../lib/utils.js";
import { defaultChoice, type RunChoice, RunSettingsDialog } from "./RunSettingsDialog.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { Button } from "./ui/button.js";
import { Card } from "./ui/card.js";

/** What the settings parts read: the choice, the screen it is on, and how a change is committed. */
interface SettingsProps {
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  /** Why the settings cannot be changed, or null when they can. */
  lock?: string | null;
  onCommit?: (choice: RunChoice) => void;
}

/**
 * What a run is set up with, in one line (`SimulationSettings`).
 *
 * **Restore defaults** follows the settings when anything differs from them
 * and they can still change: one commit, unasked, like the dialog's Done.
 */
export function SettingsSummary({
  choice,
  unit,
  eraSettings = false,
  lock = null,
  onCommit,
  className,
}: Omit<SettingsProps, "year"> & { className?: string }) {
  // A season's screen states only what a season races: the remembered set can
  // hold an era's answers too.
  const inForce = unit === "season" ? seasonSettings(choice.settings) : choice.settings;
  const lines = settingsOf({ ...choice, settings: inForce });
  return (
    <div className={cn("text-muted-foreground min-w-0 text-xs", className)}>
      <SimulationSettings settings={lines} className="inline" />
      {lines.length > 0 && lock === null && onCommit !== undefined ? (
        <Button
          variant="link"
          size="inline"
          className="-my-0.5 ml-1.5"
          onClick={() => {
            onCommit(defaultChoice(choice, eraSettings));
          }}
        >
          Restore defaults
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The ⚙ button that opens the run settings dialog.
 *
 * The cog is drawn by the stylesheet (`.settings-icon`, a mask over
 * `currentColor`) rather than as an `<svg>`, because the tests count a table's
 * flags by counting `<svg>` — the page link's icon is drawn the same way.
 *
 * `lock` opens the dialog read-only, with the reason; the button itself stays
 * live, since seeing what a run was set up with is still worth a click.
 *
 * Holds whether the dialog is open unless `open` and `onOpenChange` are given,
 * React's controlled-or-not pattern, so a card can open it from elsewhere too
 * (`ScenarioCard`'s Custom row).
 */
export function RunSettingsButton({
  choice,
  year,
  unit,
  eraSettings = false,
  lock = null,
  onCommit,
  ...controlled
}: SettingsProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlled.open ?? ownOpen;
  const setOpen = controlled.onOpenChange ?? setOwnOpen;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Run settings"
        aria-haspopup="dialog"
        {...(lock === null ? {} : { title: lock })}
        onClick={() => {
          setOpen(true);
        }}
      >
        <span aria-hidden="true" className="settings-icon" />
        Settings
      </Button>
      <RunSettingsDialog
        open={open}
        onOpenChange={setOpen}
        choice={choice}
        year={year}
        unit={unit}
        eraSettings={eraSettings}
        lock={lock}
        {...(onCommit === undefined ? {} : { onCommit })}
      />
    </>
  );
}

/**
 * The grid's run settings: what is in force, and the ⚙ button that opens them,
 * the first thing under the page's heading, so a reader sees what the season is
 * simulated under without opening anything. The setup screen puts the same two
 * parts in its *Scenarios* card (`ScenarioCard`). `extra` is whatever else belongs
 * on the row — the grid's year switcher.
 */
export function RunSettingsLine({ extra, ...props }: SettingsProps & { extra?: ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
      <SettingsSummary {...props} />
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        <RunSettingsButton {...props} />
      </div>
    </Card>
  );
}
