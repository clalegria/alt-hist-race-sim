/**
 * Display names for ids.
 *
 * The seed data is static and bundled, so these maps are built once at module
 * load rather than threaded through props. Ids are the fallback: a name that
 * cannot be resolved should show as something traceable, not as blank.
 */

import { driversById, enginesById, teamIdentityIn, teamsById } from "@alt-hist/data";

const drivers = driversById();
const teams = teamsById();
const engines = enginesById();

export function driverName(driverId: string): string {
  return drivers.get(driverId)?.name ?? driverId;
}

/**
 * What the team was called in `year` — Toleman in 1983, Benetton in 1991,
 * Alpine in 2024, all of them the same `teamId`.
 *
 * The year is optional and every caller inside a season should pass it. Without
 * one the team's most recent name is used, which is the right answer for a list
 * of teams with no season in hand and the wrong one inside a table of 1983
 * results — so the omission is the exception, not the default.
 */
export function teamName(teamId: string, year?: number): string {
  const team = teams.get(teamId);
  return team === undefined ? teamId : teamIdentityIn(team, year).name;
}

export function engineName(engineId: string): string {
  return engines.get(engineId)?.name ?? engineId;
}

/**
 * Which flag goes beside a name: a driver's nationality, a team's base.
 *
 * Here rather than in each component that draws one, because the alternative
 * was five more module-level `driversById()` / `teamsById()` maps and seven
 * copies of `.get(id)?.nationality`. Undefined for an id the seed data does not
 * know, which is what `Flag` and every caller already treat as "no flag".
 */
export function driverCountry(driverId: string): string | undefined {
  return drivers.get(driverId)?.nationality;
}

export function teamCountry(teamId: string, year?: number): string | undefined {
  const team = teams.get(teamId);
  return team === undefined ? undefined : teamIdentityIn(team, year).base;
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
 *
 * `year` is passed through to `teamName`, and it matters here beyond the label:
 * the works-team test compares the two names, so the same lineage is
 * "Renault" in 2019 and "Lotus-Renault" in 2013.
 */
export function entryName(teamId: string, engineId?: string, year?: number): string {
  const team = teamName(teamId, year);
  if (engineId === undefined) {
    return team;
  }
  const engine = engineName(engineId);
  return engine.toLowerCase() === team.toLowerCase() ? team : `${team}-${engine}`;
}
