import type { RatingMode } from "@alt-hist/data";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/** The answers, as they were that year first: the historical one. */
const LABELS: Readonly<Record<RatingMode, string>> = {
  aged: "As they were that year",
  peak: "At their best",
};

/**
 * Whether drivers race as they were that year — young ones still learning, old
 * ones past their best — or every one at the best they ever were. Season only:
 * an era always runs drivers as they were (`ERA_RATING_MODE`). The world's
 * `ratingMode`, not a run setting, so the dialog carries it beside the luck on
 * the day (`RunChoice`).
 */
export function DriverAbilitySetting({
  ratingMode,
  onChange,
}: {
  ratingMode: RatingMode;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (ratingMode: RatingMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Driver ability"
        segments={(["aged", "peak"] as const).map((mode) => ({
          key: mode,
          label: LABELS[mode],
          selected: mode === ratingMode,
          onPick: () => onChange?.(mode),
        }))}
      />
      {ratingMode === "peak" ? (
        <SettingNote>Every driver races at the best they ever were, whatever the year.</SettingNote>
      ) : null}
    </div>
  );
}

/** What the settings line says under *At their best*. */
export const PEAK_LABEL = LABELS.peak;
