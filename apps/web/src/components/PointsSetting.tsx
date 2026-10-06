import type { PointsScale } from "@alt-hist/engine";
import { pointsTableOf, pointsTables, pointsValues, samePoints } from "../lib/run-settings.js";
import { cn } from "../lib/utils.js";

/**
 * Which points table the run is scored on: each year's own, or one authored
 * table for every year.
 *
 * A segmented control, so every run setting reads historical-versus-what-if the
 * same way, with the historical answer first. The table is a native `select`
 * for the reason the grid's engine picker is one: the platform control is
 * keyboard- and screen-reader-complete without being rebuilt by hand.
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
  const options = [
    { key: "own", label: "Each year's own", selected: points === null, pick: null },
    {
      key: "same",
      label: "Same all run",
      selected: points !== null,
      pick: points ?? pointsTableOf(year)?.scale ?? tables[0]?.scale ?? null,
    },
  ];
  const selected =
    points === null ? -1 : tables.findIndex((table) => samePoints(table.scale, points));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold tracking-tight">Points</span>
        <fieldset
          aria-label="Points"
          className="border-border inline-flex shrink-0 self-start rounded-md border p-0.5"
        >
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={option.selected}
              onClick={() => {
                if (!option.selected) {
                  onChange?.(option.pick);
                }
              }}
              className={cn(
                "focus-visible:ring-ring h-8 cursor-pointer rounded px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                option.selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>

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
            className="border-border bg-background focus-visible:ring-ring min-w-0 cursor-pointer rounded border px-1.5 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none sm:max-w-sm"
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
