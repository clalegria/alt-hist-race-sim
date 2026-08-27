import { Fragment, useMemo, useState } from "react";
import { eraChampions, eraSpan, type SeasonChampions } from "../lib/era.js";
import { STANDOUT_ROW } from "../lib/highlight.js";
import { nextEraYear, seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import type { EraRun } from "../store/season.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { EntryNames } from "./EntryNames.js";
import { Liveries } from "./Liveries.js";
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
}: {
  season: SeasonChampions;
  latest: boolean;
  open: boolean;
  onToggle: () => void;
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
            <DisclosureButton open={open} onToggle={onToggle}>
              {season.year}
            </DisclosureButton>
          </TableCell>
          <TableCell>
            <DriverName
              driverId={season.driver?.driverId ?? null}
              {...(season.driver === null ? {} : { teamId: season.driver.teamId })}
              emphasis
              badge
            />
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
              <TeamName teamId={season.team.teamId} emphasis badge />
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
export function EraChampions({ run }: { run: EraRun }) {
  const seasons = useMemo(() => eraChampions(run.seasons), [run.seasons]);
  // Which year is opened out, or null for none. View state, and only this
  // screen's: which year a reader is reading says nothing about the simulation.
  // One at a time, because two full championship tables is already a page.
  const [openYear, setOpenYear] = useState<number | null>(null);
  const first = seasons[0];
  const last = seasons.at(-1);
  const nextYear = last === undefined ? null : nextEraYear(last.year);
  const span = eraSpan(seasons);

  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Champions so far</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {seasons.length === 1
            ? `One season run, ${span}.`
            : `${seasons.length} seasons run, ${span}.`}{" "}
          {nextYear === null
            ? "There is no season after this one to run — the era ends here."
            : `Next comes ${nextYear}, on the grid that year actually had.`}
        </p>
        {/*
          The settings the run was started on, which every year of it shares —
          they are baked in when an era begins. Read off the first season
          crowned rather than the last, because that is the one that fixed them.
        */}
        {first === undefined ? null : (
          <SimulationSettings
            settings={settingsOf(first.world)}
            className="text-muted-foreground text-xs"
          />
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Roll of honour</CardTitle>
          <CardDescription>
            Every title of this era, in the order it was won. Select a year for its full
            championship tables.
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
                  latest={season.year === last?.year}
                  open={openYear === season.year}
                  onToggle={() => {
                    setOpenYear(openYear === season.year ? null : season.year);
                  }}
                />
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
