import type { CarVariationBase, RunSettings, RunUnit } from "../lib/run-settings.js";
import { type PerformanceCopy, PerformanceSetting } from "./PerformanceSetting.js";

/** What *Random factor is added* moves a chassis off, in the era's "Varies from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "The historical chassis",
  last: "Previous season's chassis",
};

const COPY: PerformanceCopy = {
  season: {
    varied: (spread) => `Each chassis is moved up to ±${spread} off its historical rating.`,
    random:
      "Each chassis rating is drawn at random between the season's weakest and strongest car.",
  },
  era: {
    varied: (spread, from) =>
      from === "last"
        ? `Each season, each chassis moves up to ±${spread} off the one it raced the year before, so cars drift over the years. A team new to the run starts from its historical chassis.`
        : `Every season, each chassis is moved up to ±${spread} off its historical rating.`,
    random:
      "Every season, each chassis rating is drawn at random between that year's weakest and strongest car.",
  },
};

/**
 * *Chassis performance*: whether each team's chassis is as authored, varied
 * about it, or random (`RunSettings.carPerformance`). In both screens'
 * settings; the notes follow the screen.
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
  return (
    <PerformanceSetting
      name="Chassis performance"
      baseLabels={BASE_LABELS}
      copy={COPY}
      value={carPerformance}
      unit={unit}
      {...(onChange === undefined ? {} : { onChange })}
    />
  );
}
