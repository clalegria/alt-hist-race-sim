import { type ReactNode, useState } from "react";
import { type RunUnit, seasonSettings, whatIfsOf } from "../lib/run-settings.js";
import { type RunChoice, RunSettingsDialog } from "./RunSettingsDialog.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { Button } from "./ui/button.js";

/**
 * The run settings in one line, and the ⚙ button that opens them.
 *
 * **The same row on the setup screen and on the grid, in the same place** — the
 * first thing under the page's heading — so a reader who wants to change how
 * the run is simulated finds it where they found it last time, and sees what
 * is in force without opening anything.
 *
 * The cog is drawn by the stylesheet (`.settings-icon`, a mask over
 * `currentColor`) rather than as an `<svg>`, because the tests count a table's
 * flags by counting `<svg>` — the page link's icon is drawn the same way.
 *
 * `lock` opens the dialog read-only, with the reason; the button itself stays
 * live, since seeing what a run was set up with is still worth a click.
 * `extra` is whatever else belongs on the row — the grid's year switcher.
 */
export function RunSettingsLine({
  choice,
  year,
  unit,
  eraSettings = false,
  lock = null,
  onCommit,
  extra,
}: {
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  lock?: string | null;
  onCommit?: (choice: RunChoice) => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // A season's screen states only what a season races: the remembered set can
  // hold an era's answers too.
  const inForce = unit === "season" ? seasonSettings(choice.settings) : choice.settings;
  const historical = whatIfsOf(inForce).length === 0;

  return (
    <div className="border-border bg-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 shadow-sm">
      <div className="text-muted-foreground min-w-0 text-xs">
        <SimulationSettings
          settings={settingsOf({ randomness: choice.randomness, settings: inForce })}
          className="inline"
        />
        {historical ? <span> · everything else as it was</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        <Button
          variant="outline"
          className="h-8 gap-1.5 px-3 text-xs"
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
      </div>
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
    </div>
  );
}
