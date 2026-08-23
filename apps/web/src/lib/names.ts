/**
 * Display names for ids.
 *
 * The seed data is static and bundled, so these maps are built once at module
 * load rather than threaded through props. Ids are the fallback: a name that
 * cannot be resolved should show as something traceable, not as blank.
 */

import { driversById, enginesById, teamsById } from "@alt-hist/data";

const drivers = driversById();
const teams = teamsById();
const engines = enginesById();

export function driverName(driverId: string): string {
  return drivers.get(driverId)?.name ?? driverId;
}

export function teamName(teamId: string): string {
  return teams.get(teamId)?.name ?? teamId;
}

export function engineName(engineId: string): string {
  return engines.get(engineId)?.name ?? engineId;
}

/**
 * A team as an entry: chassis and engine, the way a season's entry list writes
 * it — "Williams-Ford", "Ligier-Matra", "Toleman-Hart".
 *
 * **A works team keeps its bare name.** Renault building its own engine is not
 * a "Renault-Renault", and neither is Ferrari; the hyphen exists to say who
 * *supplied* the engine, so when that is the team itself there is nothing to
 * say. Compared on the names rather than the ids, because that is the claim
 * being made — two records that happen to share an id spelling are not the
 * point, and the same manufacturer can be a team in one season and only a
 * supplier in another.
 *
 * With no engine it is just the team, which is what every table showed before
 * engines existed and what a component rendered outside a season still shows.
 */
export function entryName(teamId: string, engineId?: string): string {
  const team = teamName(teamId);
  if (engineId === undefined) {
    return team;
  }
  const engine = engineName(engineId);
  return engine.toLowerCase() === team.toLowerCase() ? team : `${team}-${engine}`;
}
