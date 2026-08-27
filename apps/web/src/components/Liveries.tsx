/**
 * Which season's colours to draw, for the components that only know a team id.
 *
 * A result row records a `teamId` and nothing else, but a livery is a per-season
 * fact — the team's livery era, overridden by the season's own entry — so
 * drawing one needs the year as well. Threading it through
 * `RaceClassification`, `DriverName`, `StandingsTable` and the summary would be
 * pass-through props several levels deep, so it rides a context, exactly as the
 * engine supply in `EntryNames` does.
 *
 * The default is "no season", which resolves every team to its most recent
 * livery. That is what a component rendered on its own gets — which is how most
 * of this app is tested — and it is a sensible answer rather than a broken one:
 * outside a season, a team is simply its usual colours.
 *
 * `SeasonGrid` deliberately does not use this, for the same reason it does not
 * use `EntryNames`: it is handed a year directly, which is what lets the grid
 * editor preview a draft the world has never seen.
 */

import type { Livery } from "@alt-hist/data";
import { createContext, useCallback, useContext } from "react";
import { liveryFor } from "../lib/livery.js";

const SeasonYear = createContext<number | undefined>(undefined);

export function Liveries({ year, children }: { year: number; children: React.ReactNode }) {
  return <SeasonYear.Provider value={year}>{children}</SeasonYear.Provider>;
}

/**
 * The season in scope, or undefined outside one.
 *
 * Exported because colours are no longer the only per-season fact a component
 * holding a bare `teamId` needs: a team's *name* is one too, since the lineage
 * that raced as Toleman is Benetton by 1986 and Alpine by 2021. Both questions
 * are answered from the same year, so they read the same context rather than
 * standing up a second one that could drift out of step with this.
 */
export function useSeasonYear(): number | undefined {
  return useContext(SeasonYear);
}

/** A team's colours for the season in scope, or its default outside one. */
export function useLivery(): (teamId: string) => Livery | undefined {
  const year = useContext(SeasonYear);
  return useCallback((teamId: string) => liveryFor(teamId, year), [year]);
}
