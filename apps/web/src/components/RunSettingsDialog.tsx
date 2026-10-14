import { DEFAULT_RATING_MODE, type RatingMode } from "@alt-hist/data";
import type { RandomnessLevel } from "@alt-hist/engine";
import { type ReactNode, useId, useState } from "react";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import {
  historicalSettings,
  type RunSettings,
  type RunUnit,
  samePool,
  settingsInForce,
  signsDrivers,
} from "../lib/run-settings.js";
import { BreakdownsSetting } from "./BreakdownsSetting.js";
import { CareerEventsSetting } from "./CareerEventsSetting.js";
import { CarPerformanceSetting } from "./CarPerformanceSetting.js";
import { DevelopmentSetting } from "./DevelopmentSetting.js";
import { DriverAbilitySetting } from "./DriverAbilitySetting.js";
import { DriverPoolSetting } from "./DriverPoolSetting.js";
import { EnginePerformanceSetting } from "./EnginePerformanceSetting.js";
import { EngineSuppliersSetting } from "./EngineSuppliersSetting.js";
import { LiveriesSetting } from "./LiveriesSetting.js";
import { PointsSetting } from "./PointsSetting.js";
import { RandomnessSlider } from "./RandomnessSlider.js";
import { Tabs, tabIds } from "./Tabs.js";
import { TeamNamesSetting } from "./TeamNamesSetting.js";
import { TeamsSetting } from "./TeamsSetting.js";
import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js";
import { Notice } from "./ui/notice.js";
import { WhoDrivesSetting } from "./WhoDrivesSetting.js";

/**
 * Everything a run is simulated under, apart from the year: the randomness
 * level, the driver ability and the what-ifs. Three fields because the world
 * keeps them apart (`world.randomness`, `world.ratingMode`, `world.settings`),
 * but one answer to the dialog. An era's `ratingMode` is always
 * `ERA_RATING_MODE`, and its form does not offer it.
 */
export interface RunChoice {
  readonly randomness: RandomnessLevel;
  readonly ratingMode: RatingMode;
  readonly settings: RunSettings;
}

/**
 * What Restore defaults puts a choice back to — the dialog's button and the
 * settings line's link alike: every setting the screen offers historical
 * (`historicalSettings`), the luck on the day the app opens on, and on a
 * season's screen drivers as they were that year.
 */
export function defaultChoice(choice: RunChoice, eraSettings: boolean): RunChoice {
  return {
    randomness: STARTING_RANDOMNESS_LEVEL,
    ratingMode: eraSettings ? choice.ratingMode : DEFAULT_RATING_MODE,
    settings: historicalSettings(choice.settings, eraSettings),
  };
}

export type SettingsTab = "races" | "drivers" | "cars" | "years";

/** An answer in a `RunChoice`: one of its settings, or the two it carries beside them. */
type Answer = "randomness" | "ratingMode" | keyof RunSettings;

/**
 * The dialog's tabs, in order, and the answers each one's settings set — which
 * is what lights a tab's dot. A new setting's answer goes under its tab here.
 */
const SETTINGS_TABS: readonly {
  readonly key: SettingsTab;
  readonly label: string;
  readonly eraOnly: boolean;
  readonly answers: readonly Answer[];
}[] = [
  { key: "races", label: "Races", eraOnly: false, answers: ["randomness", "points"] },
  {
    key: "drivers",
    label: "Drivers",
    eraOnly: false,
    answers: ["ratingMode", "seating", "driverPool", "careerEvents"],
  },
  {
    key: "cars",
    label: "Cars",
    eraOnly: false,
    answers: ["carPerformance", "enginePerformance", "development", "breakdowns", "reliability"],
  },
  {
    key: "years",
    label: "Over the years",
    eraOnly: true,
    answers: ["teams", "teamNames", "liveries", "engineSuppliers"],
  },
];

/**
 * The settings as the screen runs them. A season never runs the era-only
 * answers it passes through, so its kept teams sign nobody.
 */
function shownSettings(settings: RunSettings, eraSettings: boolean): RunSettings {
  return settingsInForce(eraSettings ? settings : { ...settings, teams: null });
}

/**
 * The tabs holding an answer Restore defaults would change, read off the
 * settings in force: an answer a run would ignore (a pool nobody is signed
 * from) is no change. A season's era-only answers are its defaults, so they
 * never count.
 */
export function changedTabs(choice: RunChoice, eraSettings: boolean): ReadonlySet<SettingsTab> {
  const defaults = defaultChoice(choice, eraSettings);
  const now = shownSettings(choice.settings, eraSettings);
  const then = shownSettings(defaults.settings, eraSettings);
  const differs = (answer: Answer): boolean => {
    switch (answer) {
      case "randomness":
      case "ratingMode":
        return choice[answer] !== defaults[answer];
      case "driverPool":
        return !samePool(now.driverPool, then.driverPool);
      default:
        return now[answer] !== then[answer];
    }
  };
  return new Set(SETTINGS_TABS.filter((tab) => tab.answers.some(differs)).map((tab) => tab.key));
}

/**
 * One tab's panel of settings. A setting is a *direct child*: the padding and
 * the rule between settings are applied here, so adding one is adding a child.
 * Mounted while another tab shows, only `hidden`, so a sub-option opened on it
 * is still open on the way back.
 */
export function RunSettingsGroup({
  tab,
  idPrefix,
  shown,
  children,
}: {
  tab: SettingsTab;
  idPrefix: string;
  shown: SettingsTab;
  children: ReactNode;
}) {
  const ids = tabIds(idPrefix, tab);
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      hidden={tab !== shown}
      className="divide-border divide-y [&>*]:py-3"
    >
      {children}
    </div>
  );
}

/**
 * The settings themselves, one tab per thing they are about: **Races** (how
 * much the dice decide, how a result is scored), **Drivers** (how good they
 * are, who drives where, who can be signed, their careers), **Cars** (how
 * quick, how they develop, how often they break), and the era's **Over the
 * years** (the teams, their names, liveries and engines). A tab with a change
 * on it carries a dot (`changedTabs`).
 *
 * The tabs above, the panels below in a box of their own that scrolls when a
 * panel is taller than the dialog. `disabled` disables the panels in one
 * native `fieldset` — every control inside at once, while still showing what
 * was chosen — and leaves the tabs out of it, so a locked run can still be read
 * tab by tab.
 *
 * Controlled, the shown tab included: the dialog holds the draft. Everything
 * the remembered settings hold is passed through, era-only answers included,
 * so a season's screen never drops an era's choice it does not show
 * (`seasonSettings` does that for the world, not for the reader's preference).
 */
export function RunSettingsForm({
  choice,
  year,
  unit,
  eraSettings = false,
  tab = "races",
  disabled = false,
  onTabChange,
  onChange,
}: {
  choice: RunChoice;
  /** The selected year, which a season's Points names the table of. */
  year: number;
  /** What the settings are fixed for, which their copy follows. */
  unit: RunUnit;
  /** Whether to offer the era-only settings, and not the season-only one. */
  eraSettings?: boolean;
  /** The tab on show. */
  tab?: SettingsTab;
  disabled?: boolean;
  /** Absent in tests, where nothing is clicked. */
  onTabChange?: (tab: SettingsTab) => void;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (choice: RunChoice) => void;
}) {
  const { randomness, ratingMode, settings } = choice;
  const set = (changed: Partial<RunSettings>) => {
    onChange?.({ ...choice, settings: { ...settings, ...changed } });
  };
  const signing = signsDrivers(shownSettings(settings, eraSettings));
  const idPrefix = useId();
  const changed = changedTabs(choice, eraSettings);
  const group = { idPrefix, shown: tab };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Tabs
        label="Run settings"
        className="shrink-0 self-start"
        panels={{
          items: SETTINGS_TABS.filter((one) => eraSettings || !one.eraOnly).map((one) => ({
            key: one.key,
            label: one.label,
            marked: changed.has(one.key),
          })),
          selected: tab,
          idPrefix,
          onPick: (key) => {
            onTabChange?.(key as SettingsTab);
          },
        }}
      />
      {/* Out to the body's own padding, so a label that overhangs its control is not clipped. */}
      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
        <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0 disabled:text-subtle">
          <RunSettingsGroup tab="races" {...group}>
            <RandomnessSlider
              level={randomness}
              onChange={(level) => {
                onChange?.({ ...choice, randomness: level });
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
          <RunSettingsGroup tab="drivers" {...group}>
            {eraSettings ? null : (
              <DriverAbilitySetting
                ratingMode={ratingMode}
                onChange={(mode) => {
                  onChange?.({ ...choice, ratingMode: mode });
                }}
              />
            )}
            <WhoDrivesSetting
              seating={settings.seating}
              unit={unit}
              onChange={(seating) => {
                set({ seating });
              }}
            />
            {signing ? (
              <DriverPoolSetting
                pool={settings.driverPool}
                ratingMode={ratingMode}
                onChange={(driverPool) => {
                  set({ driverPool });
                }}
              />
            ) : null}
            {eraSettings ? (
              <CareerEventsSetting
                careerEvents={settings.careerEvents}
                onChange={(careerEvents) => {
                  set({ careerEvents });
                }}
              />
            ) : null}
          </RunSettingsGroup>
          <RunSettingsGroup tab="cars" {...group}>
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
              reliability={settings.reliability}
              unit={unit}
              onChange={set}
            />
          </RunSettingsGroup>
          {eraSettings ? (
            <RunSettingsGroup tab="years" {...group}>
              <TeamsSetting
                teams={settings.teams}
                reseated={settings.seating !== null}
                onChange={(teams) => {
                  set({ teams });
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
            </RunSettingsGroup>
          ) : null}
        </fieldset>
      </div>
    </div>
  );
}

/**
 * The form as the dialog draws it: read-only under a `lock`, which is said
 * above it, the panels disabled and the tabs still live (`RunSettingsForm`).
 * Apart from the dialog's own parts so a static render can reach it; the
 * dialog renders into a portal.
 */
export function RunSettingsFields({
  lock,
  ...form
}: {
  choice: RunChoice;
  year: number;
  unit: RunUnit;
  eraSettings?: boolean;
  tab?: SettingsTab;
  /** Why the settings cannot be changed, or null when they can. */
  lock: string | null;
  onTabChange?: (tab: SettingsTab) => void;
  onChange?: (choice: RunChoice) => void;
}) {
  return (
    <>
      {lock === null ? null : (
        <Notice title="Read only" className="shrink-0">
          <p className="text-muted-foreground text-xs">{lock}</p>
        </Notice>
      )}
      <RunSettingsForm {...form} disabled={lock !== null} />
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
      <DialogContent className="h-[min(44rem,calc(100dvh-2rem))] max-w-2xl overflow-hidden">
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
  const [tab, setTab] = useState<SettingsTab>("races");
  const defaults = defaultChoice(draft, eraSettings);
  // A reset answer is null and a kept one the draft's own object, so `===` is enough.
  const atDefaults =
    draft.randomness === defaults.randomness &&
    draft.ratingMode === defaults.ratingMode &&
    Object.entries(defaults.settings).every(
      ([key, value]) => draft.settings[key as keyof RunSettings] === value,
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Run settings</DialogTitle>
      </DialogHeader>
      <DialogBody className="min-h-0 flex-1 gap-3">
        <DialogDescription>
          Set these before you start. They can't be changed once the racing begins.
        </DialogDescription>
        <RunSettingsFields
          choice={draft}
          year={year}
          unit={unit}
          eraSettings={eraSettings}
          lock={lock}
          tab={tab}
          onTabChange={setTab}
          onChange={setDraft}
        />
      </DialogBody>
      <DialogFooter>
        {lock === null ? (
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              title="Back to real history and the default luck"
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
