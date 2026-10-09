import type { CarVariationBase, RunSettings, RunUnit } from "../lib/run-settings.js";
import { type PerformanceCopy, PerformanceSetting } from "./PerformanceSetting.js";

/** What *Random factor is added* moves an engine off, in the era's "Varies from" row: history first. */
const BASE_LABELS: Readonly<Record<CarVariationBase, string>> = {
  real: "The historical engine",
  last: "Previous season's engine",
};

/** Said once at the end of every note: the engine is rolled per supplier, not per team. */
const SHARED = "the same for every team that runs it.";

const COPY: PerformanceCopy = {
  season: {
    varied: (spread) =>
      `Each engine is moved up to ±${spread} off its historical rating, ${SHARED}`,
    random: `Each engine rating is drawn at random between the season's weakest and strongest engine, ${SHARED}`,
  },
  era: {
    varied: (spread, from) =>
      from === "last"
        ? `Each season, each engine moves up to ±${spread} off the one raced the year before, ${SHARED} An engine new to the run starts from its historical rating.`
        : `Every season, each engine is moved up to ±${spread} off its historical rating, ${SHARED}`,
    random: `Every season, each engine rating is drawn at random between that year's weakest and strongest engine, ${SHARED}`,
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
