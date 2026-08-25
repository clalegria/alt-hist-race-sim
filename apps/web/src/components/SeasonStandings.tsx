import type { CalendarRace } from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  type PointsScale,
  type SeasonResult,
} from "@alt-hist/engine";
import { useMemo } from "react";
import { StandingsTable } from "./StandingsTable.js";

/**
 * Both championship tables over one season.
 *
 * Its own component because two screens end in it — the season summary and a
 * year opened out of the era's roll of honour — and "the championship, as this
 * app draws it" should have one answer. A second copy would drift the first
 * time a column moved.
 *
 * Derived here rather than stored, like every other table: standings are a
 * function of the result rows, and `{ races: races.slice(0, n) }` is the same
 * function over a shorter season.
 */
export function SeasonStandings({
  season,
  calendar,
  points,
  description,
}: {
  season: SeasonResult;
  /** Names the rounds inside a row's expansion. From the season's own year. */
  calendar: readonly CalendarRace[];
  /** The scale the year was scored on, never assumed. */
  points: PointsScale;
  /** What the table is of — "Final classification.", or a round count. */
  description: string;
}) {
  const drivers = useMemo(() => championshipStandings(season, points), [season, points]);
  const constructors = useMemo(() => constructorStandings(season, points), [season, points]);

  return (
    <>
      <StandingsTable
        title="Drivers&rsquo; Championship"
        description={description}
        nameColumn="Driver"
        standings={drivers}
        season={season}
        points={points}
        calendar={calendar}
      />
      <StandingsTable
        title="Constructors&rsquo; Championship"
        description={description}
        nameColumn="Team"
        standings={constructors}
        season={season}
        points={points}
        calendar={calendar}
      />
    </>
  );
}
