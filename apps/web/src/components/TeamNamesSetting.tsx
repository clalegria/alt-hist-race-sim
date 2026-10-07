import type { RunSettings } from "../lib/run-settings.js";
import { SettingSegments } from "./SettingSegments.js";

/**
 * Whether teams are named as they were each year, or each keeps the name — and
 * with it the base — of its first season in the run. Era only: a single season
 * has no later year to rename in. The livery still follows history.
 */
export function TeamNamesSetting({
  teamNames,
  onChange,
}: {
  /** Null is As they happened, the historical answer. */
  teamNames: RunSettings["teamNames"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (teamNames: RunSettings["teamNames"]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SettingSegments
        name="Team names"
        segments={[
          {
            key: "historical",
            label: "As they happened",
            selected: teamNames === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "first",
            label: "Keep the first",
            selected: teamNames === "first",
            onPick: () => onChange?.("first"),
          },
        ]}
      />
      <p className="text-muted-foreground text-xs">
        {teamNames === null
          ? "Teams are renamed as they really were: Brawn becomes Mercedes."
          : "Each team keeps the name and flag of its first season in the run; its colours still change as they really did."}
      </p>
    </div>
  );
}
