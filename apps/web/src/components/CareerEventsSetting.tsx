import type { RunSettings } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/**
 * Whether drivers have the career events authored for them — the off-years and
 * late-career drops in `drivers.json` — or none. Era only: an era always runs
 * the ageing curve, the only place the events count.
 */
export function CareerEventsSetting({
  careerEvents,
  onChange,
}: {
  /** Null is Yes, the historical answer. */
  careerEvents: RunSettings["careerEvents"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (careerEvents: RunSettings["careerEvents"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Driver career events"
        segments={[
          {
            key: "historical",
            label: "Yes",
            selected: careerEvents === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "none",
            label: "No",
            selected: careerEvents === "none",
            onPick: () => onChange?.("none"),
          },
        ]}
      />
      {careerEvents === null ? null : (
        <SettingNote>
          Drivers never have an off year or a sudden late-career drop; they simply rise and fade
          with age.
        </SettingNote>
      )}
    </div>
  );
}
