import type { RunSettings } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/**
 * Whether teams are painted as they were each year, or each keeps the livery
 * of its first season in the run (`World.liveriesKeptFrom`). Era only, like
 * *Team name changes*, and its own setting so either can be kept alone.
 */
export function LiveriesSetting({
  liveries,
  onChange,
}: {
  /** Null is Yes, the historical answer. */
  liveries: RunSettings["liveries"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (liveries: RunSettings["liveries"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Livery changes"
        segments={[
          {
            key: "historical",
            label: "Yes",
            selected: liveries === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "first",
            label: "No",
            selected: liveries === "first",
            onPick: () => onChange?.("first"),
          },
        ]}
      />
      {liveries === null ? null : (
        <SettingNote>Every team keeps the colours it had in the first year.</SettingNote>
      )}
    </div>
  );
}
