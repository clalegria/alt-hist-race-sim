import { ARRANGEMENT_KINDS, type ArrangementKind, isArrangementKind } from "@alt-hist/data";
import { useState } from "react";
import { ARRANGEMENT_LABELS, type RunUnit, type Seating } from "../lib/run-settings.js";
import { SettingCheck, SettingNote, SettingSelect, SettingSub } from "./SettingSegments.js";

/** The historical answer's value in the `select`: no rule. */
const HISTORICAL = "";

/** What each rule does, for the setting's note. */
const WHAT: Readonly<Record<ArrangementKind, string>> = {
  "fastest-in-fastest": "the fastest drivers are put in the fastest teams.",
  "fastest-in-slowest": "the fastest drivers are put in the slowest teams.",
  random: "every driver is put in a team at random.",
};

/** The note, following the screen: an era's happens every year. */
function note(kind: ArrangementKind, unit: RunUnit): string {
  const what = WHAT[kind];
  return unit === "era" ? `Every year, ${what}` : `${what.charAt(0).toUpperCase()}${what.slice(1)}`;
}

/**
 * *Who drives where*: drivers where history put them, or every grid reseated by
 * a rule in `arrange.ts` (`RunSettings.seating`). On both screens. A `select`,
 * since the rules' names are too long for segments; under a rule, *Drivers
 * without a drive can take a seat*, remembered while the dialog is open.
 */
export function WhoDrivesSetting({
  seating,
  unit,
  onChange,
}: {
  /** Null is Historical. */
  seating: Seating | null;
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (seating: Seating | null) => void;
}) {
  const [includeUnemployed, setIncludeUnemployed] = useState(seating?.includeUnemployed ?? false);
  return (
    <div className="flex flex-col gap-2">
      <SettingSelect
        name="Who drives where"
        value={seating?.kind ?? HISTORICAL}
        onChange={(value) => {
          onChange?.(isArrangementKind(value) ? { kind: value, includeUnemployed } : null);
        }}
      >
        <option value={HISTORICAL}>Historical</option>
        {ARRANGEMENT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {ARRANGEMENT_LABELS[kind]}
          </option>
        ))}
      </SettingSelect>
      {seating === null ? null : (
        <>
          <SettingSub>
            <SettingCheck
              label="Drivers without a drive can take a seat"
              checked={seating.includeUnemployed}
              onChange={(checked) => {
                setIncludeUnemployed(checked);
                onChange?.({ ...seating, includeUnemployed: checked });
              }}
            />
          </SettingSub>
          <SettingNote>{note(seating.kind, unit)}</SettingNote>
        </>
      )}
    </div>
  );
}
