import { decadeOf, PLAYABLE_SEASONS } from "../lib/seasons.js";
import { SETTING_SELECT_CLASS, SettingSegments } from "./SettingSegments.js";

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

/**
 * How often the run's cars break down: as each year's did, or as one season's
 * did, every year. A year rather than a number, because a season's retirement
 * factor is an authored dial a reader has no reason to know; "as unreliable as
 * 1968" is the question they are asking. Cars only: driver error keeps each
 * year's own, so under Breakdowns: None there is nothing left to choose.
 */
export function ReliabilitySetting({
  reliability,
  year,
  disabled = false,
  onChange,
}: {
  /** The season whose breakdown rate every year takes, or null for each year's own. */
  reliability: number | null;
  /** The year on the picker, which *As in a year* starts from. */
  year: number;
  /** Greyed out under Breakdowns: None, keeping the reader's choice on show. */
  disabled?: boolean;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (reliability: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SettingSegments
        name="Reliability"
        disabled={disabled}
        segments={[
          {
            key: "own",
            label: "Each year's own",
            selected: reliability === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "as-in",
            label: "As in a year",
            selected: reliability !== null,
            onPick: () => onChange?.(year),
          },
        ]}
      />

      {disabled ? (
        <p className="text-muted-foreground text-xs">
          No car breaks down, so there is no reliability to choose.
        </p>
      ) : reliability === null ? (
        <p className="text-muted-foreground text-xs">
          Every year's cars break down as often as they really did.
        </p>
      ) : (
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">
            Every year's cars break down as often as {reliability}'s did.
          </span>
          <select
            value={reliability}
            onChange={(event) => {
              onChange?.(Number(event.target.value));
            }}
            className={SETTING_SELECT_CLASS}
          >
            {decades().map(({ decade, years }) => (
              <optgroup key={decade} label={`${decade}s`}>
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
