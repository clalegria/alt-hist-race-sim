import { BREAKDOWNS, type Breakdowns } from "@alt-hist/engine";
import { BREAKDOWNS_LABELS, type FewerBreakdowns } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/** What a what-if answer means, under the control. Realistic says it in its name. */
const NOTES: Readonly<Record<FewerBreakdowns, string>> = {
  fewer: "Cars break down half as often as Reliability sets.",
  none: "Cars never break down. Drivers can still crash out.",
};

/**
 * How often cars break down: as often as Reliability sets, half as often, or
 * never. Mechanical failures only; driver error is a driver rating and stays.
 */
export function BreakdownsSetting({
  breakdowns,
  onChange,
}: {
  /** Null is Realistic, the historical answer. */
  breakdowns: FewerBreakdowns | null;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (breakdowns: FewerBreakdowns | null) => void;
}) {
  const current: Breakdowns = breakdowns ?? "realistic";
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Breakdowns"
        segments={BREAKDOWNS.map((answer) => ({
          key: answer,
          label: BREAKDOWNS_LABELS[answer],
          selected: answer === current,
          onPick: () => onChange?.(answer === "realistic" ? null : answer),
        }))}
      />
      {breakdowns === null ? null : <SettingNote>{NOTES[breakdowns]}</SettingNote>}
    </div>
  );
}
