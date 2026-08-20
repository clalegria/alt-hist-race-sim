import type { ConstructorStanding, DriverStanding } from "@alt-hist/engine";

/** Either championship table's row. They differ only in what names them. */
export type Standing = DriverStanding | ConstructorStanding;

export function isDriverStanding(standing: Standing): standing is DriverStanding {
  return "driverId" in standing;
}
