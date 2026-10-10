import { Fragment, useMemo, useState } from "react";
import { eraChampions, eraSpan, type SeasonChampions } from "../lib/era.js";
import { STANDOUT_ROW } from "../lib/highlight.js";
import type { RevealedWorld } from "../lib/reveal.js";
import type { RunLink } from "../lib/run-places.js";
import { nextEraYear, seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import type { EraRun } from "../store/season.js";
import { CareerStatistics } from "./CareerStatistics.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { EntryNames } from "./EntryNames.js";
import { Liveries } from "./Liveries.js";
import { PageLink } from "./PageLink.js";
import { DriverHistory, TeamHistory } from "./SeasonHistory.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { TeamName } from "./TeamName.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** Season, then name-points-wins twice over — the width the panel spans. */
const COLUMN_COUNT = 7;

/**
 * One year of the roll of honour: who it crowned, and — opened — how.
 *
 * The **year is the control**, with the same `▶` chevron and `aria-expanded`
 * the championship tables and the calendar use: one action does not deserve a
 * second tab stop, and the year is what a reader following an era is aiming at.
 *
 * Both rows sit inside this season's own `EntryNames`, so the champion named on
 * the row and every team named in the tables under it agree about who was
 * running whose engine that year.
 *
 * **Controlled**, like the grid editor's tables and for the same reason: the
 * open year lives above it, so both states of a row render on their own without
 * a DOM and without a click.
 */
export function ChampionRow({
  season,
  latest,
  open,
  onToggle,
  seasonLink,
}: {
  season: SeasonChampions;
  latest: boolean;
  open: boolean;
  onToggle: () => void;
  /** The season page of a year, beside the year. Absent in a test without a router. */
  seasonLink?: ((year: number) => RunLink) | undefined;
}) {
  return (
    <EntryNames field={season.world.field}>
      {/*
        This year's colours, not the era's: a team's livery is a per-season fact
        and the roll of honour spans many, so each row resolves its own.
      */}
      <Liveries year={season.year}>
        <TableRow className={cn(latest && STANDOUT_ROW, open && !latest && "bg-muted/60")}>
          <TableCell className="font-semibold tabular-nums">
            {/* The year opens the panel; the icon beside it goes to its page. */}
            <span className="flex items-center gap-1">
              <DisclosureButton open={open} onToggle={onToggle}>
                {season.year}
              </DisclosureButton>
              {seasonLink === undefined ? null : (
                <PageLink link={seasonLink(season.year)} label={`${season.year} season page`} />
              )}
            </span>
          </TableCell>
          <TableCell>
            {/*
              The champion's name opens their whole career, not this year — the
              row already *is* this year. The year's chevron beside it opens the
              season; the two controls are next to each other and answer the two
              questions a champion's row raises.
            */}
            {season.driver === null ? (
              <DriverName driverId={null} />
            ) : (
              <DriverHistory driverId={season.driver.driverId}>
                <DriverName
                  driverId={season.driver.driverId}
                  teamId={season.driver.teamId}
                  emphasis
                  badge
                />
              </DriverHistory>
            )}
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            {season.driver?.points ?? "—"}
          </TableCell>
          <TableCell className="text-muted-foreground text-right tabular-nums">
            {season.driver?.wins ?? "—"}
          </TableCell>
          <TableCell>
            {season.team === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <TeamHistory teamId={season.team.teamId}>
                <TeamName teamId={season.team.teamId} emphasis badge />
              </TeamHistory>
            )}
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            {season.team?.points ?? "—"}
          </TableCell>
          <TableCell className="text-muted-foreground text-right tabular-nums">
            {season.team?.wins ?? "—"}
          </TableCell>
        </TableRow>
        {open ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={COLUMN_COUNT} className="p-0">
              {/*
                The same two tables the season summary ends on, drawn by the same
                component — so a year read out of the roll of honour and a year
                just finished say the same thing, down to the columns. Each row of
                them still opens into its own race-by-race, off this year's own
                calendar rather than a season fixed at import time.
              */}
              <div className="bg-muted/40 border-border flex flex-col gap-4 border-y px-3 py-4">
                <SeasonStandings
                  season={season.world.season}
                  calendar={seasonSeed(season.year).calendar}
                  year={season.year}
                  points={season.world.points}
                  description="Final classification."
                />
              </div>
            </TableCell>
          </TableRow>
        ) : null}
      </Liveries>
    </EntryNames>
  );
}

/**
 * The screen between two years of an era: every champion crowned so far.
 *
 * The one thing the basic era mode adds to the season flow, and the reason it
 * is worth building before anything simulates a grid — a season at a time says
 * nothing about an era, and this is where seventy years of ratings either read
 * as history or visibly do not.
 *
 * Chronological, earliest first, because it is a record rather than a
 * leaderboard: a reader following an era wants to run their eye down it in the
 * order they played it. The year just finished is the last row and carries the
 * winner's accent, which is the same accent the summary just gave the same two
 * names — it is the champion of the thing on screen, arriving on a page of
 * champions.
 *
 * Props-driven like every other screen here, so it renders without a DOM and
 * without a store.
 */
/**
 * The record itself: every title of the era, earliest first.
 *
 * Its own component rather than markup inside the screen, because the screen
 * has grown a second half — the career statistics under it — and the two are
 * separate readings of the same seasons. It owns the open year, which is view
 * state and only this table's; `ChampionRow` stays **controlled** so both
 * states of a row render without a DOM and without a click.
 */
export function RollOfHonour({
  seasons,
  inProgress = null,
  accentLatest = true,
  seasonLink,
}: {
  seasons: readonly SeasonChampions[];
  /** The year the cursor is in, drawn last; null on the review. */
  inProgress?: RevealedWorld | null;
  /** Whether the year last crowned carries the accent; not once the era has ended. */
  accentLatest?: boolean;
  /** A year's season page. Absent in a test without a router. */
  seasonLink?: ((year: number) => RunLink) | undefined;
}) {
  // One year at a time, because two full championship tables is already a page.
  const [openYear, setOpenYear] = useState<number | null>(null);
  const last = seasons.at(-1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roll of honour</CardTitle>
        <CardDescription>
          Every title of this era, in the order it was won. Select a year for its full championship
          tables.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Season</TableHead>
            <TableHead>Drivers&rsquo; champion</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">Wins</TableHead>
            <TableHead>Constructors&rsquo; champion</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">Wins</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seasons.map((season) => (
            <Fragment key={season.year}>
              <ChampionRow
                season={season}
                latest={accentLatest && season.year === last?.year}
                open={openYear === season.year}
                onToggle={() => {
                  setOpenYear(openYear === season.year ? null : season.year);
                }}
                seasonLink={seasonLink}
              />
            </Fragment>
          ))}
          {inProgress === null ? null : (
            <InProgressRow world={inProgress} seasonLink={seasonLink} />
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * The year the cursor is in, under the years crowned: who leads each
 * championship as far as the reader has got. Muted and never opened — it is a
 * season still being written, not a row of the record, so it takes no accent.
 */
export function InProgressRow({
  world,
  seasonLink,
}: {
  world: RevealedWorld;
  /** The year's season page, beside the year. Absent in a test without a router. */
  seasonLink?: ((year: number) => RunLink) | undefined;
}) {
  const leaders = useMemo(() => eraChampions([world])[0], [world]);
  const raced = world.season.races.length;
  return (
    <EntryNames field={world.field}>
      <Liveries year={world.year}>
        <TableRow className="hover:bg-transparent">
          <TableCell>
            <span className="flex flex-col leading-tight">
              <span className="flex items-center gap-1">
                <span className="font-semibold tabular-nums">{world.year}</span>
                {seasonLink === undefined ? null : (
                  <PageLink link={seasonLink(world.year)} label={`${world.year} season page`} />
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                {raced === 0 ? "on the grid" : `in progress, leaders after round ${raced}`}
              </span>
            </span>
          </TableCell>
          {raced === 0 || leaders === undefined ? (
            <TableCell colSpan={COLUMN_COUNT - 1} className="text-muted-foreground">
              Not raced yet.
            </TableCell>
          ) : (
            <>
              {/* The row never opens; the leaders' names open their careers. */}
              <TableCell>
                {leaders.driver === null ? (
                  <DriverName driverId={null} />
                ) : (
                  <DriverHistory driverId={leaders.driver.driverId}>
                    <DriverName
                      driverId={leaders.driver.driverId}
                      teamId={leaders.driver.teamId}
                      badge
                    />
                  </DriverHistory>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {leaders.driver?.points ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {leaders.driver?.wins ?? "—"}
              </TableCell>
              <TableCell>
                {leaders.team === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <TeamHistory teamId={leaders.team.teamId}>
                    <TeamName teamId={leaders.team.teamId} badge />
                  </TeamHistory>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {leaders.team?.points ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {leaders.team?.wins ?? "—"}
              </TableCell>
            </>
          )}
        </TableRow>
      </Liveries>
    </EntryNames>
  );
}

/** The year after the last one crowned, or null where the era has nowhere further to go. */
function yearAfter(seasons: readonly SeasonChampions[]): number | null {
  const last = seasons.at(-1);
  return last === undefined ? null : nextEraYear(last.year);
}

/**
 * Whether the era is over: on the review of the last year there is data for,
 * with no year in progress and none to come.
 */
function eraEnded(seasons: readonly SeasonChampions[], inProgress: RevealedWorld | null): boolean {
  return inProgress === null && yearAfter(seasons) === null;
}

/** The line under the overview's heading: what has been run, and what comes next. */
function eraLead(seasons: readonly SeasonChampions[], inProgress: RevealedWorld | null): string {
  const span = eraSpan(seasons);
  const run =
    seasons.length === 0
      ? "No season finished yet."
      : seasons.length === 1
        ? `One season run, ${span}.`
        : `${seasons.length} seasons run, ${span}.`;
  if (inProgress !== null) {
    return `${run} ${inProgress.year} is under way.`;
  }
  return eraEnded(seasons, inProgress)
    ? `${run} There is no season after this one to run — the era ends here.`
    : `${run} Next comes ${yearAfter(seasons)}.`;
}

/**
 * An era's overview (`/run`): every champion crowned so far, the year in
 * progress under them, and what the era adds up to underneath. Between two
 * years it is the page Continue lands on; from the era's first grid on it is
 * a page the reader can go back to.
 *
 * The one thing the basic era mode adds to the season flow, and the reason it
 * is worth building before anything simulates a grid — a season at a time says
 * nothing about an era, and this is where seventy years of ratings either read
 * as history or visibly do not.
 *
 * Two readings of the same seasons, in that order. The **roll of honour** is
 * chronological, earliest first, because it is a record rather than a
 * leaderboard: a reader following an era wants to run their eye down it in the
 * order they played it. The year last crowned is its last row and carries the
 * winner's accent, which is the same accent the summary gave the same two
 * names — until the era has ended, when it is one year of the record like the
 * rest, and the page is headed as the whole record rather than a tally so far.
 * The **career statistics** below are the other axis: who won the era rather
 * than who won each year — crowned years only, so they are left out until
 * there is one.
 *
 * `inProgress` is the cursor's year as far as it has got, null while the
 * cursor is on the review. Props-driven like every other screen here, so it
 * renders without a DOM and without a store.
 */
export function EraChampions({
  run,
  inProgress = null,
  seasonLink,
}: {
  run: EraRun;
  inProgress?: RevealedWorld | null;
  /** A year's season page, for the roll of honour's panels. Absent in a test without a router. */
  seasonLink?: ((year: number) => RunLink) | undefined;
}) {
  const seasons = useMemo(() => eraChampions(run.seasons), [run.seasons]);
  // The settings the run was started on, which every year of it shares — they
  // are baked in when an era begins. Read off the first season crowned rather
  // than the last, because that is the one that fixed them.
  const first = seasons[0]?.world ?? inProgress;
  const ended = eraEnded(seasons, inProgress);

  return (
    // No padding of its own: the run's frame spaces every page under the bar.
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ended ? "All champions" : "Champions so far"}
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">{eraLead(seasons, inProgress)}</p>
        {first === null ? null : (
          <SimulationSettings
            settings={settingsOf(first)}
            className="text-muted-foreground text-xs"
          />
        )}
      </header>

      {/*
        The panels behind the names come from the run's frame, which walks the
        run once for every page (`SeasonHistoryProvider` in `RunFrame`).
      */}
      <RollOfHonour
        seasons={seasons}
        inProgress={inProgress}
        accentLatest={!ended}
        seasonLink={seasonLink}
      />

      {seasons.length === 0 ? null : <CareerStatistics seasons={run.seasons} />}
    </div>
  );
}
