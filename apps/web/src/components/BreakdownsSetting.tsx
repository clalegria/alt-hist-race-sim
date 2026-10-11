import { BREAKDOWNS, type Breakdowns } from "@alt-hist/engine";
import {
  BREAKDOWNS_LABELS,
  type FewerBreakdowns,
  type RunSettings,
  type RunUnit,
} from "../lib/run-settings.js";
import { decadeOf, PLAYABLE_SEASONS } from "../lib/seasons.js";
import { SettingNote, SettingSegments, SettingSelect, SettingSub } from "./SettingSegments.js";

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

/** How often, against the cars it is measured by: Realistic's, or Fewer's. */
const HOW_OFTEN: Readonly<Record<Exclude<Breakdowns, "none">, string>> = {
  realistic: "as often",
  fewer: "half as often",
};

/** The words, which talk about "every year" only where there is more than one. */
const COPY: Readonly<
  Record<
    RunUnit,
    {
      /** The picker's historical answer. */
      readonly own: string;
      /** Fewer against each year's own cars. */
      readonly fewerThanOwn: string;
      readonly asIn: (howOften: string, reliability: number) => string;
    }
  >
> = {
  season: {
    own: "This season",
    fewerThanOwn: "Cars break down half as often as they really did.",
    asIn: (howOften, reliability) =>
      `Cars break down ${howOften} as they did during ${reliability}.`,
  },
  era: {
    own: "Each season",
    fewerThanOwn:
      "For every year of this run, cars break down half as often as they did that year.",
    asIn: (howOften, reliability) =>
      `For every year of this run, cars break down ${howOften} as they did during ${reliability}.`,
  },
};

const NEVER = "Cars never break down. Drivers can still crash out.";

/** The historical answer's value in the `select`: no year. */
const OWN = "";

/**
 * Mechanical failures: how often the run's cars break down. *Realistic* or
 * *Fewer* (half as often), each measured against *Cars as reliable as* — each
 * year's own cars, or one season's, every year — or *None*. Mechanical failures
 * only; driver error is a driver rating and stays.
 *
 * *Cars as reliable as* is a sub-option, set in under Realistic and Fewer and
 * hidden under None, where no car breaks down to be measured; the choice is kept
 * for a look at None and back. A year rather than a number, because a season's
 * retirement factor is an authored dial a reader has no reason to know; "as
 * unreliable as 1968" is the question they are asking. One note says what the
 * pair does together.
 */
export function BreakdownsSetting({
  breakdowns,
  reliability,
  unit,
  onChange,
}: {
  /** Null is Realistic, the historical answer. */
  breakdowns: FewerBreakdowns | null;
  /** The season whose breakdown rate every year takes, or null for each year's own. */
  reliability: number | null;
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (changed: Partial<Pick<RunSettings, "breakdowns" | "reliability">>) => void;
}) {
  const current: Breakdowns = breakdowns ?? "realistic";
  const copy = COPY[unit];
  const note =
    current === "none"
      ? NEVER
      : reliability !== null
        ? copy.asIn(HOW_OFTEN[current], reliability)
        : current === "fewer"
          ? copy.fewerThanOwn
          : null;
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Mechanical failures"
        segments={BREAKDOWNS.map((answer) => ({
          key: answer,
          label: BREAKDOWNS_LABELS[answer],
          selected: answer === current,
          onPick: () => onChange?.({ breakdowns: answer === "realistic" ? null : answer }),
        }))}
      />
      {current === "none" ? null : (
        <SettingSub>
          <SettingSelect
            name="Cars as reliable as"
            sub
            value={reliability === null ? OWN : String(reliability)}
            onChange={(value) => onChange?.({ reliability: value === OWN ? null : Number(value) })}
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
        </SettingSub>
      )}
      {note === null ? null : <SettingNote>{note}</SettingNote>}
    </div>
  );
}
