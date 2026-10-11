import type { CarVariationBase, RunSettings, RunUnit } from "../lib/run-settings.js";
import { type PerformanceCopy, PerformanceSetting } from "./PerformanceSetting.js";

/** What *Random factor is added* moves an engine off, in the era's "Each year starts from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "The real engine",
  last: "Last year's engine",
};

/** Said in every note: the engine is rolled per supplier, not per team. */
const SHARED = "the same for every team that uses it";

const COPY: PerformanceCopy = {
  season: {
    varied: (spread) =>
      `Each engine is randomly made better or worse than the real one, by up to ${spread} rating points, ${SHARED}.`,
    random: `Each engine is picked at random, ${SHARED}, so any team can have the best engine.`,
  },
  era: {
    varied: (spread, from) =>
      from === "last"
        ? `Each engine starts as the real one, then gets randomly better or worse every year, by up to ${spread} rating points a year, ${SHARED}. Over time it drifts back towards the pack.`
        : `Every year, each engine is randomly made better or worse than the real one, by up to ${spread} rating points, ${SHARED}.`,
    random: `Every year, each engine is picked at random, ${SHARED}, so any team can have the best engine.`,
  },
};

/**
 * *Engine performance*: *Chassis performance*'s answers for the engines
 * (`RunSettings.enginePerformance`), rolled once per engine so every team
 * running it moves together. In both screens' settings.
 */
export function EnginePerformanceSetting({
  enginePerformance,
  unit,
  onChange,
}: {
  /** Null is Historical. */
  enginePerformance: RunSettings["enginePerformance"];
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (enginePerformance: RunSettings["enginePerformance"]) => void;
}) {
  return (
    <PerformanceSetting
      name="Engine performance"
      baseLabels={BASE_LABELS}
      copy={COPY}
      value={enginePerformance}
      unit={unit}
      {...(onChange === undefined ? {} : { onChange })}
    />
  );
}
