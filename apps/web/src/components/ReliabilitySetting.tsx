import type { RunUnit } from "../lib/run-settings.js";
import { decadeOf, PLAYABLE_SEASONS } from "../lib/seasons.js";
import { SettingNote, SettingSelect } from "./SettingSegments.js";

/** The playable years, grouped by decade for the picker. */
function decades(): readonly { decade: number; years: readonly number[] }[] {
  const groups: { decade: number; years: number[] }[] = [];
  for (const year of PLAYABLE_SEASONS) {
    const decade = decadeOf(year);
    const group = groups.at(-1);
    if (group?.decade === decade) {
      group.years.push(year);
    } else {
      groups.push({ decade, years: [year] });
    }
  }
  return groups;
}

/** The words, which talk about "every season" only where there is more than one. */
const COPY: Readonly<
  Record<RunUnit, { readonly own: string; readonly asInNote: (reliability: number) => string }>
> = {
  season: {
    own: "This season",
    asInNote: (reliability) => `Cars break down as often as ${reliability}'s did.`,
  },
  era: {
    own: "Each season",
    asInNote: (reliability) => `Every season's cars break down as often as ${reliability}'s did.`,
  },
};

/** The historical answer's value in the `select`: no year. */
const OWN = "";

/**
 * How often the run's cars break down: as each year's did, or as one season's
 * did, every year. A year rather than a number, because a season's retirement
 * factor is an authored dial a reader has no reason to know; "as unreliable as
 * 1968" is the question they are asking. Cars only: driver error keeps each
 * year's own, so under *Mechanical failures: None* there is nothing left to choose.
 *
 * One `select` (`SettingSelect`), the historical answer first, then every
 * playable year by decade.
 */
export function ReliabilitySetting({
  reliability,
  unit,
  disabled = false,
  onChange,
}: {
  /** The season whose breakdown rate every year takes, or null for each year's own. */
  reliability: number | null;
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Greyed out under *Mechanical failures: None*, keeping the reader's choice on show. */
  disabled?: boolean;
  /** Absent in tests, where nothing is chosen. */
  onChange?: (reliability: number | null) => void;
}) {
  const copy = COPY[unit];
  return (
    <div className="flex flex-col gap-2">
      <SettingSelect
        name="Cars as reliable as"
        value={reliability === null ? OWN : String(reliability)}
        disabled={disabled}
        onChange={(value) => onChange?.(value === OWN ? null : Number(value))}
      >
        <option value={OWN}>{copy.own}</option>
        {decades().map(({ decade, years }) => (
          <optgroup key={decade} label={`${decade}s`}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </optgroup>
        ))}
      </SettingSelect>
      {disabled ? (
        <SettingNote>No car breaks down, so there is no reliability to choose.</SettingNote>
      ) : reliability === null ? null : (
        <SettingNote>{copy.asInNote(reliability)}</SettingNote>
      )}
    </div>
  );
}
