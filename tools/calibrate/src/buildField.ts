import { driversById, season1980 } from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";

/**
 * Turns the 1980 seed into a race field.
 *
 * Driver ratings are taken straight from the authored `peak` block. That is a
 * placeholder: once the ageing curve exists, a driver's current ratings will be
 * derived from their peak, their age, and their development/decline speeds.
 * Whether those curves key off season or age is still an open decision, so
 * nothing here tries to pre-empt it.
 */
export function buildField(): RaceEntrant[] {
  const drivers = driversById();
  const field: RaceEntrant[] = [];

  for (const entry of season1980.entries) {
    for (const driverId of entry.drivers) {
      const driver = drivers.get(driverId);
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
