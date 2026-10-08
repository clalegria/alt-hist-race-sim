import type { PointsScale } from "@alt-hist/engine";
import {
  pointsTableOf,
  pointsTables,
  pointsValues,
  type RunUnit,
  samePoints,
} from "../lib/run-settings.js";
import { SettingSelect } from "./SettingSegments.js";

/** The historical answer's value in the `select`: no table. */
const OWN = "own";

/**
 * The historical answer's words. A season names its own table, since there is
 * only one year to read it off; an era's differs year by year.
 */
function ownLabel(unit: RunUnit, year: number): string {
  if (unit === "era") {
    return "Each year's own";
  }
  const table = pointsTableOf(year);
  return table === undefined ? "As it was" : `As it was · ${pointsValues(table.scale)}`;
}

/**
 * Which points table the run is scored on: each year's own, or one authored
 * table for every year — one `select` (`SettingSelect`), the historical answer
 * first and then every distinct table in the seed data, labelled by its years
 * and values. No note: the option chosen already says what it scores.
 *
 * Points are scoring, not simulation: the same seed races the same races under
 * any table, and only who the standings put first can change.
 */
export function PointsSetting({
  points,
  year,
  unit,
  onChange,
}: {
  points: PointsScale | null;
  /** The year on the picker, whose own table a season's historical answer names. */
  year: number;
  /** Which screen it is for, which only changes the words. */
  unit: RunUnit;
  /** Absent in tests, where nothing is chosen. */
  onChange?: (points: PointsScale | null) => void;
}) {
  const tables = pointsTables();
  const selected =
    points === null ? -1 : tables.findIndex((table) => samePoints(table.scale, points));

  return (
    <SettingSelect
      name="Points"
      value={selected === -1 ? OWN : String(selected)}
      onChange={(value) => {
        if (value === OWN) {
          onChange?.(null);
          return;
        }
        const table = tables[Number(value)];
        if (table !== undefined) {
          onChange?.(table.scale);
        }
      }}
    >
      <option value={OWN}>{ownLabel(unit, year)}</option>
      {tables.map((table, index) => (
        <option key={table.label} value={index}>
          {table.label}
        </option>
      ))}
    </SettingSelect>
  );
}
