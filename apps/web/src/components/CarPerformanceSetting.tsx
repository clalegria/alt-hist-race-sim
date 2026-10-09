import { useState } from "react";
import {
  CAR_VARIATION_BASES,
  CAR_VARIATION_SPREADS,
  type CarVariationBase,
  type CarVariationSpread,
  type RunSettings,
  type RunUnit,
} from "../lib/run-settings.js";
import { SettingNote, SettingSegments, SettingSub } from "./SettingSegments.js";

/**
 * The spread *Random factor is added* opens on, for a reader who has not picked one: the middle
 * stop. A default for the control, not a number the model reads.
 */
const OPENING_SPREAD: CarVariationSpread = 10;

/** What *Random factor is added* moves a car off, in the era's "Varies from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "The historical car",
  last: "Previous season's car",
};

/**
 * The what-ifs' notes, which talk about "every season" only where there is
 * more than one.
 */
const COPY: Readonly<
  Record<
    RunUnit,
    {
      readonly varied: (spread: CarVariationSpread, from: CarVariationBase) => string;
      readonly random: string;
    }
  >
> = {
  season: {
    varied: (spread) =>
      `Each chassis is moved up to ±${spread} off its historical rating. Engines stay historical.`,
    random:
      "Each chassis rating is drawn at random between the season's weakest and strongest car. Engines stay historical.",
  },
  era: {
    varied: (spread, from) =>
      from === "last"
        ? `Each season, each chassis moves up to ±${spread} off the car it raced the year before, so cars drift over the years. A team new to the run starts from its historical car. Engines stay historical.`
        : `Every season, each chassis is moved up to ±${spread} off its historical rating. Engines stay historical.`,
    random:
      "Every season, each chassis rating is drawn at random between that year's weakest and strongest car. Engines stay historical.",
  },
};

/**
 * Whether the cars are as authored, varied about them, or random. In both
 * screens' settings; the notes follow the screen.
 *
 * Under *Random factor is added*, set in beneath it, a row picks how far, as segments like the
 * first, and on the era's screen another picks what from: that year's real car,
 * or the previous year's (a walk), which a season has no run behind it for.
 * Both are remembered while the dialog is open, so a look at *Totally random* and back
 * does not lose them; the season's screen keeps the era's base untouched, and a
 * season races off the real car whatever it says (`seasonSettings`).
 */
export function CarPerformanceSetting({
  carPerformance,
  unit,
  onChange,
}: {
  /** Null is Historical. */
  carPerformance: RunSettings["carPerformance"];
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (carPerformance: RunSettings["carPerformance"]) => void;
}) {
  const [spread, setSpread] = useState<CarVariationSpread>(
    carPerformance?.kind === "varied" ? carPerformance.spread : OPENING_SPREAD,
  );
  const [from, setFrom] = useState<CarVariationBase>(
    carPerformance?.kind === "varied" ? carPerformance.from : "real",
  );
  const vary = (to: { spread: CarVariationSpread; from: CarVariationBase }) => {
    setSpread(to.spread);
    setFrom(to.from);
    onChange?.({ kind: "varied", ...to });
  };

  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Car performance"
        segments={[
          {
            key: "historical",
            label: "Historical",
            selected: carPerformance === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "varied",
            label: "Random factor is added",
            selected: carPerformance?.kind === "varied",
            onPick: () => {
              vary({ spread, from });
            },
          },
          {
            key: "random",
            label: "Totally random",
            selected: carPerformance?.kind === "random",
            onPick: () => onChange?.({ kind: "random" }),
          },
        ]}
      />
      {carPerformance?.kind === "varied" ? (
        <SettingSub>
          <SettingSegments
            name="Varies by up to"
            sub
            segments={CAR_VARIATION_SPREADS.map((each) => ({
              key: String(each),
              label: `±${each}`,
              selected: carPerformance.spread === each,
              onPick: () => {
                vary({ spread: each, from: carPerformance.from });
              },
            }))}
          />
          {unit === "era" ? (
            <SettingSegments
              name="Varies from"
              sub
              segments={CAR_VARIATION_BASES.map((each) => ({
                key: each,
                label: BASE_LABELS[each],
                selected: carPerformance.from === each,
                onPick: () => {
                  vary({ spread: carPerformance.spread, from: each });
                },
              }))}
            />
          ) : null}
        </SettingSub>
      ) : null}
      {carPerformance === null ? null : (
        <SettingNote>
          {carPerformance.kind === "varied"
            ? COPY[unit].varied(carPerformance.spread, carPerformance.from)
            : COPY[unit].random}
        </SettingNote>
      )}
    </div>
  );
}
