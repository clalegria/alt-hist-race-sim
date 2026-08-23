import {
  type CalendarRace,
  driversById,
  engineChanges,
  lineupChanges,
  type RatingMode,
  type SeasonEngines,
  type SeasonLineup,
  teamsById,
} from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  type RaceEntrant,
  type RaceResult,
  type SeasonResult,
} from "@alt-hist/engine";
import { useMemo } from "react";
import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { driverName } from "../lib/names.js";
import { seasonSeed } from "../lib/seasons.js";
import { positionsOf } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import type { View, World } from "../store/season.js";
import { CompactStandings } from "./CompactStandings.js";
import { EntryNames, useEntryName } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { type GridEdit, GridStage } from "./GridStage.js";
import { EditedGridBanner } from "./LineupChanges.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { RatingModeToggle } from "./RatingModeToggle.js";
import { SeasonCalendar } from "./SeasonCalendar.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { StandingsTable } from "./StandingsTable.js";
import { TitleBanner } from "./TitleBanner.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

const driverRecords = driversById();
const teams = teamsById();

/** The name of a round, falling back to a bare number if the calendar is short. */
function roundLabel(
  calendar: readonly CalendarRace[],
  round: number,
): { name: string; circuit: string; country: string } {
  const race = calendar[round];
  return {
    name: race?.name ?? `Round ${round + 1}`,
    circuit: race?.circuit ?? "",
    country: race?.country ?? "",
  };
}

/**
 * Everything raced up to and including a round.
 *
 * Mid-season standings need no special support: the championship is derived from
 * results on read, so a shorter list of results is simply an earlier table.
 */
function seasonSoFar(season: SeasonResult, throughRound: number): SeasonResult {
  return { races: season.races.slice(0, throughRound + 1) };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function Section({
  title,
  subtitle,
  country,
  children,
}: {
  title: string;
  subtitle: string;
  country?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {country === undefined || country === "" ? null : (
            <Flag country={country} title={country} className="h-4 w-6" />
          )}
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      {children}
    </Card>
  );
}

function Champion({
  label,
  name,
  detail,
  country,
}: {
  label: string;
  name: string;
  detail: string;
  country?: string | undefined;
}) {
  return (
    // The same accent pole and the race winner carry: whoever won the thing on
    // screen looks the same wherever you meet them.
    <Card className={cn("flex-1", STANDOUT_SURFACE)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("flex items-center gap-2 text-xl", STANDOUT_TEXT)}>
          {country === undefined || country === "" ? null : (
            <Flag country={country} title={country} className="h-4 w-6" />
          )}
          {name}
        </CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

/** Both championship tables over whatever slice of the season is given. */
function Standings({
  season,
  calendar,
  midSeason,
}: {
  season: SeasonResult;
  calendar: readonly CalendarRace[];
  midSeason: boolean;
}) {
  const drivers = useMemo(() => championshipStandings(season), [season]);
  const constructors = useMemo(() => constructorStandings(season), [season]);
  const when = midSeason
    ? `After ${plural(season.races.length, "round")}.`
    : "Final classification.";

  return (
    <>
      <StandingsTable
        title="Drivers&rsquo; Championship"
        description={when}
        nameColumn="Driver"
        standings={drivers}
        season={season}
        calendar={calendar}
      />
      <StandingsTable
        title="Constructors&rsquo; Championship"
        description={when}
        nameColumn="Team"
        standings={constructors}
        season={season}
        calendar={calendar}
      />
    </>
  );
}

function Summary({
  season,
  field,
  year,
  lineup,
  engines,
}: {
  season: SeasonResult;
  field: readonly RaceEntrant[];
  year: number;
  lineup: SeasonLineup | null;
  engines: SeasonEngines | null;
}) {
  const nameOf = useEntryName();
  const champion = useMemo(() => championshipStandings(season)[0], [season]);
  const topTeam = useMemo(() => constructorStandings(season)[0], [season]);
  const teamFor = useMemo(
    () => new Map(field.map((entrant) => [entrant.driverId, entrant.teamId])),
    [field],
  );
  // Both read the year being played rather than a season pinned at import
  // time — the app runs more than one now.
  const seed = useMemo(() => seasonSeed(year), [year]);
  const changes = useMemo(
    () => (lineup === null ? [] : lineupChanges(seed, lineup)),
    [lineup, seed],
  );
  const supplyChanges = useMemo(
    () => (engines === null ? [] : engineChanges(seed, engines)),
    [engines, seed],
  );

  return (
    <>
      {/*
        Above the champions, because a championship won on a grid the reader
        assembled is a different claim from one won on the grid of 1980, and
        finding that out at the foot of the page is finding it out too late.
      */}
      {changes.length === 0 && supplyChanges.length === 0 ? null : (
        <EditedGridBanner changes={changes} engineChanges={supplyChanges} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Champion
          label="Drivers&rsquo; champion"
          name={champion === undefined ? "—" : driverName(champion.driverId)}
          country={
            champion === undefined ? undefined : driverRecords.get(champion.driverId)?.nationality
          }
          detail={
            champion === undefined
              ? "Nobody scored."
              : `${nameOf(champion.teamId)} — ${champion.points} points from ${plural(champion.wins, "win")}.`
          }
        />
        <Champion
          label="Constructors&rsquo; champion"
          name={topTeam === undefined ? "—" : nameOf(topTeam.teamId)}
          country={topTeam === undefined ? undefined : teams.get(topTeam.teamId)?.base}
          detail={
            topTeam === undefined
              ? "Nobody scored."
              : `${topTeam.points} points from ${plural(topTeam.wins, "win")}.`
          }
        />
      </div>
      <SeasonCalendar season={season} calendar={seed.calendar} teamFor={teamFor} />
      <Standings season={season} calendar={seed.calendar} midSeason={false} />
      <SeasonGrid field={field} seasonYear={year} changes={changes} engineChanges={supplyChanges} />
    </>
  );
}

/**
 * A race: the classification, with the championship as it stands beside it.
 *
 * Two columns rather than two full tables stacked underneath. After a single
 * round the full table's wins, podiums, poles and retirement counts are mostly
 * zeroes; what a reader wants is who leads and by how much, which fits in a
 * sidebar and keeps the result itself on screen.
 */
function RaceStage({
  world,
  view,
  race,
}: {
  world: World;
  view: Extract<View, { kind: "race" }>;
  race: RaceResult;
}) {
  const nameOf = useEntryName();
  const soFar = useMemo(() => seasonSoFar(world.season, view.round), [world.season, view.round]);
  const drivers = useMemo(() => championshipStandings(soFar), [soFar]);
  const constructors = useMemo(() => constructorStandings(soFar), [soFar]);

  // The table as it stood a round ago, so each row can show what it gained or
  // lost. Round one has no "before" and gets undefined, so nobody reads as
  // having climbed from nowhere. (An empty previous table would degrade to the
  // same thing — every lookup missing — but saying so outright is clearer than
  // relying on it.)
  const previous = useMemo(() => {
    if (view.round === 0) {
      return { drivers: undefined, constructors: undefined };
    }
    const before = seasonSoFar(world.season, view.round - 1);
    return {
      drivers: positionsOf(championshipStandings(before)),
      constructors: positionsOf(constructorStandings(before)),
    };
  }, [world.season, view.round]);

  const label = roundLabel(seasonSeed(world.year).calendar, view.round);
  const total = world.season.races.length;
  const remaining = total - soFar.races.length;

  // Who, if anyone, can no longer be caught, and whether that became true on
  // this round. The banner is shown only on the round it happens; the standings
  // accent below stays from then on, which is what the two halves are for.
  const titles = useMemo(() => {
    const after = (round: number) => {
      const table = seasonSoFar(world.season, round);
      const left = total - table.races.length;
      return {
        driver: driversTitleClinchedBy(championshipStandings(table), left),
        team: constructorsTitleClinchedBy(constructorStandings(table), left),
      };
    };
    const now = after(view.round);
    const before = view.round === 0 ? { driver: null, team: null } : after(view.round - 1);
    return {
      driver: now.driver,
      driverIsNew: now.driver !== null && before.driver === null,
      team: now.team,
      teamIsNew: now.team !== null && before.team === null,
    };
  }, [world.season, view.round, total]);

  return (
    <div className="flex flex-col gap-4">
      {titles.driver !== null && titles.driverIsNew ? (
        <TitleBanner
          title="Drivers"
          name={driverName(titles.driver.driverId)}
          country={driverRecords.get(titles.driver.driverId)?.nationality}
        />
      ) : null}
      {titles.team !== null && titles.teamIsNew ? (
        <TitleBanner
          title="Constructors"
          name={nameOf(titles.team.teamId)}
          country={teams.get(titles.team.teamId)?.base}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Section title={`${label.name} — Race`} subtitle={label.circuit} country={label.country}>
          <RaceClassification race={race} />
        </Section>

        <aside className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            Championship after {plural(soFar.races.length, "round")}
            {remaining === 0 ? "" : ` (${remaining} remaining)`}
          </p>
          <CompactStandings
            title="Drivers"
            standings={drivers}
            previousPositions={previous.drivers}
            clinchedBy={titles.driver?.driverId}
          />
          <CompactStandings
            title="Constructors"
            standings={constructors}
            previousPositions={previous.constructors}
            clinchedBy={titles.team?.teamId}
          />
        </aside>
      </div>
    </div>
  );
}

interface SeasonViewProps {
  readonly world: World;
  readonly view: View;
  /** Absent in tests, where nothing is clicked. The toggle still renders. */
  readonly onRatingModeChange?: (mode: RatingMode) => void;
  /** The same, for the grid editor: it draws without one, it just cannot apply. */
  readonly onGridChange?: (edit: GridEdit) => void;
  /** Raised while the grid editor is open, so the page can hide the way forward. */
  readonly onGridEditingChange?: (editing: boolean) => void;
}

/**
 * One point in the reveal, drawn.
 *
 * Separate from `SeasonView` only because the entry-name context has to be
 * *above* whatever reads it, and this is what reads it.
 */
function SeasonBody({
  world,
  view,
  onRatingModeChange,
  onGridChange,
  onGridEditingChange,
}: SeasonViewProps) {
  const round =
    view.kind === "qualifying" || view.kind === "race" ? world.season.races[view.round] : undefined;

  if (view.kind === "grid") {
    return (
      <div className="flex flex-col gap-6">
        <RatingModeToggle
          mode={world.ratingMode}
          year={world.year}
          {...(onRatingModeChange === undefined ? {} : { onChange: onRatingModeChange })}
        />
        <GridStage
          field={world.field}
          year={world.year}
          ratingMode={world.ratingMode}
          lineup={world.lineup}
          engines={world.engines}
          {...(onGridChange === undefined ? {} : { onApply: onGridChange })}
          {...(onGridEditingChange === undefined ? {} : { onEditingChange: onGridEditingChange })}
        />
      </div>
    );
  }

  if (view.kind === "qualifying" && round !== undefined) {
    const label = roundLabel(seasonSeed(world.year).calendar, view.round);
    return (
      <Section
        title={`${label.name} — Qualifying`}
        subtitle={label.circuit}
        country={label.country}
      >
        <QualifyingResults race={round} />
      </Section>
    );
  }

  if (view.kind === "race" && round !== undefined) {
    return <RaceStage world={world} view={view} race={round} />;
  }

  return (
    <Summary
      season={world.season}
      field={world.field}
      year={world.year}
      lineup={world.lineup}
      engines={world.engines}
    />
  );
}

/**
 * Everything between the header and the buttons, for one point in the reveal.
 *
 * Takes the world and the cursor as props rather than reading the store, so
 * every stage can be rendered and tested on its own. `App` is the thin shell
 * that connects it.
 *
 * Its one job of its own is to publish **who is running whose engine**, taken
 * off the field as it was raced. Every table below names teams through that
 * context, so "Williams-Ford" is the same name in the standings, the
 * classification, the qualifying sheet and the summary — rather than six
 * components each being handed a map they only pass along.
 */
export function SeasonView(props: SeasonViewProps) {
  return (
    <EntryNames field={props.world.field}>
      <SeasonBody {...props} />
    </EntryNames>
  );
}
