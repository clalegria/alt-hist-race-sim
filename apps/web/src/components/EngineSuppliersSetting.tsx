import type { RunSettings } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/**
 * Whether teams run the engine history gave them each year, or each keeps the
 * supplier of its first season in the run (`withFirstEngines` in
 * `@alt-hist/data`). Era only.
 */
export function EngineSuppliersSetting({
  engineSuppliers,
  onChange,
}: {
  /** Null is Yes, the historical answer. */
  engineSuppliers: RunSettings["engineSuppliers"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (engineSuppliers: RunSettings["engineSuppliers"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Engine supplier changes"
        segments={[
          {
            key: "historical",
            label: "Yes",
            selected: engineSuppliers === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "first",
            label: "No",
            selected: engineSuppliers === "first",
            onPick: () => onChange?.("first"),
          },
        ]}
      />
      {engineSuppliers === null ? null : (
        <SettingNote>Every team keeps the engine it had in the first year.</SettingNote>
      )}
    </div>
  );
}
