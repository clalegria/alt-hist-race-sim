import type { RatingMode, SigningPool } from "@alt-hist/data";
import { AgeRangeInput } from "./AgeRangeInput.js";
import { SettingCheck, SettingRow } from "./SettingSegments.js";

/**
 * *Drivers who can be signed*: the one pool the kept teams' empty seats and a
 * reseat's drivers without a drive are drawn from (`RunSettings.driverPool`).
 * Not a what-if, so no historical answer and no note; the form shows it only
 * while something signs drivers (`signsDrivers`). Under *At their best* the
 * ages are each driver's age at their best.
 */
export function DriverPoolSetting({
  pool,
  ratingMode,
  onChange,
}: {
  pool: SigningPool;
  ratingMode: RatingMode;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (pool: SigningPool) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingRow name="Drivers who can be signed">
        <AgeRangeInput
          band={pool}
          ratingMode={ratingMode}
          {...(onChange === undefined ? {} : { onChange })}
        />
      </SettingRow>
      <SettingCheck
        label="Only drivers racing that year"
        checked={pool.activeOnly}
        onChange={(activeOnly) => onChange?.({ ...pool, activeOnly })}
      />
    </div>
  );
}
