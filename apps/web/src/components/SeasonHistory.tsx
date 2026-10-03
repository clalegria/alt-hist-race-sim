/**
 * What one name did in every year of the era, behind its own name.
 *
 * The champions screen names the same forty people and fifteen teams over and
 * over — once per crowned year on the roll of honour, and again on eight record
 * cards underneath. Every one of those names is a question the screen does not
 * answer: *what did they do the rest of the time?* This is that answer, on the
 * same affordance the grid editor already uses for a driver's ratings — select
 * the name, get a panel — so the two screens teach one gesture rather than two.
 *
 * The walk of the seasons happens **once, above the whole screen**, and rides a
 * context: a panel opened from a card is opened from a tree that already drew
 * forty rows, and tallying seventy-odd worlds per click would be forty tallies
 * of the same results. `lib/history.ts` does the tallying; this file decides
 * what the panel says.
 *
 * The default is **no run in scope**, exactly as `EntryNames` and `Liveries`
 * default to no season: a name with nothing behind it draws as plain text
 * rather than as a control that opens an empty panel. That is what a component
 * rendered on its own gets, which is how most of this app is tested.
 */

import { Link } from "@tanstack/react-router";
import { createContext, useContext, useMemo } from "react";
import { STANDOUT_TEXT } from "../lib/highlight.js";
import {
  count,
  figuresLine,
  isTitle,
  type LineupEntry,
  lineupOf,
  NO_HISTORIES,
  placeLabel,
  type SeasonFigures,
  type SeasonHistories,
  seasonHistories,
} from "../lib/history.js";
import { driverCountry, driverName, teamCountry, teamName } from "../lib/names.js";
import type { TalliedYear } from "../lib/reveal.js";
import type { PageOf, RosterLink } from "../lib/roster-places.js";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

/** The run's careers, and where each one's page is — null outside a router. */
interface HistoryScope {
  readonly histories: SeasonHistories;
  readonly pageOf: PageOf | null;
}

const Histories = createContext<HistoryScope>({ histories: NO_HISTORIES, pageOf: null });

/**
 * Every career of a run, tallied once for every panel on the screen.
 *
 * The run's frame provides it over every year the reader has reached, the
 * cursor's own cut at the cursor, so a panel opened anywhere in the run says
 * the same thing. `pageOf` is how a panel links on to the person's page; a
 * test with no router leaves it out and the panel draws no link.
 */
export function SeasonHistoryProvider({
  seasons,
  pageOf = null,
  children,
}: {
  seasons: readonly TalliedYear[];
  pageOf?: PageOf | null;
  children: React.ReactNode;
}) {
  const histories = useMemo(() => seasonHistories(seasons), [seasons]);
  const scope = useMemo(() => ({ histories, pageOf }), [histories, pageOf]);
  return <Histories.Provider value={scope}>{children}</Histories.Provider>;
}

/**
 * Where a person's page is, inside a run's frame; null outside one, which is
 * every test without a router. The grid's ratings popovers read it too, so a
 * name leads on to its page whichever panel it opened.
 */
export function usePageOf(): PageOf | null {
  return useContext(Histories).pageOf;
}

/**
 * The way from a panel to the page behind it. The panel is the quick look and
 * the page the whole story, so every panel ends on this, at its foot, where a
 * reader who has read it is.
 */
export function FullPageLink({ link }: { link: RosterLink }) {
  return (
    <Link {...link} className="text-primary text-xs font-medium hover:underline">
      Full page →
    </Link>
  );
}

/**
 * How a name with a panel behind it behaves: nothing at rest, a soft fill under
 * the cursor or the keyboard focus, held open while the panel is.
 *
 * `NAME_TARGET` in `SeasonGrid` says the same thing and is deliberately not
 * reused: that one is sized for a grid row and carries the full-width layout
 * that keeps a button flush with its column. These names sit inside table cells
 * that are already padded, and some of them are the second half of a row whose
 * first half is a chevron.
 */
export const HISTORY_TARGET =
  "hover:bg-accent focus-visible:ring-ring data-[state=open]:bg-accent -mx-1 min-w-0 cursor-pointer rounded px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none";

/**
 * One year of a career: the year, what it was spent doing, and where it ended.
 *
 * The championship place is the right-hand column of both panels because it is
 * the column a reader scans — a career is read for its good years, and they are
 * the small numbers. A title takes the accent, which is the one thing on this
 * panel worth a colour.
 */
function HistoryLine({
  middle,
  season,
  lineup,
}: {
  middle: string;
  season: SeasonFigures;
  /** Who drove the cars, on a team's panel. Empty everywhere else. */
  lineup?: readonly LineupEntry[];
}) {
  return (
    <li className="border-border/60 border-t py-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-2">
        <span className="w-9 shrink-0 text-xs font-medium tabular-nums">{season.year}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{middle}</span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            isTitle(season) ? `${STANDOUT_TEXT} font-semibold` : "text-muted-foreground",
          )}
        >
          {placeLabel(season)}
        </span>
      </div>
      {/*
        Indented to start under the middle column rather than under the year, so
        a panel reads as two columns and not as ragged prose.
      */}
      <div className="text-muted-foreground pl-11 text-xs">{figuresLine(season)}</div>
      {lineup === undefined || lineup.length === 0 ? null : (
        <div className="text-muted-foreground pl-11 text-xs">
          {lineup.map((driver, index) => (
            <span key={driver.label}>
              {index === 0 ? null : " · "}
              {/*
                A drivers' champion is marked exactly as the team's own titles
                are in the column above — one accent meaning "won the thing",
                not a second idea for the same fact.
              */}
              <span className={cn(driver.champion && `${STANDOUT_TEXT} font-semibold`)}>
                {driver.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The panel itself: a heading that names whose it is, and the years under it.
 *
 * **The list scrolls; the panel does not grow.** An era can run from 1950 to
 * 2026, and a career forty seasons long would otherwise open a panel taller
 * than the window, with its first year off the top of the screen and no way
 * back to it. The cap is on the list rather than on the panel, so the heading
 * stays put while the years move under it.
 *
 * Nothing in here wears a badge or a flag: this only appears after a click, and
 * an expansion repeating the row the reader just left is noise rather than
 * detail — the same rule the record cards' spell rows follow.
 */
function HistoryPanel({
  name,
  country,
  seasons,
  page,
  children,
}: {
  name: string;
  /** A driver's nationality, a team's base — the flag every table names them with. */
  country: string | undefined;
  seasons: number;
  /** Their page, where the panel leads on to; null where there is none to link. */
  page: RosterLink | null;
  children: React.ReactNode;
}) {
  return (
    <PopoverContent className="w-80 p-0">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {country === undefined ? null : <Flag country={country} title={country} />}
          <span className="min-w-0 truncate font-semibold">{name}</span>
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {count(seasons, "season", "seasons")}
        </span>
      </div>
      <ul className="max-h-80 overflow-y-auto px-4 py-3">{children}</ul>
      {page === null ? null : (
        <div className="border-border border-t px-4 py-2 text-right">
          <FullPageLink link={page} />
        </div>
      )}
    </PopoverContent>
  );
}

/** The name, and the panel behind it — or just the name, outside a run. */
function HistoryName({
  panel,
  className,
  children,
}: {
  panel: React.ReactNode | null;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  if (panel === null) {
    return <>{children}</>;
  }
  return (
    <Popover>
      <PopoverTrigger className={cn(HISTORY_TARGET, className)}>{children}</PopoverTrigger>
      {panel}
    </Popover>
  );
}

/**
 * A driver's name, opening into every season of their career.
 *
 * Each year names the **team they finished it with**, resolved as of that year
 * — the lineage that raced as Toleman in 1984 is Benetton by 1986, and a career
 * spanning both has to say each of them on its own line.
 */
export function DriverHistory({
  driverId,
  className,
  children,
}: {
  driverId: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const { histories, pageOf } = useContext(Histories);
  const seasons = histories.drivers.get(driverId);
  const panel =
    seasons === undefined || seasons.length === 0 ? null : (
      <HistoryPanel
        name={driverName(driverId)}
        country={driverCountry(driverId)}
        seasons={seasons.length}
        page={pageOf?.driver(driverId) ?? null}
      >
        {seasons.map((season) => (
          <HistoryLine
            key={season.year}
            middle={teamName(season.teamId, season.year)}
            season={season}
          />
        ))}
      </HistoryPanel>
    );

  return (
    <HistoryName panel={panel} className={className}>
      {children}
    </HistoryName>
  );
}

/**
 * A team's name, opening into every season of the lineage — its constructors'
 * championship, and who scored it.
 *
 * The heading names the team **as of its last season in the run**, the same
 * rule a record card labels a row by and for the same reason: a lineage
 * spanning 1980 to 1994 has to be called something, and the name the reader has
 * most recently seen it under is the least surprising. The years inside are
 * each named as of themselves, which is where the renames actually show.
 */
export function TeamHistory({
  teamId,
  className,
  children,
}: {
  teamId: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const { histories, pageOf } = useContext(Histories);
  const seasons = histories.teams.get(teamId);
  // The team as of its last season in the run — its name, its flag and, on the
  // rows below, a livery would all be eras; the heading has to pick one year.
  const last = seasons?.at(-1)?.year;
  const panel =
    seasons === undefined || seasons.length === 0 ? null : (
      <HistoryPanel
        name={teamName(teamId, last)}
        country={teamCountry(teamId, last)}
        seasons={seasons.length}
        page={pageOf?.team(teamId) ?? null}
      >
        {seasons.map((season) => (
          <HistoryLine
            key={season.year}
            middle={teamName(teamId, season.year)}
            season={season}
            lineup={lineupOf(season)}
          />
        ))}
      </HistoryPanel>
    );

  return (
    <HistoryName panel={panel} className={className}>
      {children}
    </HistoryName>
  );
}
