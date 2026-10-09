/**
 * Who is running whose engine, for the tables that only know a team id.
 *
 * A result row records a `teamId` and nothing else — the championship is a
 * table of teams, not of engine deals — but "Williams-Ford" is the name the
 * season is actually run under, and it has to be the same name in every table
 * or it reads as a bug. Threading a map through `StandingsTable`,
 * `CompactStandings`, `DriverName`, `QualifyingResults` and the summary would
 * be six pass-through props deep, so it rides a context instead.
 *
 * The map comes off the **field**, not the seed files: who supplies whom is
 * something the reader can change, and `world.field` is the record of the grid
 * as it was actually raced. That is the same reason the field is in the world
 * at all.
 *
 * The default is an empty map, so a component rendered on its own — which is
 * how most of this app is tested — shows plain team names rather than throwing.
 * `SeasonGrid` deliberately does *not* use this: it is handed a field directly
 * and reads the engine off that, which is what lets the grid editor preview a
 * draft the world has never seen.
 *
 * The team half of the name also depends on the run: under an era's *Team
 * name changes: No*, each team keeps the name and base of its first season
 * in the run. `KeptNames` carries that year down from the run's frame, and every
 * team name and team flag on screen goes through `useNameYear`.
 */

import { firstYearInRun } from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { createContext, useCallback, useContext, useMemo } from "react";
import { entryName, teamCountry, teamName } from "../lib/names.js";
import { useSeasonYear } from "./Liveries.js";

const NO_ENGINES: ReadonlyMap<string, string> = new Map();

const EngineSupply = createContext<ReadonlyMap<string, string>>(NO_ENGINES);

/**
 * The year the run's team names are kept from (`World.namesKeptFrom`), or null
 * for every team named as it was — the default, so a component rendered on its
 * own names teams as history did.
 */
const KeptFrom = createContext<number | null>(null);

/** The run's frame provides it once, over every page of the run. */
export function KeptNames({ from, children }: { from: number | null; children: React.ReactNode }) {
  return <KeptFrom.Provider value={from}>{children}</KeptFrom.Provider>;
}

/**
 * The year a team's name and base are read at, for a row of `year`: `year`
 * itself, or under kept names the team's first season in the run. An undefined
 * year — no season in hand — stays undefined, the team's most recent name.
 *
 * For a name or a flag only: the livery has its own setting (`useLiveryYear`), and
 * the car's shape follows the season.
 */
export function useNameYear(): (teamId: string, year?: number) => number | undefined {
  const from = useContext(KeptFrom);
  return useCallback(
    (teamId: string, year?: number) =>
      year === undefined ? undefined : firstYearInRun(teamId, year, from),
    [from],
  );
}

/**
 * A team's name for a row of `year`, under the run's naming — for a page that
 * holds a year per row rather than a season in scope: a career, an index, a
 * record. Stable while the run's naming is, so it can sit in a memo's deps.
 */
export function useTeamNameIn(): (teamId: string, year?: number) => string {
  const nameYear = useNameYear();
  return useCallback(
    (teamId: string, year?: number) => teamName(teamId, nameYear(teamId, year)),
    [nameYear],
  );
}

/** Where a team is based in a row of `year`: the flag beside `useTeamNameIn`'s name. */
export function useTeamCountryIn(): (teamId: string, year?: number) => string | undefined {
  const nameYear = useNameYear();
  return useCallback(
    (teamId: string, year?: number) => teamCountry(teamId, nameYear(teamId, year)),
    [nameYear],
  );
}

/** Which engine each team runs, taken off the grid as it was raced. */
function engineSupplyOf(field: readonly RaceEntrant[]): ReadonlyMap<string, string> {
  const supply = new Map<string, string>();
  for (const entrant of field) {
    if (entrant.engineId !== undefined) {
      supply.set(entrant.teamId, entrant.engineId);
    }
  }
  return supply;
}

export function EntryNames({
  field,
  children,
}: {
  field: readonly RaceEntrant[];
  children: React.ReactNode;
}) {
  const supply = useMemo(() => engineSupplyOf(field), [field]);
  return <EngineSupply.Provider value={supply}>{children}</EngineSupply.Provider>;
}

/**
 * The entry name for a team — "Williams-Ford" inside a season, plain "Williams"
 * outside one.
 *
 * The season also decides the *team* half of that name, so it takes the year
 * from `Liveries` rather than a second context of its own: the same lineage is
 * "Toleman-Hart" in 1984 and "Alpine-Renault" in 2024.
 */
export function useEntryName(): (teamId: string) => string {
  const supply = useContext(EngineSupply);
  const year = useSeasonYear();
  const nameYear = useNameYear();
  return (teamId: string) => entryName(teamId, supply.get(teamId), nameYear(teamId, year));
}

/** A team's name alone, for the same season — no engine, no hyphen. */
export function useTeamName(): (teamId: string) => string {
  const year = useSeasonYear();
  const nameYear = useNameYear();
  return (teamId: string) => teamName(teamId, nameYear(teamId, year));
}

/** Where a team is based, for its flag beside the name `useTeamName` gives. */
export function useTeamCountry(): (teamId: string) => string | undefined {
  const year = useSeasonYear();
  const nameYear = useNameYear();
  return (teamId: string) => teamCountry(teamId, nameYear(teamId, year));
}
