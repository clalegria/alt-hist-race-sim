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
  /** Null is As they happened, the historical answer. */
  careerEvents: RunSettings["careerEvents"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (careerEvents: RunSettings["careerEvents"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Career events"
        segments={[
          {
            key: "historical",
            label: "As they happened",
            selected: careerEvents === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "none",
            label: "None",
            selected: careerEvents === "none",
            onPick: () => onChange?.("none"),
          },
        ]}
      />
      {careerEvents === null ? null : (
        <SettingNote>
          Every career follows the plain ageing curve: no off-years, no late-career drops.
        </SettingNote>
      )}
    </div>
  );
}
