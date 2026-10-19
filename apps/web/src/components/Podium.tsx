import type { PointsScale, RaceEntryResult } from "@alt-hist/engine";
import { formatGap } from "../lib/format.js";
import { PODIUM_POSITION, STANDOUT_POSITION } from "../lib/highlight.js";
import { pointsFor } from "../lib/results.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { HomeStar } from "./HomeAdvantage.js";
import { DriverHistory } from "./SeasonHistory.js";
import { TeamCar } from "./TeamCar.js";

/**
 * Which column each step stands in and how tall its block is, by position.
 *
 * The list is in finishing order, so a screen reader reads first, second,
 * third; the grid's column placement alone puts second on the left and third
 * on the right. The web convention for a visual arrangement that differs from
 * the reading one: keep the DOM in the order that makes sense, and move the
 * boxes in CSS. Placed by column rather than `order`, so a race with no third
 * still has its winner in the middle.
 */
const STEP: Record<number, { column: string; height: string }> = {
  // Third's height is what its number and line take; each step up adds the same.
  1: { column: "col-start-2", height: "min-h-19 md:min-h-21" },
  2: { column: "col-start-1", height: "min-h-16 md:min-h-18" },
  3: { column: "col-start-3", height: "min-h-13 md:min-h-15" },
};

/**
 * The large car, a step smaller on a phone, where three of them side by side
 * would not fit a column a third of the screen wide.
 */
const PHONE_CAR = "max-md:h-7 max-md:w-24";

function Step({
  entry,
  points,
  country,
}: {
  entry: RaceEntryResult;
  points: PointsScale;
  country: string | undefined;
}) {
  const position = entry.finishPosition ?? 0;
  const won = position === 1;
  const step = STEP[position];
  const scored = pointsFor(entry, points);
  // One line under the number: the gap (the winner has none) and the points,
  // left out at zero as the table's points column is.
  const facts = [
    won || entry.raceGapToWinner === null ? null : formatGap(entry.raceGapToWinner),
    scored === 0 ? null : `${scored} pts`,
  ].filter((fact) => fact !== null);
  return (
    <li className={cn("row-start-1 flex min-w-0 flex-col items-center gap-2", step?.column)}>
      <TeamCar teamId={entry.teamId} size="large" className={PHONE_CAR} />
      <span className="flex max-w-full items-end gap-1.5 text-xs md:text-sm">
        <DriverHistory driverId={entry.driverId}>
          <DriverName driverId={entry.driverId} teamId={entry.teamId} emphasis={won} badge />
        </DriverHistory>
        <HomeStar driverId={entry.driverId} country={country} className="pb-0.5" />
      </span>
      {/*
        The position block of the classification, grown: the winner's filled
        with the accent, second and third a number in it on the header's fill.
      */}
      <span
        className={cn(
          "bg-card-header border-border flex w-full flex-col items-center justify-center gap-1 border px-0.5 py-1",
          step?.height,
          won ? cn(STANDOUT_POSITION, "border-primary") : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "text-2xl leading-none font-semibold tabular-nums md:text-3xl",
            won || PODIUM_POSITION,
          )}
        >
          {position}
        </span>
        {facts.length === 0 ? null : (
          // A size down on a phone, where a column is a third of the screen.
          // Still free to wrap, for a gap of a minute or more: the heights
          // above are minimums for that.
          <span className="text-center text-[11px] leading-none tabular-nums md:text-xs md:leading-none">
            {facts.join(" · ")}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * The top three of a race on stepped blocks, in 2-1-3 order: the head of the
 * race screen's classification, which still lists them below.
 *
 * Handed only the cars it draws: a race with fewer than three classified
 * finishers stands only the steps that have someone on them.
 */
export function Podium({
  entries,
  points,
  country,
}: {
  /** The classified finishers in the top three, in finishing order. */
  entries: readonly RaceEntryResult[];
  points: PointsScale;
  country: string | undefined;
}) {
  return (
    <ol
      aria-label="Podium"
      className="grid grid-cols-[repeat(3,minmax(0,13rem))] items-end justify-center gap-1 px-1 pt-4 pb-2 md:gap-1.5 md:px-4 md:pt-5"
    >
      {entries.map((entry) => (
        <Step key={entry.driverId} entry={entry} points={points} country={country} />
      ))}
    </ol>
  );
}
