import type { CalendarRace } from "@alt-hist/data";
import type { PointsScale, RaceResult, SeasonResult } from "@alt-hist/engine";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { RoundPages } from "../lib/session-nav.js";
import { cn } from "../lib/utils.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { Flag } from "./Flag.js";
import { RaceClassification } from "./RaceClassification.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { WeatherBadge } from "./WeatherBadge.js";

/** What a round not reached shows in place of a name. */
export const NOT_YET = "Not reached yet";

/** A pole or a winner the reader has not reached: dots, and words for a screen reader. */
function NotYet() {
  return (
    <span title={NOT_YET} className="text-muted-foreground">
      <span aria-hidden="true">···</span>
      <span className="sr-only">{NOT_YET}</span>
    </span>
  );
}

/** The words under a round's name: its circuit, and the weather once it has been run. */
function RoundName({
  round,
  index,
  race,
}: {
  round?: CalendarRace;
  index: number;
  race?: RaceResult;
}) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="flex items-center gap-1.5 font-medium">
        {round === undefined ? null : <Flag country={round.country} title={round.country} />}
        {round?.name ?? `Round ${index + 1}`}
      </span>
      <span className="flex items-center gap-2">
        {round === undefined ? null : (
          <span className="text-muted-foreground text-xs">{round.circuit}</span>
        )}
        {/*
          Under the circuit rather than beside the name: a wet round is a fact
          about the afternoon, and the line that already says where it was held
          is where the rest of the conditions belong. Dry rounds draw nothing,
          so the column stays quiet.
        */}
        {race === undefined ? null : <WeatherBadge weather={race.weather} compact />}
      </span>
    </span>
  );
}

const PAGE_LINK = "text-primary font-medium whitespace-nowrap underline-offset-4 hover:underline";

/**
 * One round the reader has seen, and — opened — its classification.
 *
 * **Controlled**, like the roll of honour's `ChampionRow`: whether it is open
 * comes from the table, so an opened row renders on its own without a DOM and
 * without a click. `pages` adds a last cell linking the round's race page:
 * the name opens the quick look in place, the link goes to the page. Absent in
 * a test without a router, and the cell with it.
 */
export function CalendarRow({
  index,
  round,
  race,
  points,
  teamFor,
  open,
  onToggle,
  pages,
}: {
  index: number;
  round: CalendarRace | undefined;
  race: RaceResult;
  points: PointsScale;
  teamFor: ReadonlyMap<string, string>;
  open: boolean;
  onToggle: () => void;
  pages?: RoundPages | undefined;
}) {
  return (
    <>
      <TableRow className={cn(open && "bg-muted/60")}>
        <TableCell className="text-muted-foreground text-right tabular-nums">{index + 1}</TableCell>
        <TableCell>
          <DisclosureButton open={open} onToggle={onToggle}>
            <RoundName {...(round === undefined ? {} : { round })} index={index} race={race} />
          </DisclosureButton>
        </TableCell>
        <TableCell>
          <DriverName driverId={race.poleDriverId} teamId={teamFor.get(race.poleDriverId)} badge />
        </TableCell>
        <TableCell>
          <DriverName
            driverId={race.winnerDriverId}
            teamId={race.winnerDriverId === null ? undefined : teamFor.get(race.winnerDriverId)}
            badge
          />
        </TableCell>
        {pages === undefined ? null : (
          <TableCell className="text-right">
            <Link {...pages.race} className={PAGE_LINK}>
              Race →
            </Link>
          </TableCell>
        )}
      </TableRow>
      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={pages === undefined ? 4 : 5} className="p-0">
            <div className="bg-muted/40 border-border border-y px-3 py-3">
              {/*
                The round's own country, so an entry racing at home is starred
                here exactly as it is on the race screen. The cars too, by the
                author's call — unlike the badges, which an expansion leaves off.
              */}
              <RaceClassification race={race} points={points} country={round?.country} car />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/**
 * Every round of a season, with its pole and winner once the reader has seen
 * them.
 *
 * `season` is the season as far as the reader has got, so a round past the
 * cursor has no result to draw: it is listed, greyed, and does not open.
 * `rounds` says how many there are in all; `pending` is the round whose
 * qualifying is revealed and whose race is not, which shows its pole only.
 *
 * `pagesOf` gives a round's pages, and with it the table gains a last column
 * of links: *Race →* on a round raced, *Qualifying →* on the pending round,
 * nothing on a round ahead. It is the season's table of contents, so each
 * entry leads to its page; opening the row is the quick look.
 */
export function SeasonCalendar({
  season,
  calendar,
  points,
  teamFor,
  rounds = season.races.length,
  pending = null,
  pagesOf,
}: {
  season: SeasonResult;
  /** The rounds of the year being shown, in order. Names the races. */
  calendar: readonly CalendarRace[];
  /** The season's points scale, for the classification each round opens into. */
  points: PointsScale;
  teamFor: ReadonlyMap<string, string>;
  /** How many rounds the season has; the races revealed when absent. */
  rounds?: number;
  /** The round whose qualifying alone is revealed, and who took its pole. */
  pending?: { readonly round: number; readonly poleDriverId: string } | null;
  /** A round's pages, by its zero-based index. Absent in a test without a router. */
  pagesOf?: ((round: number) => RoundPages) | undefined;
}) {
  // Which round is expanded, or null for none. Purely view state — it says
  // nothing about the simulation, so it stays here rather than in the store.
  const [openRound, setOpenRound] = useState<number | null>(null);
  const raced = season.races.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
        <CardDescription>
          {raced === rounds ? `${rounds} rounds.` : `${raced} of ${rounds} rounds raced.`}{" "}
          {raced === 0 ? "" : "Select a race for its full classification."}
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">Rnd</TableHead>
            <TableHead>Grand Prix</TableHead>
            <TableHead>Pole</TableHead>
            <TableHead>Winner</TableHead>
            {pagesOf === undefined ? null : (
              <TableHead>
                <span className="sr-only">Page</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rounds }, (_, index) => {
            const round = calendar[index];
            const race = season.races[index];
            const key = round?.round ?? index;
            if (race === undefined) {
              const pole = pending?.round === index ? pending.poleDriverId : null;
              return (
                <TableRow key={key} className="text-muted-foreground hover:bg-transparent">
                  <TableCell className="text-right tabular-nums">{index + 1}</TableCell>
                  {/* Not a button: there is nothing yet to open. */}
                  <TableCell className="opacity-70">
                    <RoundName {...(round === undefined ? {} : { round })} index={index} />
                  </TableCell>
                  <TableCell>
                    {pole === null ? (
                      <NotYet />
                    ) : (
                      <DriverName driverId={pole} teamId={teamFor.get(pole)} badge />
                    )}
                  </TableCell>
                  <TableCell>
                    <NotYet />
                  </TableCell>
                  {pagesOf === undefined ? null : (
                    <TableCell className="text-right">
                      {/* Its qualifying is the one page of this round reached. */}
                      {pole === null ? null : (
                        <Link {...pagesOf(index).qualifying} className={PAGE_LINK}>
                          Qualifying →
                        </Link>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            }
            const isOpen = openRound === index;
            return (
              <CalendarRow
                key={key}
                index={index}
                round={round}
                race={race}
                points={points}
                teamFor={teamFor}
                open={isOpen}
                onToggle={() => {
                  setOpenRound(isOpen ? null : index);
                }}
                pages={pagesOf?.(index)}
              />
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
