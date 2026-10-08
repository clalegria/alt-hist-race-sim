import { useState } from "react";
import {
  CAR_VARIATION_BASES,
  CAR_VARIATION_SPREADS,
  type CarVariationBase,
  type CarVariationSpread,
  type RunSettings,
  type RunUnit,
} from "../lib/run-settings.js";
import { SettingSegments } from "./SettingSegments.js";

/**
 * The spread *Varied* opens on, for a reader who has not picked one: the middle
 * stop. A default for the control, not a number the model reads.
 */
const OPENING_SPREAD: CarVariationSpread = 10;

/** What *Varied* moves a car off, in the era's "Varies from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "That year's real car",
  last: "Previous year's car",
};

/**
 * The words that follow the screen: the historical answer's label, as the other
 * settings on each screen name theirs, and the notes, which talk about "every
 * season" only where there is more than one.
 */
const COPY: Readonly<
  Record<
    RunUnit,
    {
      readonly historical: string;
      readonly varied: (spread: CarVariationSpread, from: CarVariationBase) => string;
      readonly random: string;
    }
  >
> = {
  season: {
    historical: "As it was",
    varied: (spread) =>
      `Each team's chassis is up to ${spread} points better or worse than the real one, on all four ratings. Engines are as they were.`,
    random:
      "Each chassis rating is drawn anywhere between the season's weakest and strongest car. Engines are as they were.",
  },
  era: {
    historical: "Historical",
    varied: (spread, from) =>
      from === "last"
        ? `Every season, each team's chassis is up to ${spread} points better or worse than the car it raced the year before, on all four ratings. A team new to the run starts from its real car. Engines are as they were.`
        : `Every season, each team's chassis is up to ${spread} points better or worse than the real one, on all four ratings. Engines are as they were.`,
    random:
      "Every season, each chassis rating is drawn anywhere between that year's weakest and strongest car. Engines are as they were.",
  },
};

/**
 * Whether the cars are as authored, varied about them, or random. On both
 * setup screens; the historical label and the notes follow the screen.
 *
 * Under Varied a second row picks how far, as segments like the first, so the
 * stops read at a glance, and on the era's screen a third picks what from: that
 * year's real car, or the previous year's (a walk), which a season has no run behind it
 * for. Both are remembered while the screen is open, so a look at Random and
 * back does not lose them; the season's screen keeps the era's base untouched,
 * and a season races off the real car whatever it says (`seasonSettings`).
 */
export function CarPerformanceSetting({
  carPerformance,
  unit,
  onChange,
}: {
  /** Null is Historical. */
  carPerformance: RunSettings["carPerformance"];
  /** Which screen it is on, which only changes the words. */
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
    <div className="flex flex-col gap-3">
      <SettingSegments
        name="Car performance"
        segments={[
          {
            key: "historical",
            label: COPY[unit].historical,
            selected: carPerformance === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "varied",
            label: "Varied",
            selected: carPerformance?.kind === "varied",
            onPick: () => {
              vary({ spread, from });
            },
          },
          {
            key: "random",
            label: "Random",
            selected: carPerformance?.kind === "random",
            onPick: () => onChange?.({ kind: "random" }),
          },
        ]}
      />
      {carPerformance?.kind === "varied" ? (
        <SettingSegments
          name="Varies by up to"
          segments={CAR_VARIATION_SPREADS.map((each) => ({
            key: String(each),
            label: `±${each}`,
            selected: carPerformance.spread === each,
            onPick: () => {
              vary({ spread: each, from: carPerformance.from });
            },
          }))}
        />
      ) : null}
      {carPerformance?.kind === "varied" && unit === "era" ? (
        <SettingSegments
          name="Varies from"
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
      <p className="text-muted-foreground text-xs">
        {carPerformance === null
          ? "Every car as it really was."
          : carPerformance.kind === "varied"
            ? COPY[unit].varied(carPerformance.spread, carPerformance.from)
            : COPY[unit].random}
      </p>
    </div>
  );
}
