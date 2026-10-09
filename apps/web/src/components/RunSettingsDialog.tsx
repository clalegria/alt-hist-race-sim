import type { RandomnessLevel } from "@alt-hist/engine";
import { type ReactNode, useState } from "react";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { historicalSettings, type RunSettings, type RunUnit } from "../lib/run-settings.js";
import { BreakdownsSetting } from "./BreakdownsSetting.js";
import { CareerEventsSetting } from "./CareerEventsSetting.js";
import { CarPerformanceSetting } from "./CarPerformanceSetting.js";
import { DevelopmentSetting } from "./DevelopmentSetting.js";
import { EnginePerformanceSetting } from "./EnginePerformanceSetting.js";
import { EngineSuppliersSetting } from "./EngineSuppliersSetting.js";
import { LiveriesSetting } from "./LiveriesSetting.js";
import { PointsSetting } from "./PointsSetting.js";
import { RandomnessSlider } from "./RandomnessSlider.js";
import { ReliabilitySetting } from "./ReliabilitySetting.js";
import { TeamNamesSetting } from "./TeamNamesSetting.js";
import { TeamsAndSeatsSetting } from "./TeamsAndSeatsSetting.js";
import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./ui/dialog.js";

/**
 * Everything a run is simulated under, apart from the year: the randomness
 * level and the what-ifs. Two fields because the world keeps them apart
 * (`world.randomness`, `world.settings`), but one answer to the dialog.
 */
export interface RunChoice {
  readonly randomness: RandomnessLevel;
  readonly settings: RunSettings;
}

/**
 * What Restore defaults puts a choice back to — the dialog's button and the
 * settings line's link alike: every setting the screen offers historical
 * (`historicalSettings`), and the luck on the day the app opens on.
 */
export function defaultChoice(choice: RunChoice, eraSettings: boolean): RunChoice {
  return {
    randomness: STARTING_RANDOMNESS_LEVEL,
    settings: historicalSettings(choice.settings, eraSettings),
  };
}

/**
 * One headed group of settings. A setting is a *direct child*: the padding and
 * the rule between settings are applied here, so adding one is adding a child.
 */
export function RunSettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h3 className="text-subtle pt-2 text-xs font-semibold tracking-wider uppercase">{title}</h3>
      <div className="divide-border divide-y [&>*]:py-3">{children}</div>
    </section>
  );
}

/**
 * The settings themselves, grouped by what they are about: **Races** (how much
 * the dice decide, how a result is scored), **Cars** (how quick, how they
 * develop, how often they break), and the era's **Over the years** (careers,
 * team names, liveries and engines, the grid).
 * Breakdowns and Reliability sit together because one greys the other out.
 *
 * Two columns from `lg` up — an era's Races and Cars beside its years, a
 * season's Races beside its Cars — one below it.
 *
 * Controlled: the dialog holds the draft. Everything the remembered settings
 * hold is passed through, era-only answers included, so a season's screen never
 * drops an era's choice it does not show (`seasonSettings` does that for the
 * world, not for the reader's preference).
 */
export function RunSettingsForm({
  choice,
  year,
  unit,
  eraSettings = false,
  onChange,
}: {
  choice: RunChoice;
  /** The selected year, which a season's Points names the table of. */
  year: number;
  /** What the settings are fixed for, which their copy follows. */
  unit: RunUnit;
  /** Whether to offer the era-only group. */
  eraSettings?: boolean;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (choice: RunChoice) => void;
}) {
  const { randomness, settings } = choice;
  const set = (changed: Partial<RunSettings>) => {
    onChange?.({ randomness, settings: { ...settings, ...changed } });
  };

  const races = (
    <RunSettingsGroup title="Races">
      <RandomnessSlider
        level={randomness}
        onChange={(level) => {
          onChange?.({ randomness: level, settings });
        }}
      />
      <PointsSetting
        points={settings.points}
        year={year}
        unit={unit}
        onChange={(points) => {
          set({ points });
        }}
      />
    </RunSettingsGroup>
  );
  const cars = (
    <RunSettingsGroup title="Cars">
      <CarPerformanceSetting
        carPerformance={settings.carPerformance}
        unit={unit}
        onChange={(carPerformance) => {
          set({ carPerformance });
        }}
      />
      <EnginePerformanceSetting
        enginePerformance={settings.enginePerformance}
        unit={unit}
        onChange={(enginePerformance) => {
          set({ enginePerformance });
        }}
      />
      <DevelopmentSetting
        development={settings.development}
        unit={unit}
        onChange={(development) => {
          set({ development });
        }}
      />
      <BreakdownsSetting
        breakdowns={settings.breakdowns}
        onChange={(breakdowns) => {
          set({ breakdowns });
        }}
      />
      <ReliabilitySetting
        reliability={settings.reliability}
        unit={unit}
        disabled={settings.breakdowns === "none"}
        onChange={(reliability) => {
          set({ reliability });
        }}
      />
    </RunSettingsGroup>
  );

  return (
    <div className="grid gap-x-8 gap-y-2 lg:grid-cols-2 lg:items-start">
      {eraSettings ? (
        <>
          <div className="flex flex-col gap-2">
            {races}
            {cars}
          </div>
          <RunSettingsGroup title="Over the years">
            <CareerEventsSetting
              careerEvents={settings.careerEvents}
              onChange={(careerEvents) => {
                set({ careerEvents });
              }}
            />
            <TeamNamesSetting
              teamNames={settings.teamNames}
              onChange={(teamNames) => {
                set({ teamNames });
              }}
            />
            <LiveriesSetting
              liveries={settings.liveries}
              onChange={(liveries) => {
                set({ liveries });
              }}
            />
            <EngineSuppliersSetting
              engineSuppliers={settings.engineSuppliers}
              onChange={(engineSuppliers) => {
                set({ engineSuppliers });
              }}
            />
            <TeamsAndSeatsSetting
              teamsAndSeats={settings.teamsAndSeats}
              onChange={(teamsAndSeats) => {
                set({ teamsAndSeats });
              }}
            />
          </RunSettingsGroup>
        </>
      ) : (
        <>
          {races}
          {cars}
        </>
      )}
    </div>
  );
}

/**
 * The form as the dialog draws it: read-only under a `lock`, which is said
 * above it, and the whole form in one disabled native `fieldset` — which
 * disables every control inside it at once, buttons, selects and inputs alike,
 * while still showing what was chosen. Apart from the dialog's own parts so a
 * static render can reach it; the dialog renders into a portal.
 */
export function RunSettingsFields({
  lock,
  ...form
}: {
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  /** Why the settings cannot be changed, or null when they can. */
  lock: string | null;
  onChange?: (choice: RunChoice) => void;
}) {
  return (
    <>
      {lock === null ? null : (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
          {lock}
        </p>
      )}
      <fieldset disabled={lock !== null} className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
        <RunSettingsForm {...form} />
      </fieldset>
    </>
  );
}

/**
 * The run settings, in a dialog over the page: opened from `RunSettingsLine`,
 * on the setup screen and on the grid alike.
 *
 * **A draft, then Done.** The controls change a copy held here; Done hands it
 * to `onCommit` and Cancel (or Escape, or a click outside) drops it. On the
 * grid a commit re-simulates the season, which is a question worth asking once
 * rather than on every click. Restore defaults puts the draft, and only the
 * draft, back to the historical answers and the starting randomness.
 *
 * **`lock` makes it read-only** (`RunSettingsFields`), with Close in place of
 * Cancel and Done.
 */
export function RunSettingsDialog({
  open,
  onOpenChange,
  lock = null,
  onCommit,
  ...form
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  /** Why the settings cannot be changed, or null when they can. */
  lock?: string | null;
  onCommit?: (choice: RunChoice) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-3">
        {/* Inside the content, which Radix unmounts on close: the draft is
            seeded afresh from what is in force each time it opens. */}
        <DraftForm
          {...form}
          lock={lock}
          onDone={(choice) => {
            if (choice !== form.choice) {
              onCommit?.(choice);
            }
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DraftForm({
  choice,
  year,
  unit,
  eraSettings = false,
  lock,
  onDone,
}: {
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  lock: string | null;
  onDone: (choice: RunChoice) => void;
}) {
  const [draft, setDraft] = useState<RunChoice>(choice);
  const defaults = defaultChoice(draft, eraSettings);
  // A reset answer is null and a kept one the draft's own object, so `===` is enough.
  const atDefaults =
    draft.randomness === defaults.randomness &&
    Object.entries(defaults.settings).every(
      ([key, value]) => draft.settings[key as keyof RunSettings] === value,
    );
  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle>Run settings</DialogTitle>
        <DialogDescription>
          Chosen before the {unit} starts, and fixed once it is under way.
        </DialogDescription>
      </div>
      <RunSettingsFields
        choice={draft}
        year={year}
        unit={unit}
        eraSettings={eraSettings}
        lock={lock}
        onChange={setDraft}
      />
      <DialogFooter className="border-border border-t pt-4">
        {lock === null ? (
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              title="Every setting historical, luck on the day at its default"
              disabled={atDefaults}
              onClick={() => {
                setDraft(defaults);
              }}
            >
              Restore defaults
            </Button>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                onDone(draft);
              }}
            >
              Done
            </Button>
          </>
        ) : (
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        )}
      </DialogFooter>
    </>
  );
}
