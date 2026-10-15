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
import { PageHeading } from "./PageHeading.js";
import { PageLink } from "./PageLink.js";
import { DriverHistory, TeamHistory } from "./SeasonHistory.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SimulationSettings, settingsOf } from "./SimulationSettings.js";
import { TeamName } from "./TeamName.js";
import { Card, CardBand } from "./ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableExpansion,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table.js";

/** Season, then name-points-wins twice over — the width the panel spans. */
const COLUMN_COUNT = 7;

/**
 * Below `sm` the roll of honour restacks rather than scrolls: the table and its
 * sections become blocks and each row a grid, the year down the left, the
 * drivers' champion and points over the constructors' champion and points,
 * the wins left to wider screens. One set of cells at every width, so each name
 * stays one control. The grid's columns are fixed, since each row is a grid of
 * its own and must line up with the next. Child combinators only: an opened
 * year holds tables of its own.
 */
export const RESTACK = {
  table:
    "max-sm:block max-sm:[&>thead]:block max-sm:[&>tbody]:block max-sm:[&>tbody>tr[data-expansion]]:block max-sm:[&>tbody>tr[data-expansion]>td]:block",
  row: "max-sm:grid max-sm:grid-cols-[6rem_minmax(0,1fr)_4.5rem] max-sm:items-center",
  year: "max-sm:col-start-1 max-sm:row-span-2 max-sm:row-start-1 max-sm:whitespace-normal",
  driver: "max-sm:col-start-2 max-sm:row-start-1 max-sm:whitespace-normal",
  driverPoints: "max-sm:col-start-3 max-sm:row-start-1",
  team: "max-sm:col-start-2 max-sm:row-start-2 max-sm:whitespace-normal",
  teamPoints: "max-sm:col-start-3 max-sm:row-start-2",
  wins: "max-sm:hidden",
  /** The year in progress before its first race: one cell across both names. */
  unraced: "max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-1",
} as const;

/** A header cell on a phone, where the restack sets the heads two lines deep. */
const RESTACK_HEAD = "max-sm:h-7";

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
        <TableRow
          className={cn(RESTACK.row, latest && STANDOUT_ROW, open && !latest && "bg-muted/60")}
        >
          <TableCell className={cn(RESTACK.year, "font-semibold tabular-nums")}>
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
          <TableCell className={RESTACK.driver}>
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
          <TableCell className={cn(RESTACK.driverPoints, "text-right font-semibold tabular-nums")}>
            {season.driver?.points ?? "—"}
          </TableCell>
          <TableCell className={cn(RESTACK.wins, "text-muted-foreground text-right tabular-nums")}>
            {season.driver?.wins ?? "—"}
          </TableCell>
          <TableCell className={RESTACK.team}>
            {season.team === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <TeamHistory teamId={season.team.teamId}>
                <TeamName teamId={season.team.teamId} emphasis badge />
              </TeamHistory>
            )}
          </TableCell>
          <TableCell className={cn(RESTACK.teamPoints, "text-right font-semibold tabular-nums")}>
            {season.team?.points ?? "—"}
          </TableCell>
          <TableCell className={cn(RESTACK.wins, "text-muted-foreground text-right tabular-nums")}>
            {season.team?.wins ?? "—"}
          </TableCell>
        </TableRow>
        {open ? (
          /*
            The same two tables the season summary ends on, drawn by the same
            component — so a year read out of the roll of honour and a year
            just finished say the same thing, down to the columns. Each row of
            them still opens into its own race-by-race, off this year's own
            calendar rather than a season fixed at import time.
          */
          <TableExpansion colSpan={COLUMN_COUNT} className="flex flex-col gap-4 py-4">
            <SeasonStandings
              season={season.world.season}
              calendar={seasonSeed(season.year).calendar}
              year={season.year}
              points={season.world.points}
              label="Final"
            />
          </TableExpansion>
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
  /** The year the cursor is in, drawn last; null once it is decided. */
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
      <CardBand
        title="Roll of honour"
        label={seasons.length === 0 ? undefined : eraSpan(seasons)}
      />
      <Table className={RESTACK.table}>
        <TableHeader>
          <TableRow className={RESTACK.row}>
            <TableHead className={cn(RESTACK_HEAD, RESTACK.year)}>Season</TableHead>
            <TableHead className={cn(RESTACK_HEAD, RESTACK.driver)}>
              Drivers<span className="max-sm:hidden">&rsquo; champion</span>
            </TableHead>
            <TableHead className={cn(RESTACK_HEAD, RESTACK.driverPoints, "text-right")}>
              Pts
            </TableHead>
            <TableHead className={cn(RESTACK.wins, "text-right")}>Wins</TableHead>
            <TableHead className={cn(RESTACK_HEAD, RESTACK.team)}>
              Constructors<span className="max-sm:hidden">&rsquo; champion</span>
            </TableHead>
            <TableHead className={cn(RESTACK_HEAD, RESTACK.teamPoints, "text-right")}>
              Pts
            </TableHead>
            <TableHead className={cn(RESTACK.wins, "text-right")}>Wins</TableHead>
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
        <TableRow className={cn(RESTACK.row, "hover:bg-transparent")}>
          <TableCell className={RESTACK.year}>
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
            <TableCell
              colSpan={COLUMN_COUNT - 1}
              className={cn(RESTACK.unraced, "text-muted-foreground")}
            >
              Not raced yet.
            </TableCell>
          ) : (
            <>
              {/* The row never opens; the leaders' names open their careers. */}
              <TableCell className={RESTACK.driver}>
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
              <TableCell className={cn(RESTACK.driverPoints, "text-right tabular-nums")}>
                {leaders.driver?.points ?? "—"}
              </TableCell>
              <TableCell
                className={cn(RESTACK.wins, "text-muted-foreground text-right tabular-nums")}
              >
                {leaders.driver?.wins ?? "—"}
              </TableCell>
              <TableCell className={RESTACK.team}>
                {leaders.team === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <TeamHistory teamId={leaders.team.teamId}>
                    <TeamName teamId={leaders.team.teamId} badge />
                  </TeamHistory>
                )}
              </TableCell>
              <TableCell className={cn(RESTACK.teamPoints, "text-right tabular-nums")}>
                {leaders.team?.points ?? "—"}
              </TableCell>
              <TableCell
                className={cn(RESTACK.wins, "text-muted-foreground text-right tabular-nums")}
              >
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

/** The overview's sub-line: what has been run, and what comes next. */
function eraLead(seasons: readonly SeasonChampions[], inProgress: RevealedWorld | null): string {
  const span = eraSpan(seasons);
  const run =
    seasons.length === 0
      ? "No season finished yet"
      : seasons.length === 1
        ? `One season run, ${span}`
        : `${seasons.length} seasons run, ${span}`;
  if (inProgress !== null) {
    return `${run} · ${inProgress.year} is under way`;
  }
  return eraEnded(seasons, inProgress)
    ? `${run} · That's the last season there is, so the era ends here`
    : `${run} · Next comes ${yearAfter(seasons)}`;
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
 * `inProgress` is the cursor's year as far as it has got, null from its
 * summary on, where it joins the record. Props-driven like every other screen here, so it
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
      <header className="flex flex-col gap-3">
        <PageHeading
          title={ended ? "All champions" : "Champions so far"}
          sub={eraLead(seasons, inProgress)}
        />
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
