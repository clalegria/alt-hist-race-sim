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
 */

import type { RaceEntrant } from "@alt-hist/engine";
import { createContext, useContext, useMemo } from "react";
import { entryName, teamName } from "../lib/names.js";
import { useSeasonYear } from "./Liveries.js";

const NO_ENGINES: ReadonlyMap<string, string> = new Map();

const EngineSupply = createContext<ReadonlyMap<string, string>>(NO_ENGINES);

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
  return (teamId: string) => entryName(teamId, supply.get(teamId), year);
}

/** A team's name alone, for the same season — no engine, no hyphen. */
export function useTeamName(): (teamId: string) => string {
  const year = useSeasonYear();
  return (teamId: string) => teamName(teamId, year);
}
