import {
  DEVELOPMENT_LABELS,
  type Development,
  type RunSettings,
  type RunUnit,
} from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/** The answers, history first. */
const ANSWERS = ["historical", "random", "none"] as const;

/** What a what-if answer means, under the control; the era's says "every year". */
const NOTES: Readonly<Record<RunUnit, Readonly<Record<Development, string>>>> = {
  season: {
    random: "Each car gets randomly faster or slower as the season goes on.",
    none: "Every car keeps the same pace all season.",
  },
  era: {
    random: "Every year, each car gets randomly faster or slower as the season goes on.",
    none: "Every car keeps the same pace all season.",
  },
};

/**
 * In-season development: each car's year as authored, a random trend for
 * every car, or none (`trendsOf`). In both screens' settings.
 */
export function DevelopmentSetting({
  development,
  unit,
  onChange,
}: {
  /** Null is Historical. */
  development: RunSettings["development"];
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (development: RunSettings["development"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="In-season development"
        segments={ANSWERS.map((answer) => ({
          key: answer,
          label: answer === "historical" ? "Historical" : DEVELOPMENT_LABELS[answer],
          selected: answer === (development ?? "historical"),
          onPick: () => onChange?.(answer === "historical" ? null : answer),
        }))}
      />
      {development === null ? null : <SettingNote>{NOTES[unit][development]}</SettingNote>}
    </div>
  );
}
