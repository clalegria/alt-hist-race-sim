/**
 * Display names for ids.
 *
 * The seed data is static and bundled, so these maps are built once at module
 * load rather than threaded through props. Ids are the fallback: a name that
 * cannot be resolved should show as something traceable, not as blank.
 */

import { driversById, teamsById } from "@alt-hist/data";

const drivers = driversById();
const teams = teamsById();

export function driverName(driverId: string): string {
  return drivers.get(driverId)?.name ?? driverId;
}

export function teamName(teamId: string): string {
  return teams.get(teamId)?.name ?? teamId;
}
