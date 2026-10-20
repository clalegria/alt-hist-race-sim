/**
 * A driver's page and a team's page: one name, across the run so far.
 *
 * The career panel is the quick look (`SeasonHistory.tsx`); this is the whole
 * story — every year on the grid, each opening into its races. Both pages take
 * the run's years as the gate cut them (`revealed`) and nothing else, so they
 * cannot show a result past the cursor, and they render without a router or a
 * store for the same reason every page here does.
 *
 * **Everything is derived on render**, off the same walks the panels and the
 * record cards use (`seasonHistories`, `careerRecords`), plus the roster for
 * the years someone was entered but has not raced yet.
 */

import { useMemo, useState } from "react";
import { driverSeasonsBefore, seasonsBefore, stripesOf } from "../lib/barcode.js";
import { showcaseYears } from "../lib/car-showcase.js";
import { STANDOUT_TEXT } from "../lib/highlight.js";
import {
  count,
  type DriverSeason,
  isTitle,
  ordinal,
  type SeasonFigures,
  seasonHistories,
  type TeamSeason,
} from "../lib/history.js";
import { liveryFor } from "../lib/livery.js";
import { driverBirthYear, driverCountry, driverName } from "../lib/names.js";
import { carLabel } from "../lib/parade.js";
import { type CareerRecord, careerRecords, spellSpan } from "../lib/records.js";
import { driverRounds, type RoundEntry, teamRounds } from "../lib/results.js";
import type { RevealedWorld } from "../lib/reveal.js";
import { bestOverall, type DriverAppearance, rosterOf } from "../lib/roster.js";
import { seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { CarTooltip, type Point } from "./CarTooltip.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { EntryNames, useTeamCountryIn, useTeamNameIn } from "./EntryNames.js";
import { Liveries, useLiveryYear } from "./Liveries.js";
import { LiveryBarcode } from "./LiveryBarcode.js";
import { PageHeading } from "./PageHeading.js";
import { PageLink } from "./PageLink.js";
import { RaceByRace } from "./RaceByRace.js";
import { DriverHistory, HISTORY_FILL, TeamHistory, usePageOf } from "./SeasonHistory.js";
import { TeamBadge } from "./TeamBadge.js";
import { carLook, LiveryCar } from "./TeamCar.js";
import { TeamName } from "./TeamName.js";
import { TitleCount } from "./TitleCount.js";
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

/** The run's years with the walks every page here reads, made once per render of the page. */
function useCareers(years: readonly RevealedWorld[]) {
  const teamNameIn = useTeamNameIn();
  return useMemo(
    () => ({
      roster: rosterOf(years),
      histories: seasonHistories(years),
      records: careerRecords(years, teamNameIn),
    }),
    [years, teamNameIn],
  );
}

/**
 * The run's totals as one line: "3 titles · 21 wins · 40 podiums · 18 poles".
 * A zero is left out, as on a panel; a career with none of them says so.
 */
export function totalsLine(record: CareerRecord | undefined): string {
  if (record === undefined) {
    return "No races yet";
  }
  const parts = [
    record.titles > 0 ? count(record.titles, "title", "titles") : null,
    record.wins > 0 ? count(record.wins, "win", "wins") : null,
    record.podiums > 0 ? count(record.podiums, "podium", "podiums") : null,
    record.poles > 0 ? count(record.poles, "pole", "poles") : null,
    `${record.points} pts`,
  ];
  return parts.filter((part) => part !== null).join(" · ");
}

/**
 * A page's heading: who, with their titles' trophy after the name, their totals
 * in the mono sub-line, and the line under it, with a team's cars across from
 * them where the width allows.
 */
function PersonHeader({
  country,
  name,
  badge,
  titles,
  details,
  totals,
  cars,
  strip,
}: {
  country: string | undefined;
  name: string;
  badge?: React.ReactNode;
  titles?: React.ReactNode;
  details: React.ReactNode;
  totals: string;
  cars?: React.ReactNode;
  /** Under it all, on a team's page: the livery barcode. */
  strip?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <PageHeading
            title={
              <>
                {name}
                {titles}
              </>
            }
            flag={country}
            badge={badge}
            sub={totals}
          />
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            {details}
          </p>
        </div>
        {cars}
      </div>
      {strip}
    </header>
  );
}

/**
 * Which width a showcase car first shows at, by its place in the row. The
 * latest car comes first, as the header beside it describes the latest year;
 * then the first; the one between only on a wide screen. On a phone, none: the
 * name needs the room.
 */
function showcaseClass(index: number, shown: number): string {
  if (index === shown - 1) {
    return "sm:flex";
  }
  return index === 0 ? "md:flex" : "lg:flex";
}

/** A year on the grid and the team raced for in it: one car to draw. */
interface ShowcaseYear {
  readonly year: number;
  readonly teamId: string;
}

/**
 * The cars across someone's run — a team's own, or those of each team a driver
 * raced for: the first, one from the years between and the latest, each only if
 * it looks different from the others (`showcaseYears`). The car between is
 * picked afresh each time the page opens. Still, not turning: these are a
 * gallery, not a winner's lap. Pointing at one names its team, as on the track.
 */
function ShowcaseCars({ cars }: { cars: readonly ShowcaseYear[] }) {
  const liveryYear = useLiveryYear();
  const teamNameIn = useTeamNameIn();
  // Drawn once per visit, so the page does not change car as the reader opens a row.
  const [pick] = useState(Math.random);
  const [tooltip, setTooltip] = useState<{ line: string; at: Point } | null>(null);
  const teamIn = new Map(cars.map(({ year, teamId }) => [year, teamId]));
  const liveryIn = (year: number) => {
    const teamId = teamIn.get(year);
    return teamId === undefined ? undefined : liveryFor(teamId, liveryYear(teamId, year));
  };
  const shown = showcaseYears(
    cars.map((each) => each.year),
    (year) => {
      const livery = liveryIn(year);
      return livery === undefined ? "" : carLook(livery, year);
    },
    pick,
  );
  return (
    <div className="hidden shrink-0 items-end gap-4 sm:flex">
      {shown.map((year, index) => {
        const livery = liveryIn(year);
        const teamId = teamIn.get(year);
        if (livery === undefined || teamId === undefined) {
          return null;
        }
        const line = carLabel({ teamId, year }, teamNameIn);
        return (
          <figure
            key={year}
            className={cn(
              "hidden flex-col items-center gap-1.5",
              showcaseClass(index, shown.length),
            )}
            onPointerMove={(event) =>
              setTooltip({ line, at: { x: event.clientX, y: event.clientY } })
            }
            onPointerLeave={() => setTooltip(null)}
          >
            <LiveryCar livery={livery} year={year} size="large" />
            <figcaption className="text-muted-foreground font-mono text-xs tabular-nums">
              {year}
            </figcaption>
          </figure>
        );
      })}
      {tooltip === null ? null : <CarTooltip line={tooltip.line} at={tooltip.at} />}
    </div>
  );
}

/** One year of the seasons table, as both pages describe it. */
interface CareerYear {
  readonly year: number;
  readonly world: RevealedWorld;
  /** Who they were that year: a team on a driver's page, the entry on a team's. */
  readonly who: React.ReactNode;
  /** Under it, on a team's page: who drove. */
  readonly under?: React.ReactNode;
  /** Undefined for a year on the grid with no race yet. */
  readonly figures: SeasonFigures | undefined;
  readonly rounds: readonly RoundEntry[];
}

const FIGURES = ["points", "wins", "podiums", "poles"] as const;

/**
 * A figure's cells. A phone keeps points and wins, as a standings row does, so
 * the table never scrolls sideways; the room goes to the team.
 */
function figureClass(key: (typeof FIGURES)[number]): string {
  return cn(
    "px-2 text-right sm:px-3",
    (key === "podiums" || key === "poles") && "hidden sm:table-cell",
  );
}

/**
 * Year by year, latest first, each opening into its races. All start shut.
 *
 * `teams` switches on the driver column of the races, since a team's rounds
 * are a row per car.
 */
export function CareerSeasons({
  years,
  teams = false,
}: {
  years: readonly CareerYear[];
  teams?: boolean;
}) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  // Each year's season page, inside the run's frame; none in a test without one.
  const pageOf = usePageOf();
  const columns = 3 + FIGURES.length;
  return (
    <Card>
      <CardBand title="Season by season" label={count(years.length, "season", "seasons")} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 sm:w-20 sm:px-3">Year</TableHead>
            <TableHead className="px-2 sm:px-3">{teams ? "Entry" : "Team"}</TableHead>
            <TableHead className="px-2 text-right sm:px-3">Pos</TableHead>
            <TableHead className={figureClass("points")}>Pts</TableHead>
            <TableHead className={figureClass("wins")}>Wins</TableHead>
            <TableHead className={figureClass("podiums")}>Podiums</TableHead>
            <TableHead className={figureClass("poles")}>Poles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {years.map((each) => {
            const isOpen = open.has(each.year);
            const toCome = each.world.season.rounds - each.world.season.races.length;
            return (
              <Liveries key={each.year} year={each.year}>
                <EntryNames field={each.world.field}>
                  <TableRow className={cn(isOpen && "bg-muted/60")}>
                    <TableCell className="px-2 sm:px-3">
                      <span className="flex items-center gap-1 max-sm:flex-col max-sm:items-start">
                        <DisclosureButton
                          open={isOpen}
                          onToggle={() => {
                            const next = new Set(open);
                            if (isOpen) {
                              next.delete(each.year);
                            } else {
                              next.add(each.year);
                            }
                            setOpen(next);
                          }}
                        >
                          <span className="font-medium tabular-nums">{each.year}</span>
                        </DisclosureButton>
                        {pageOf === null ? null : (
                          <PageLink
                            link={pageOf.season(each.year)}
                            label={`${each.year} season page`}
                          />
                        )}
                      </span>
                    </TableCell>
                    {/*
                      `w-full max-w-0`, as on a record card: the team takes the
                      slack and ends in an ellipsis, so a phone never scrolls.
                    */}
                    <TableCell className="w-full max-w-0 px-2 whitespace-normal sm:px-3">
                      <span className="flex flex-col gap-0.5">
                        {each.who}
                        {each.under}
                      </span>
                    </TableCell>
                    {each.figures === undefined ? (
                      <TableCell
                        colSpan={1 + FIGURES.length}
                        className="text-muted-foreground text-right text-xs"
                      >
                        On the grid
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="px-2 text-right tabular-nums sm:px-3">
                          <span
                            className={cn(
                              isTitle(each.figures) ? `${STANDOUT_TEXT} font-semibold` : undefined,
                            )}
                          >
                            {ordinal(each.figures.position)}
                          </span>
                          {each.figures.afterRound === null ? null : (
                            <span className="text-muted-foreground block text-xs">
                              after round {each.figures.afterRound}
                            </span>
                          )}
                        </TableCell>
                        {FIGURES.map((key) => (
                          <TableCell
                            key={key}
                            className={cn(
                              figureClass(key),
                              "tabular-nums",
                              key === "points" ? "font-semibold" : "text-muted-foreground",
                            )}
                          >
                            {each.figures?.[key]}
                          </TableCell>
                        ))}
                      </>
                    )}
                  </TableRow>
                  {isOpen ? (
                    <TableExpansion colSpan={columns}>
                      <RaceByRace
                        rounds={each.rounds}
                        calendar={seasonSeed(each.year).calendar}
                        year={each.year}
                        showDriver={teams}
                      />
                      {toCome > 0 ? (
                        <p className="text-muted-foreground px-3 pt-2 text-xs">
                          {count(toCome, "round", "rounds")} to come
                        </p>
                      ) : null}
                    </TableExpansion>
                  ) : null}
                </EntryNames>
              </Liveries>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

/** The world of `year` among the run's years; the roster only names years it has. */
function worldOf(years: readonly RevealedWorld[], year: number): RevealedWorld {
  const world = years.find((each) => each.year === year);
  if (world === undefined) {
    throw new Error(`No year ${year} in the run`);
  }
  return world;
}

/**
 * One driver across the run so far: their age now, their latest team, their
 * best rating of the run, what the run adds up to for them, and every year of it.
 */
export function DriverPage({
  years,
  driverId,
}: {
  years: readonly RevealedWorld[];
  driverId: string;
}) {
  const { roster, histories, records } = useCareers(years);
  const appearances = roster.drivers.get(driverId) ?? [];
  const seasons = histories.drivers.get(driverId) ?? [];
  const latest = appearances.at(-1);
  if (latest === undefined) {
    return null;
  }
  const latestWorld = worldOf(years, latest.year);
  const born = driverBirthYear(driverId);
  // The age is as of the year the run has reached, on the grid or not; the
  // team is their latest, "last with" once they are off that year's grid; the
  // rating is their best of the run, not a verdict from whichever year they
  // were last seen.
  const now = Math.max(...years.map((each) => each.year));
  const best = bestOverall(years, driverId);
  const record = records.drivers.find((each) => each.id === driverId);
  const details = (
    <>
      {born === undefined ? null : (
        <span>
          {now - born} years old in {now} ·
        </span>
      )}
      {latest.year < now ? <span>last with</span> : null}
      <EntryNames field={latestWorld.field}>
        <Liveries year={latest.year}>
          <TeamName teamId={latest.teamId} badge capitals={false} />
        </Liveries>
      </EntryNames>
      {best === null ? null : (
        <span>
          · rated {best.overall} at their peak, in {best.year}
        </span>
      )}
    </>
  );

  const rows: CareerYear[] = [...appearances].reverse().map(({ year, teamId }) => {
    const world = worldOf(years, year);
    const season: DriverSeason | undefined = seasons.find((each) => each.year === year);
    return {
      year,
      world,
      who: (
        <TeamHistory teamId={season?.teamId ?? teamId} className={HISTORY_FILL}>
          <TeamName teamId={season?.teamId ?? teamId} badge tight />
        </TeamHistory>
      ),
      figures: season,
      rounds: driverRounds(world.season, world.points, driverId),
    };
  });
  // The team each row names: off the table once they have raced.
  const teamOf = ({ year, teamId }: DriverAppearance) =>
    seasons.find((each) => each.year === year)?.teamId ?? teamId;
  // Their career, as the team page's life: before the run as history had it,
  // then the run's own, up to the year the run has reached.
  const stripes = stripesOf(
    new Map([
      ...driverSeasonsBefore(driverId, years[0]?.year ?? latest.year),
      ...appearances.map((appearance) => [appearance.year, teamOf(appearance)] as const),
    ]),
    now,
  );

  return (
    <div className="flex flex-col gap-6">
      <PersonHeader
        country={driverCountry(driverId)}
        name={driverName(driverId)}
        titles={<TitleCount titles={record?.titles ?? 0} kind="driver" size="heading" />}
        details={details}
        totals={totalsLine(record)}
        cars={
          <ShowcaseCars
            cars={appearances.map((appearance) => ({
              year: appearance.year,
              teamId: teamOf(appearance),
            }))}
          />
        }
        strip={<LiveryBarcode stripes={stripes} current={now} nameEvery />}
      />
      <CareerSeasons years={rows} />
    </div>
  );
}

/**
 * One team lineage across the run so far: named as of its latest year, every
 * name it raced under, and every year with who drove.
 */
export function TeamPage({ years, teamId }: { years: readonly RevealedWorld[]; teamId: string }) {
  const { roster, histories, records } = useCareers(years);
  const teamNameIn = useTeamNameIn();
  const teamCountryIn = useTeamCountryIn();
  const appearances = roster.teams.get(teamId) ?? [];
  const seasons = histories.teams.get(teamId) ?? [];
  const latest = appearances.at(-1);
  if (latest === undefined) {
    return null;
  }
  const record = records.teams.find((each) => each.id === teamId);
  const spells = record?.spells ?? [];
  const first = appearances[0]?.year ?? latest.year;
  // The team's life: its seasons before the run as history had them, then the
  // run's own, up to the year the run has reached and never past it.
  const runFirst = years[0]?.year ?? first;
  const now = Math.max(...years.map((each) => each.year));
  const stripes = stripesOf(
    new Map(
      [...seasonsBefore(teamId, runFirst), ...appearances.map(({ year }) => year)].map((year) => [
        year,
        teamId,
      ]),
    ),
    now,
  );

  const rows: CareerYear[] = [...appearances].reverse().map(({ year, driverIds }) => {
    const world = worldOf(years, year);
    const season: TeamSeason | undefined = seasons.find((each) => each.year === year);
    // Who drove: off the drivers' table once they have raced, in championship
    // order with their place; off the entry list before that.
    const drivers =
      season === undefined || season.drivers.length === 0
        ? driverIds.map((driverId) => ({ driverId, position: null as number | null }))
        : season.drivers.map((driver) => ({
            driverId: driver.driverId,
            position: driver.position,
          }));
    return {
      year,
      world,
      who: <TeamName teamId={teamId} badge tight />,
      under: (
        <span className="text-muted-foreground flex flex-wrap gap-x-2 pl-6 text-xs">
          {drivers.map(({ driverId, position }) => (
            <DriverHistory key={driverId} driverId={driverId}>
              <span
                className={cn(
                  position === 1 && season?.afterRound === null && `${STANDOUT_TEXT} font-semibold`,
                )}
              >
                {driverName(driverId)}
                {position === null ? null : ` ${ordinal(position)}`}
              </span>
            </DriverHistory>
          ))}
        </span>
      ),
      figures: season,
      rounds: teamRounds(world.season, world.points, teamId),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Liveries year={latest.year}>
        <PersonHeader
          badge={<TeamBadge teamId={teamId} />}
          country={teamCountryIn(teamId, latest.year)}
          name={teamNameIn(teamId, latest.year)}
          titles={<TitleCount titles={record?.titles ?? 0} kind="team" size="heading" />}
          details={
            spells.length > 1
              ? `Raced as ${spells.map((spell) => `${spell.name} (${spellSpan(spell)})`).join(" · ")}`
              : `In the run ${first === latest.year ? first : `${first}–${latest.year}`}`
          }
          totals={totalsLine(record)}
          cars={<ShowcaseCars cars={appearances.map(({ year }) => ({ year, teamId }))} />}
          strip={<LiveryBarcode stripes={stripes} current={now} />}
        />
      </Liveries>
      <CareerSeasons years={rows} teams />
    </div>
  );
}
