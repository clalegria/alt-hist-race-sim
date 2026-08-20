import type { ConstructorStanding, DriverStanding } from "@alt-hist/engine";

/** Either championship table's row. They differ only in what names them. */
export type Standing = DriverStanding | ConstructorStanding;

export function isDriverStanding(standing: Standing): standing is DriverStanding {
  return "driverId" in standing;
}

/** What identifies a row: a driver id or a team id, depending on the table. */
export function standingKey(standing: Standing): string {
  return isDriverStanding(standing) ? standing.driverId : standing.teamId;
}

/** Where each row sits, 1-based, for comparing one round's table against another. */
export function positionsOf(standings: readonly Standing[]): ReadonlyMap<string, number> {
  return new Map(standings.map((standing, index) => [standingKey(standing), index + 1]));
}
