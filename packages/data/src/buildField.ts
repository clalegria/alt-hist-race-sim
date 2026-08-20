/**
 * Turns the authored seed into a race field.
 *
 * This is the seam between authored data and the engine's runtime model, and it
 * belongs here rather than in either: the engine may not read data, and every
 * consumer that wants to run a race needs exactly this mapping. The dependency
 * on `@alt-hist/engine` is type-only and erases at build time, so no runtime
 * edge exists in either direction.
 *
 * Driver ratings are taken straight from the authored `peak` block. That is a
 * placeholder: once the ageing curve exists, a driver's current ratings will be
 * derived from their peak, their age, and their development/decline speeds.
 * Whether those curves key off season or age is still an open decision, so
 * nothing here tries to pre-empt it.
 */

import type { RaceEntrant } from "@alt-hist/engine";
import { drivers as driverPool, season1980 } from "./index.js";
import type { Driver, SeasonSeed } from "./types.js";

export function buildField(
  season: SeasonSeed = season1980,
  pool: readonly Driver[] = driverPool,
): RaceEntrant[] {
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  const field: RaceEntrant[] = [];

  for (const entry of season.entries) {
    for (const driverId of entry.drivers) {
      const driver = byId.get(driverId);
      if (driver === undefined) {
        throw new Error(`Season entry "${entry.teamId}" references unknown driver "${driverId}"`);
      }

      field.push({
        driverId,
        teamId: entry.teamId,
        driver: {
          racing: driver.peak.racing,
          qualifying: driver.peak.qualifying,
          consistency: driver.peak.consistency,
          adaptability: driver.peak.adaptability,
          composure: driver.peak.composure,
        },
        car: entry.car,
      });
    }
  }

  return field;
}
