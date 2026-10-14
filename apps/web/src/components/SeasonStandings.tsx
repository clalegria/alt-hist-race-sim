import type { CalendarRace } from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  type PointsScale,
  type SeasonResult,
} from "@alt-hist/engine";
import { useMemo } from "react";
import { StandingsEvolution } from "./StandingsEvolution.js";
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
  year,
  points,
  label,
  badge = false,
  car = false,
  charts = false,
}: {
  season: SeasonResult;
  /** Names the rounds inside a row's expansion. From the season's own year. */
  calendar: readonly CalendarRace[];
  /** The season's year, so an expansion's rounds link to their races. */
  year?: number | undefined;
  /** The scale the year was scored on, never assumed. */
  points: PointsScale;
  /** The tables' head-band label: "Final", or how far the season has got. */
  label: string;
  /**
   * Draw a livery badge on every row. The season summary does; the roll of
   * honour, where this pair *is* an expansion, does not.
   */
  badge?: boolean;
  /** Draw each team's car on every row, by the same rule and with the same default. */
  car?: boolean;
  /**
   * Draw each championship's evolution chart under its own table.
   *
   * Off by default, like `badge`, so a new call site has to ask: the season
   * summary wants them, the roll of honour — where this pair is itself the
   * expansion of a row — does not.
   */
  charts?: boolean;
}) {
  const drivers = useMemo(() => championshipStandings(season, points), [season, points]);
  const constructors = useMemo(() => constructorStandings(season, points), [season, points]);

  return (
    <>
      <StandingsTable
        title="Drivers&rsquo; Championship"
        label={label}
        nameColumn="Driver"
        standings={drivers}
        season={season}
        points={points}
        calendar={calendar}
        year={year}
        badge={badge}
        car={car}
      />
      {/*
        Under the table rather than above it or beside it: the table says who
        won, and this says when. The pair reads as one answer.
      */}
      {charts ? (
        <StandingsEvolution
          championship="drivers"
          season={season}
          points={points}
          calendar={calendar}
        />
      ) : null}
      <StandingsTable
        title="Constructors&rsquo; Championship"
        label={label}
        nameColumn="Team"
        standings={constructors}
        season={season}
        points={points}
        calendar={calendar}
        year={year}
        badge={badge}
        car={car}
      />
      {charts ? (
        <StandingsEvolution
          championship="constructors"
          season={season}
          points={points}
          calendar={calendar}
        />
      ) : null}
    </>
  );
}
