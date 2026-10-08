import { useMemo } from "react";
import { keptNotes } from "../lib/kept.js";
import { pendingReason } from "../lib/run-bar.js";
import { driverPoolOf, whatIfsOf } from "../lib/run-settings.js";
import {
  ERA_RATING_MODE,
  latestWorld,
  type PendingRun,
  pendingGrid,
  racedLineup,
} from "../store/season.js";
import { EntryNames } from "./EntryNames.js";
import { type GridEdit, GridStage, previewField } from "./GridStage.js";
import { HomeAdvantage } from "./HomeAdvantage.js";
import { Liveries } from "./Liveries.js";
import { RandomnessNote } from "./RandomnessNote.js";
import { SimulationSettings } from "./SimulationSettings.js";

/**
 * A pending year's grid (*Teams and seats: I fill them*): the year's cars with
 * the seats history and carry-over left, and the editor open on them until
 * every one is filled.
 *
 * The season grid's page without a season: there is no world for the year
 * until Apply, so this is drawn from the run — the kept year, the cars rolled
 * from its seed, the rules of the year before — and its field is the preview
 * of the seats as they stand. Pure, like `SeasonView`; the page wires `onFill`.
 */
export function PendingGrid({
  run,
  onFill,
}: {
  run: PendingRun;
  /** Absent in tests, where nothing is clicked. */
  onFill?: (edit: GridEdit) => void;
}) {
  const last = latestWorld(run);
  const { year, kept } = run.pending;
  const pool = driverPoolOf(last.settings);
  const { cars, seats, baselineChassis } = useMemo(() => pendingGrid(run), [run]);
  const field = useMemo(
    () => previewField(cars, seats, ERA_RATING_MODE, pool),
    [cars, seats, pool],
  );
  const notes = useMemo(() => {
    const found = keptNotes({ year, gridKeptFrom: last.gridKeptFrom, kept, keptSeats: seats });
    // The short teams are the seats waiting on the reader, which the grid's own
    // empty-seat notice already counts; "nobody free to sign" is the automatic
    // fills' sentence, and untrue here.
    return found === null ? null : { ...found, short: [] };
  }, [year, last.gridKeptFrom, kept, seats]);

  return (
    <EntryNames field={field}>
      <HomeAdvantage field={field}>
        <Liveries year={year}>
          <div className="flex flex-col gap-6">
            <p className="text-sm">
              <span className="font-medium">{pendingReason(run)}.</span> History leaves them empty
              in {year} and nobody was carried into them, so the run waits here until you put a
              driver in each. Whoever you place becomes part of the year's grid.
            </p>
            <div className="flex flex-col gap-1">
              <RandomnessNote level={last.randomness} />
              <SimulationSettings
                settings={whatIfsOf(last.settings)}
                className="text-muted-foreground text-xs"
              />
            </div>
            <GridStage
              // A new seed is new cars, so the editor starts again on them.
              key={run.pending.seed}
              field={field}
              year={year}
              ratingMode={ERA_RATING_MODE}
              lineup={null}
              engines={null}
              baselineChassis={baselineChassis}
              runSeason={cars}
              kept={notes}
              inEra
              previousLineup={racedLineup(last)}
              pool={pool}
              pendingSeats={seats}
              {...(onFill === undefined ? {} : { onApply: onFill })}
            />
          </div>
        </Liveries>
      </HomeAdvantage>
    </EntryNames>
  );
}
