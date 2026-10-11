import type { RunSettings } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/**
 * Whether teams are named as they were each year, or each keeps the name — and
 * with it the base — of its first season in the run. Era only: a single season
 * has no later year to rename in. The livery is its own setting (`LiveriesSetting`).
 */
export function TeamNamesSetting({
  teamNames,
  onChange,
}: {
  /** Null is Yes, the historical answer. */
  teamNames: RunSettings["teamNames"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (teamNames: RunSettings["teamNames"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Team name changes"
        segments={[
          {
            key: "historical",
            label: "Yes",
            selected: teamNames === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "first",
            label: "No",
            selected: teamNames === "first",
            onPick: () => onChange?.("first"),
          },
        ]}
      />
      {teamNames === null ? null : (
        <SettingNote>Every team keeps the name and flag it had in the first year.</SettingNote>
      )}
    </div>
  );
}
