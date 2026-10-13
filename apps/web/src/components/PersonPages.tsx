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
import { driverBirthYear, driverCountry, driverName } from "../lib/names.js";
import { type CareerRecord, careerRecords, spellSpan } from "../lib/records.js";
import { driverRounds, type RoundEntry, teamRounds } from "../lib/results.js";
import type { RevealedWorld } from "../lib/reveal.js";
import { bestOverall, rosterOf } from "../lib/roster.js";
import { seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { EntryNames, useTeamCountryIn, useTeamNameIn } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { Liveries } from "./Liveries.js";
import { PageLink } from "./PageLink.js";
import { RaceByRace } from "./RaceByRace.js";
import { DriverHistory, TeamHistory, usePageOf } from "./SeasonHistory.js";
import { TeamBadge } from "./TeamBadge.js";
import { TeamName } from "./TeamName.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
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

/** A page's heading: who, and the line under it. */
function PersonHeader({
  country,
  name,
  badge,
  details,
  totals,
}: {
  country: string | undefined;
  name: string;
  badge?: React.ReactNode;
  details: React.ReactNode;
  totals: string;
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {badge}
        {country === undefined ? null : <Flag country={country} title={country} />}
        <span>{name}</span>
      </h1>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">{details}</p>
      <p className="text-sm font-medium">{totals}</p>
    </header>
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
      <CardHeader>
        <CardTitle>Season by season</CardTitle>
        <CardDescription>Select a year for its races.</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Year</TableHead>
            <TableHead>{teams ? "Entry" : "Team"}</TableHead>
            <TableHead className="text-right">Pos</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">Wins</TableHead>
            <TableHead className="text-right">Podiums</TableHead>
            <TableHead className="text-right">Poles</TableHead>
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
                    <TableCell>
                      <span className="flex items-center gap-1">
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
                    <TableCell>
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
                        <TableCell className="text-right tabular-nums">
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
                              "text-right tabular-nums",
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
          <TeamName teamId={latest.teamId} badge />
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
        <TeamHistory teamId={season?.teamId ?? teamId}>
          <TeamName teamId={season?.teamId ?? teamId} badge />
        </TeamHistory>
      ),
      figures: season,
      rounds: driverRounds(world.season, world.points, driverId),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PersonHeader
        country={driverCountry(driverId)}
        name={driverName(driverId)}
        details={details}
        totals={totalsLine(records.drivers.find((each) => each.id === driverId))}
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
      who: <TeamName teamId={teamId} badge />,
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
          details={
            spells.length > 1
              ? `Raced as ${spells.map((spell) => `${spell.name} (${spellSpan(spell)})`).join(" · ")}`
              : `In the run ${first === latest.year ? first : `${first}–${latest.year}`}`
          }
          totals={totalsLine(record)}
        />
      </Liveries>
      <CareerSeasons years={rows} teams />
    </div>
  );
}
