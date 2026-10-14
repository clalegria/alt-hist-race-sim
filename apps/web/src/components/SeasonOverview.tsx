import {
  authoredChassis,
  chassisChanges,
  engineChanges,
  engineRatingChanges,
  lineupChanges,
  trendChanges,
} from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { useMemo } from "react";
import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { keptNotes } from "../lib/kept.js";
import { driverCountry, driverName } from "../lib/names.js";
import type { RevealedWorld } from "../lib/reveal.js";
import { seatingArrangement } from "../lib/run-settings.js";
import type { SeasonTab, SeasonTabLink } from "../lib/season-tabs.js";
import { enteredSeason, historicalEngineRatings, seasonSeed } from "../lib/seasons.js";
import type { RoundPages } from "../lib/session-nav.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { cn, MONO_LABEL } from "../lib/utils.js";
import { useEntryName, useTeamCountry } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { EditedGridBanner } from "./LineupChanges.js";
import { PageHeading } from "./PageHeading.js";
import { SeasonCalendar } from "./SeasonCalendar.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { DriverHistory, TeamHistory } from "./SeasonHistory.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { TabLinks } from "./TabLinks.js";
import { TeamBadge } from "./TeamBadge.js";
import { TeamCar } from "./TeamCar.js";
import { Card, CardHeader, CardTitle } from "./ui/card.js";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** How far the season has got, in words, for a season not finished. */
export function seasonProgress(raced: number, rounds: number): string {
  return raced === 0 ? "No round raced yet" : `After round ${raced} of ${rounds}`;
}

function Champion({
  label,
  name,
  detail,
  country,
  teamId,
}: {
  label: string;
  /** The name, opening its career as every name in a run does. */
  name: React.ReactNode;
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
    // words, so the body fills its card: the car then parks in the same
    // bottom-right corner of both.
    <Card className={cn("flex flex-1 flex-col", STANDOUT_SURFACE)}>
      <CardHeader className="px-3 py-2.5">
        <p className={MONO_LABEL}>{label}</p>
      </CardHeader>
      <div className="flex flex-1 flex-col gap-3 p-4 lg:flex-row lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/*
            The name wraps within itself, beside the badge and flag: wrapping
            the row instead sent a long team name to a line of its own, and the
            two cards' names to different heights. The marks sit in a box one
            line tall, so they centre on the first line and every name starts
            at the same height.
          */}
          <CardTitle
            className={cn("flex items-start gap-2.5 text-3xl leading-none", STANDOUT_TEXT)}
          >
            <span className="flex h-[1em] shrink-0 items-center gap-2.5">
              {teamId === undefined ? null : <TeamBadge teamId={teamId} />}
              {country === undefined || country === "" ? null : (
                <Flag country={country} title={country} className="h-5 w-7.5" />
              )}
            </span>
            <span className="min-w-0">{name}</span>
          </CardTitle>
          <p className="text-muted-foreground text-sm">{detail}</p>
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
      </div>
    </Card>
  );
}

/** The season's two champions, side by side. */
function Champions({ world }: { world: RevealedWorld }) {
  const nameOf = useEntryName();
  const countryOf = useTeamCountry();
  const { season, points } = world;
  const champion = useMemo(() => championshipStandings(season, points)[0], [season, points]);
  const topTeam = useMemo(() => constructorStandings(season, points)[0], [season, points]);
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Champion
        label="Drivers&rsquo; champion"
        name={
          champion === undefined ? (
            "—"
          ) : (
            <DriverHistory driverId={champion.driverId}>
              {driverName(champion.driverId)}
            </DriverHistory>
          )
        }
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
        name={
          topTeam === undefined ? (
            "—"
          ) : (
            <TeamHistory teamId={topTeam.teamId}>{nameOf(topTeam.teamId)}</TeamHistory>
          )
        }
        country={topTeam === undefined ? undefined : countryOf(topTeam.teamId)}
        {...(topTeam === undefined ? {} : { teamId: topTeam.teamId })}
        detail={
          topTeam === undefined
            ? "Nobody scored."
            : `${topTeam.points} points from ${plural(topTeam.wins, "win")}.`
        }
      />
    </div>
  );
}

/**
 * The tabs, as links: a tab is a place in the address bar (`?tab=`), so Back
 * moves between them and one can be opened in a new tab.
 */
function SeasonTabs({ tabs }: { tabs: readonly SeasonTabLink[] }) {
  return (
    <TabLinks
      label="Season"
      className="self-start"
      tabs={tabs.map((tab) => ({
        key: tab.tab,
        label: tab.label,
        current: tab.current,
        link: tab.link,
      }))}
    />
  );
}

/**
 * A season's own page (`/run/1984`): the year as far as the reader has got,
 * one tab at a time — the standings, the calendar, the grid.
 *
 * `world` is cut at the cursor like every page's, so mid-season the
 * standings are as of the last race revealed and the calendar greys the
 * rounds still ahead. `finished` is the summary reached: the champions go on
 * top, above the same tabs.
 *
 * `tabs` is the links; absent in a test without a router, where the tab named
 * by `tab` still draws.
 */
export function SeasonOverview({
  world,
  finished,
  tab,
  tabs,
  pagesOf,
}: {
  world: RevealedWorld;
  finished: boolean;
  tab: SeasonTab;
  tabs?: readonly SeasonTabLink[] | undefined;
  /** A round's pages, for the calendar's expansions. Absent in a test without a router. */
  pagesOf?: ((round: number) => RoundPages) | undefined;
}) {
  const { season, year, points } = world;
  // Both read the year being played rather than a season pinned at import
  // time — the app runs more than one now.
  const seed = useMemo(() => seasonSeed(year), [year]);
  const teamFor = useMemo(
    () => new Map(world.field.map((entrant) => [entrant.driverId, entrant.teamId])),
    [world.field],
  );
  // Every change is against the season as the run entered it, which under Car
  // performance or the first season's teams is not the seed file's: a rolled car
  // or a kept seat is the year's starting point, not an edit.
  const entered = enteredSeason(world);
  const changes = useMemo(
    () => (world.lineup === null ? [] : lineupChanges(entered, world.lineup)),
    [world.lineup, entered],
  );
  const supplyChanges = useMemo(
    () => (world.engines === null ? [] : engineChanges(entered, world.engines)),
    [world.engines, entered],
  );
  const rerated = useMemo(
    () => (world.chassis === null ? [] : chassisChanges(entered, world.chassis)),
    [world.chassis, entered],
  );
  const reratedEngines = useMemo(
    () => (world.engineRatings === null ? [] : engineRatingChanges(entered, world.engineRatings)),
    [world.engineRatings, entered],
  );
  const retrended = useMemo(
    () => (world.trends === null ? [] : trendChanges(entered, world.trends)),
    [world.trends, entered],
  );
  const historicalChassis = useMemo(
    () => (world.baselineChassis === null ? null : authoredChassis(seed)),
    [world.baselineChassis, seed],
  );
  const historicalEngines = historicalEngineRatings(world);
  // The grid tab gets the same switch the opening grid has: by now the
  // pecking order is the point rather than a spoiler. Same switch and the same
  // choice — it is shared with every other list on the app.
  const [teamSort, setTeamSort] = useSortOrder();
  const progress = seasonProgress(season.races.length, season.rounds);

  return (
    <>
      <header>
        <PageHeading
          title={`${year} season`}
          sub={finished ? `Final classification · ${plural(season.rounds, "round")}` : progress}
        />
      </header>
      {/*
        Above the result, because a championship won on a grid the reader
        assembled is a different claim from one won on the grid of 1980, and
        finding that out at the foot of the page is finding it out too late.
      */}
      {changes.length === 0 &&
      supplyChanges.length === 0 &&
      rerated.length === 0 &&
      reratedEngines.length === 0 &&
      retrended.length === 0 ? null : (
        <EditedGridBanner
          changes={changes}
          engineChanges={supplyChanges}
          chassisChanges={rerated}
          engineRatingChanges={reratedEngines}
          trendChanges={retrended}
        />
      )}
      {finished ? <Champions world={world} /> : null}
      {/* The terms the season is being settled under, between the result and the tables. */}
      <SimulationSettings
        settings={settingsOf(world)}
        className="text-muted-foreground py-5 text-xs"
      />
      <div className="flex flex-col gap-4">
        {tabs === undefined ? null : <SeasonTabs tabs={tabs} />}
        {tab === "calendar" ? (
          <SeasonCalendar
            season={season}
            calendar={seed.calendar}
            points={points}
            teamFor={teamFor}
            rounds={season.rounds}
            pagesOf={pagesOf}
            pending={
              season.qualifying === null
                ? null
                : {
                    round: season.qualifying.round,
                    poleDriverId: season.qualifying.sheet.poleDriverId,
                  }
            }
          />
        ) : tab === "grid" ? (
          <SeasonGrid
            field={world.field}
            seasonYear={year}
            ratingMode={world.ratingMode}
            changes={changes}
            engineChanges={supplyChanges}
            chassisChanges={rerated}
            engineRatingChanges={reratedEngines}
            trendChanges={retrended}
            historicalChassis={historicalChassis}
            historicalEngines={historicalEngines}
            arrangement={seatingArrangement(world.settings)}
            kept={keptNotes(world)}
            sort={teamSort}
            onSortChange={setTeamSort}
          />
        ) : season.races.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            The championships start with the first race.
          </p>
        ) : (
          <SeasonStandings
            season={season}
            calendar={seed.calendar}
            year={year}
            points={points}
            label={finished ? "Final" : progress}
            badge
            car
            charts
          />
        )}
      </div>
    </>
  );
}
