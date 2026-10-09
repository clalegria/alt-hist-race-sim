import { useState } from "react";
import {
  CAR_VARIATION_BASES,
  CAR_VARIATION_SPREADS,
  type CarPerformance,
  type CarVariationBase,
  type CarVariationSpread,
  type RunUnit,
} from "../lib/run-settings.js";
import { SettingNote, SettingSegments, SettingSub } from "./SettingSegments.js";

/**
 * The spread *Random factor is added* opens on, for a reader who has not picked one: the middle
 * stop. A default for the control, not a number the model reads.
 */
const OPENING_SPREAD: CarVariationSpread = 10;

/** One what-if's notes, which talk about "every season" only where there is more than one. */
export type PerformanceCopy = Readonly<
  Record<
    RunUnit,
    {
      readonly varied: (spread: CarVariationSpread, from: CarVariationBase) => string;
      readonly random: string;
    }
  >
>;

/**
 * *Chassis performance* or *Engine performance*: as authored, varied about it,
 * or random. One control for both, so the two read alike answer for answer;
 * each wrapper brings its name, its "Varies from" answers and its notes.
 *
 * Under *Random factor is added*, set in beneath it, a row picks how far, as segments like the
 * first, and on the era's screen another picks what from: that year's real one,
 * or the previous year's (a walk), which a season has no run behind it for.
 * Both are remembered while the dialog is open, so a look at *Totally random* and back
 * does not lose them; the season's screen keeps the era's base untouched, and a
 * season races off the real one whatever it says (`seasonSettings`).
 */
export function PerformanceSetting({
  name,
  baseLabels,
  copy,
  value,
  unit,
  onChange,
}: {
  name: string;
  /** The *Varies from* answers, history first. */
  baseLabels: Readonly<Record<CarVariationBase, string>>;
  copy: PerformanceCopy;
  /** Null is Historical. */
  value: CarPerformance | null;
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (value: CarPerformance | null) => void;
}) {
  const [spread, setSpread] = useState<CarVariationSpread>(
    value?.kind === "varied" ? value.spread : OPENING_SPREAD,
  );
  const [from, setFrom] = useState<CarVariationBase>(
    value?.kind === "varied" ? value.from : "real",
  );
  const vary = (to: { spread: CarVariationSpread; from: CarVariationBase }) => {
    setSpread(to.spread);
    setFrom(to.from);
    onChange?.({ kind: "varied", ...to });
  };

  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name={name}
        segments={[
          {
            key: "historical",
            label: "Historical",
            selected: value === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "varied",
            label: "Random factor is added",
            selected: value?.kind === "varied",
            onPick: () => {
              vary({ spread, from });
            },
          },
          {
            key: "random",
            label: "Totally random",
            selected: value?.kind === "random",
            onPick: () => onChange?.({ kind: "random" }),
          },
        ]}
      />
      {value?.kind === "varied" ? (
        <SettingSub>
          <SettingSegments
            name="Varies by up to"
            sub
            segments={CAR_VARIATION_SPREADS.map((each) => ({
              key: String(each),
              label: `±${each}`,
              selected: value.spread === each,
              onPick: () => {
                vary({ spread: each, from: value.from });
              },
            }))}
          />
          {unit === "era" ? (
            <SettingSegments
              name="Varies from"
              sub
              segments={CAR_VARIATION_BASES.map((each) => ({
                key: each,
                label: baseLabels[each],
                selected: value.from === each,
                onPick: () => {
                  vary({ spread: value.spread, from: each });
                },
              }))}
            />
          ) : null}
        </SettingSub>
      ) : null}
      {value === null ? null : (
        <SettingNote>
          {value.kind === "varied"
            ? copy[unit].varied(value.spread, value.from)
            : copy[unit].random}
        </SettingNote>
      )}
    </div>
  );
}
