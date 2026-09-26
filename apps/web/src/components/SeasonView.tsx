import {
  type CalendarRace,
  engineChanges,
  type GridArrangement,
  lineupChanges,
  type RatingMode,
  type SeasonEngines,
  type SeasonLineup,
} from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  type PointsScale,
  type RaceEntrant,
  type RaceResult,
  type RaceWeather,
  type SeasonResult,
} from "@alt-hist/engine";
import { useMemo, useState } from "react";
import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { driverCountry, driverName, teamCountry } from "../lib/names.js";
import { seasonSeed } from "../lib/seasons.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { positionsOf } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import type { View, World } from "../store/season.js";
import { CompactStandings } from "./CompactStandings.js";
import { EntryNames, useEntryName } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { type GridEdit, GridStage } from "./GridStage.js";
import { HomeAdvantage } from "./HomeAdvantage.js";
import { EditedGridBanner } from "./LineupChanges.js";
import { Liveries } from "./Liveries.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { RandomnessNote } from "./RandomnessNote.js";
import { RatingModeToggle } from "./RatingModeToggle.js";
import { SeasonCalendar } from "./SeasonCalendar.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonSwitcher } from "./SeasonSwitcher.js";
import { type Setting, SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { TeamBadge } from "./TeamBadge.js";
import { TeamCar } from "./TeamCar.js";
import { TitleBanner } from "./TitleBanner.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { WeatherBadge } from "./WeatherBadge.js";

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
  weather,
  children,
}: {
  title: string;
  subtitle: string;
  country?: string;
  /**
   * What the sky did. Drawn beside the round's name, and only when it rained —
   * `WeatherBadge` renders nothing for a dry afternoon, which is most of them.
   */
  weather?: RaceWeather;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {country === undefined || country === "" ? null : (
            <Flag country={country} title={country} className="h-4 w-6" />
          )}
          {title}
          {weather === undefined ? null : <WeatherBadge weather={weather} />}
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
  teamId,
}: {
  label: string;
  name: string;
  detail: string;
  country?: string | undefined;
  /**
   * Whose colours the box wears — the champion's team, or the champion itself
   * on the constructors' side. Undefined before anyone has scored.
   */
  teamId?: string | undefined;
}) {
  return (
    // The same accent pole and the race winner carry: whoever won the thing on
    // screen looks the same wherever you meet them.
    //
    // The two cards stand side by side at the same height, whatever their
    // words, so the header fills its card: the car then parks in the same
    // bottom-right corner of both, and the header's bottom rule — drawn to
    // separate a header from a body this card does not have — is dropped
    // rather than left floating wherever the shorter card's words end.
    <Card className={cn("flex flex-1 flex-col", STANDOUT_SURFACE)}>
      <CardHeader className="flex-1 gap-3 border-b-0 lg:flex-row lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className={cn("flex items-center gap-2 text-xl", STANDOUT_TEXT)}>
            {teamId === undefined ? null : <TeamBadge teamId={teamId} />}
            {country === undefined || country === "" ? null : (
              <Flag country={country} title={country} className="h-4 w-6" />
            )}
            {name}
          </CardTitle>
          <CardDescription>{detail}</CardDescription>
        </div>
        {/*
          After the words, so the card still reads label, name, detail, and in
          the bottom-right corner. Beside them only once the card is wide
          enough: narrower, it would squeeze a team's name onto three lines, so
          it drops beneath instead. The one car on the app drawn large, and
          the one whose wheels turn.
        */}
        {teamId === undefined ? null : (
          <TeamCar teamId={teamId} size="large" animated className="mt-auto self-end" />
        )}
      </CardHeader>
    </Card>
  );
}

function Summary({
  season,
  field,
  year,
  ratingMode,
  points,
  lineup,
  engines,
  arrangement,
  settings,
}: {
  season: SeasonResult;
  field: readonly RaceEntrant[];
  year: number;
  /** The mode the season was *raced* on, so the grid's ages match its ratings. */
  ratingMode: RatingMode;
  points: PointsScale;
  lineup: SeasonLineup | null;
  engines: SeasonEngines | null;
  /** The bulk rule the grid was arranged by, said on the banner and the grid. */
  arrangement: GridArrangement | null;
  /** What the year was run under, from `settingsOf`. */
  settings: readonly Setting[];
}) {
  const nameOf = useEntryName();
  const champion = useMemo(() => championshipStandings(season, points)[0], [season, points]);
  const topTeam = useMemo(() => constructorStandings(season, points)[0], [season, points]);
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
  // The grid at the foot of the season gets the same switch the opening one
  // has: by then the pecking order is the point rather than a spoiler. Same
  // switch and the same choice — it is shared with every other list on the app.
  const [teamSort, setTeamSort] = useSortOrder();

  return (
    <>
      {/*
        Above the champions, because a championship won on a grid the reader
        assembled is a different claim from one won on the grid of 1980, and
        finding that out at the foot of the page is finding it out too late.
      */}
      {changes.length === 0 && supplyChanges.length === 0 && arrangement === null ? null : (
        <EditedGridBanner
          changes={changes}
          engineChanges={supplyChanges}
          arrangement={arrangement}
          ratingMode={ratingMode}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Champion
          label="Drivers&rsquo; champion"
          name={champion === undefined ? "—" : driverName(champion.driverId)}
          country={champion === undefined ? undefined : driverCountry(champion.driverId)}
          {...(champion === undefined ? {} : { teamId: champion.teamId })}
          detail={
            champion === undefined
              ? "Nobody scored."
              : `${nameOf(champion.teamId)} — ${champion.points} points from ${plural(champion.wins, "win")}.`
          }
        />
        <Champion
          label="Constructors&rsquo; champion"
          name={topTeam === undefined ? "—" : nameOf(topTeam.teamId)}
          country={topTeam === undefined ? undefined : teamCountry(topTeam.teamId)}
          {...(topTeam === undefined ? {} : { teamId: topTeam.teamId })}
          detail={
            topTeam === undefined
              ? "Nobody scored."
              : `${topTeam.points} points from ${plural(topTeam.wins, "win")}.`
          }
        />
      </div>
      {/*
        Between the champions and the season they came out of, which is the
        break in the page anyway: the result above it, how it was arrived at
        below, and the terms both were settled under in the gap. The padding is
        the gap — these sections are stacked without one.
      */}
      <SimulationSettings settings={settings} className="text-muted-foreground py-5 text-xs" />
      {/*
        The three tables the season is reported in, set apart from each other.
        `SeasonStandings` returns its two tables in a fragment, so they become
        items of this column alongside the calendar and take the same gap — one
        rule for all three rather than margins hung on each. Narrower than the
        gap under it: these belong together, the grid below them is a different
        subject.
      */}
      <div className="flex flex-col gap-4">
        <SeasonCalendar
          season={season}
          calendar={seed.calendar}
          points={points}
          teamFor={teamFor}
        />
        <SeasonStandings
          season={season}
          calendar={seed.calendar}
          points={points}
          description="Final classification."
          badge
          car
          charts
        />
      </div>
      {/*
        A gap wider than the page's own, because this is where the season stops
        being reported and starts being described. The grid draws its own panel
        now, so this no longer has to do the whole job of separating it — a bare
        heading one ordinary gap under the last constructor row used to read as
        another row of that table, and a border settles that on its own. The
        wider gap stays for the subject change, not for the ambiguity.
      */}
      <div className="pt-6">
        <SeasonGrid
          field={field}
          seasonYear={year}
          ratingMode={ratingMode}
          changes={changes}
          engineChanges={supplyChanges}
          arrangement={arrangement}
          sort={teamSort}
          onSortChange={setTeamSort}
        />
      </div>
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
  const points = world.points;
  const drivers = useMemo(() => championshipStandings(soFar, points), [soFar, points]);
  const constructors = useMemo(() => constructorStandings(soFar, points), [soFar, points]);

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
      drivers: positionsOf(championshipStandings(before, points)),
      constructors: positionsOf(constructorStandings(before, points)),
    };
  }, [world.season, view.round, points]);

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
        driver: driversTitleClinchedBy(championshipStandings(table, points), left, points),
        team: constructorsTitleClinchedBy(constructorStandings(table, points), left, points),
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
  }, [world.season, view.round, total, points]);

  return (
    <div className="flex flex-col gap-4">
      {titles.driver !== null && titles.driverIsNew ? (
        <TitleBanner
          title="Drivers"
          name={driverName(titles.driver.driverId)}
          country={driverCountry(titles.driver.driverId)}
        />
      ) : null}
      {titles.team !== null && titles.teamIsNew ? (
        <TitleBanner
          title="Constructors"
          name={nameOf(titles.team.teamId)}
          country={teamCountry(titles.team.teamId)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Section
          title={`${label.name} — Race`}
          subtitle={label.circuit}
          country={label.country}
          weather={race.weather}
        >
          <RaceClassification race={race} points={points} country={label.country} badge car />
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
  /**
   * Whether the reader gets to choose the ability model at all.
   *
   * True for a standalone season, false for a year inside an era, which is fixed
   * at `ERA_RATING_MODE` — see the note on that constant. Not derivable from the
   * world: an era year and a standalone season played "at their age" are the
   * same world, and only one of them offers the switch. Defaults to offering it,
   * so a bare render is the standalone case.
   */
  readonly canChooseAbility?: boolean;
  /**
   * Whether this season is one year of an era.
   *
   * Only the grid editor's bulk rules read it, and only to offer keeping a rule
   * for the years that follow — a standalone season has none. Deliberately not
   * folded into `canChooseAbility`: that one is about a control an era takes
   * *away*, and this is about one it adds, so a single flag would be two
   * opposite claims sharing a name.
   */
  readonly inEra?: boolean;
  /** Absent in tests, where nothing is clicked. The toggle still renders. */
  readonly onRatingModeChange?: (mode: RatingMode) => void;
  /**
   * Jump to the season either side of this one, from the grid.
   *
   * Absent inside an era, where the year belongs to the run rather than to the
   * reader — the switcher is not drawn at all then, the same way the ability
   * toggle is not. Absent in tests too, where nothing is clicked.
   */
  readonly onYearChange?: (year: number) => void;
  /** The same, for the grid editor: it draws without one, it just cannot apply. */
  readonly onGridChange?: (edit: GridEdit) => void;
  /**
   * The previous season's grid as this run actually raced it, for the grid
   * editor's carry-over button.
   *
   * Absent on a standalone season, which has no year behind it, and on the
   * first year of an era: the button then copies the previous season as it was
   * entered, which is the only version of it there is.
   */
  readonly previousLineup?: SeasonLineup | null;
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
  canChooseAbility = true,
  inEra = false,
  onRatingModeChange,
  onYearChange,
  onGridChange,
  onGridEditingChange,
  previousLineup = null,
}: SeasonViewProps) {
  // Whether the grid editor is open. The page is told too — it puts the way
  // forward away — but the year switcher below is drawn from this copy, so the
  // state has to be readable here rather than only raised.
  const [editingGrid, setEditingGrid] = useState(false);
  const round =
    view.kind === "qualifying" || view.kind === "race" ? world.season.races[view.round] : undefined;

  if (view.kind === "grid") {
    return (
      <div className="flex flex-col gap-6">
        {canChooseAbility ? (
          <RatingModeToggle
            mode={world.ratingMode}
            year={world.year}
            {...(onRatingModeChange === undefined ? {} : { onChange: onRatingModeChange })}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RandomnessNote level={world.randomness} />
          {/*
            Beside the randomness note rather than under the buttons: both are
            facts about *which season this is*, and the row reads as one line —
            what is being raced, and the years next to it.

            Gone entirely while the grid editor is open, rather than disabled: a
            draft is a set of seats in *this* year's entry list, and switching
            year rebuilds the world underneath a half-finished one — which the
            editor's own preview then throws on. The way forward off this stage
            is put away while editing for the same reason.
          */}
          {canChooseAbility && !editingGrid ? (
            <SeasonSwitcher
              year={world.year}
              {...(onYearChange === undefined ? {} : { onSwitch: onYearChange })}
            />
          ) : null}
        </div>
        <GridStage
          field={world.field}
          year={world.year}
          ratingMode={world.ratingMode}
          lineup={world.lineup}
          engines={world.engines}
          arrangement={world.arrangement}
          inEra={inEra}
          previousLineup={previousLineup}
          {...(onGridChange === undefined ? {} : { onApply: onGridChange })}
          onEditingChange={(editing) => {
            setEditingGrid(editing);
            onGridEditingChange?.(editing);
          }}
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
        // The weather belongs to the whole weekend, not to Sunday: it widens
        // qualifying's noise and shifts its weights exactly as it does the
        // race's, so a wet round has to say so here too.
        weather={round.weather}
      >
        <QualifyingResults race={round} country={label.country} />
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
      ratingMode={world.ratingMode}
      points={world.points}
      lineup={world.lineup}
      engines={world.engines}
      arrangement={world.arrangement}
      settings={settingsOf(world)}
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
 * Its own jobs are to publish **who is running whose engine**, **where everyone
 * on the grid is from** — both taken off the field as it was raced — and
 * **which season's colours apply**, so a livery overridden for this year is the
 * one drawn everywhere below.
 *
 * Every table names teams through the first, so "Williams-Ford" is the same
 * name in the standings, the classification, the qualifying sheet and the
 * summary — rather than six components each being handed a map they only pass
 * along.
 */
export function SeasonView(props: SeasonViewProps) {
  return (
    <EntryNames field={props.world.field}>
      <HomeAdvantage field={props.world.field}>
        <Liveries year={props.world.year}>
          <SeasonBody {...props} />
        </Liveries>
      </HomeAdvantage>
    </EntryNames>
  );
}
