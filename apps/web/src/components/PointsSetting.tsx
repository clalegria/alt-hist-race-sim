import type { PointsScale } from "@alt-hist/engine";
import { pointsTableOf, pointsTables, pointsValues, samePoints } from "../lib/run-settings.js";
import { SETTING_SELECT_CLASS, SettingSegments } from "./SettingSegments.js";

/**
 * Which points table the run is scored on: each year's own, or one authored
 * table for every year.
 *
 * The table is a native `select` for the reason the grid's engine picker is
 * one: the platform control is keyboard- and screen-reader-complete without
 * being rebuilt by hand.
 *
 * Points are scoring, not simulation: the same seed races the same races under
 * any table, and only who the standings put first can change.
 */
export function PointsSetting({
  points,
  year,
  onChange,
}: {
  points: PointsScale | null;
  /** The year on the picker, whose table *Same all run* starts from. */
  year: number;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (points: PointsScale | null) => void;
}) {
  const tables = pointsTables();
  const start = pointsTableOf(year)?.scale ?? tables[0]?.scale ?? null;
  const selected =
    points === null ? -1 : tables.findIndex((table) => samePoints(table.scale, points));

  return (
    <div className="flex flex-col gap-3">
      <SettingSegments
        name="Points"
        segments={[
          {
            key: "own",
            label: "Each year's own",
            selected: points === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "same",
            label: "Same all run",
            selected: points !== null,
            onPick: () => onChange?.(start),
          },
        ]}
      />

      {points === null ? (
        <p className="text-muted-foreground text-xs">
          Every year is scored on the points it really used.
        </p>
      ) : (
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">
            Every year of the run is scored {pointsValues(points)}.
          </span>
          <select
            value={selected}
            onChange={(event) => {
              const table = tables[Number(event.target.value)];
              if (table !== undefined) {
                onChange?.(table.scale);
              }
            }}
            className={SETTING_SELECT_CLASS}
          >
            {tables.map((table, index) => (
              <option key={table.label} value={index}>
                {table.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
