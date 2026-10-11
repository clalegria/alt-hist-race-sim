import type { CarVariationBase, RunSettings, RunUnit } from "../lib/run-settings.js";
import { type PerformanceCopy, PerformanceSetting } from "./PerformanceSetting.js";

/** What *Random factor is added* moves a chassis off, in the era's "Each year starts from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "The real chassis",
  last: "Last year's chassis",
};

const COPY: PerformanceCopy = {
  season: {
    varied: (spread) =>
      `Each team's chassis is randomly made better or worse than the real one, by up to ${spread} rating points.`,
    random: "Each team's chassis is picked at random, so any team can have the best car.",
  },
  era: {
    varied: (spread, from) =>
      from === "last"
        ? `Each chassis starts as the real one, then gets randomly better or worse every year, by up to ${spread} rating points a year. Over time it drifts back towards the pack.`
        : `Every year, each team's chassis is randomly made better or worse than the real one, by up to ${spread} rating points.`,
    random:
      "Every year, each team's chassis is picked at random, so any team can have the best car.",
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
