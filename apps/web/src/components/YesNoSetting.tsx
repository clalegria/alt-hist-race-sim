import type { RunSettings } from "../lib/run-settings.js";
import { SettingNote, SettingSegments } from "./SettingSegments.js";

/**
 * The run settings answered Yes or No, all era only. Yes is null, the
 * historical answer, and comes first; the note shows only under No. What each
 * setting does to a run is its doc comment in `lib/run-settings.ts`.
 */
const YES_NO_SETTINGS = {
  careerEvents: {
    name: "Driver career events",
    no: "none",
    note: "Drivers never have an off year or a sudden late-career drop; they simply rise and fade with age.",
  },
  teamNames: {
    name: "Team name changes",
    no: "first",
    note: "Every team keeps the name and flag it had in the first year.",
  },
  liveries: {
    name: "Livery changes",
    no: "first",
    note: "Every team keeps the colours it had in the first year.",
  },
  engineSuppliers: {
    name: "Engine supplier changes",
    no: "first",
    note: "Every team keeps the engine it had in the first year.",
  },
} as const satisfies {
  [K in keyof RunSettings]?: { name: string; no: NonNullable<RunSettings[K]>; note: string };
};

export type YesNoKey = keyof typeof YES_NO_SETTINGS;

export function YesNoSetting<K extends YesNoKey>({
  setting,
  value,
  onChange,
}: {
  setting: K;
  value: RunSettings[K];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (value: RunSettings[K]) => void;
}) {
  const { name, no, note } = YES_NO_SETTINGS[setting];
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name={name}
        segments={[
          {
            key: "historical",
            label: "Yes",
            selected: value === null,
            onPick: () => onChange?.(null as RunSettings[K]),
          },
          {
            key: no,
            label: "No",
            selected: value === no,
            onPick: () => onChange?.(no as RunSettings[K]),
          },
        ]}
      />
      {value === null ? null : <SettingNote>{note}</SettingNote>}
    </div>
  );
}
