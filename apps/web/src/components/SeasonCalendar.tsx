import type { CalendarRace } from "@alt-hist/data";
import type { PointsScale, RaceResult, SeasonResult } from "@alt-hist/engine";
import { useState } from "react";
import type { RoundPages } from "../lib/session-nav.js";
import { cn } from "../lib/utils.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { Flag } from "./Flag.js";
import { PageLink } from "./PageLink.js";
import { RaceClassification } from "./RaceClassification.js";
import { DriverHistory, HISTORY_FILL } from "./SeasonHistory.js";
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
import { WeatherBadge } from "./WeatherBadge.js";

/**
 * A phone's calendar row is the round and its winner, never a sideways scroll:
 * the pole shows from `sm`, as Pods and Poles do on the standings, and the
 * Grand Prix's name wraps, and its rain pill drops under the circuit, rather
 * than widening the column.
 *
 * The two name columns split the slack between them, `max-w-0` so a name never
 * sizes its column — the provisional standings' trick — and each name fits to
 * what it is given rather than pushing a scrollbar under the card.
 */
const GRAND_PRIX = "max-sm:whitespace-normal max-sm:px-2";
const NAME_COLUMN = "w-1/2 max-w-0 max-sm:px-2";
/** The round number, narrowed on a phone to give the winner its room. */
const ROUND = "w-12 text-right tabular-nums max-sm:w-8 max-sm:px-2";
const POLE = cn(NAME_COLUMN, "hidden sm:table-cell");

/** What the pending round shows in place of its winner. */
export const NOT_YET = "Not reached yet";

/**
 * The winner of the round whose qualifying alone is revealed: dots, and words
 * for a screen reader. A round further ahead leaves both cells empty — the dots
 * mark the one race that is next, not every race still to come.
 */
function NotYet() {
  return (
    <span title={NOT_YET} className="text-muted-foreground">
      <span aria-hidden="true">···</span>
      <span className="sr-only">{NOT_YET}</span>
    </span>
  );
}

/**
 * A round's name and, under it, its circuit and the weather once it has been
 * run.
 *
 * Only the name line is the button, when the row opens (`disclosure`), so the
 * page icon (`link`) can sit right after the name rather than past the end of
 * whichever line is longer — a link cannot go inside a button. The line under
 * it starts behind an invisible chevron, so it stays aligned with the name.
 */
function RoundName({
  round,
  index,
  race,
  disclosure,
  link,
  dim = false,
}: {
  round: CalendarRace | undefined;
  index: number;
  race?: RaceResult | undefined;
  disclosure?: { readonly open: boolean; readonly onToggle: () => void } | undefined;
  link?: React.ReactNode;
  /** A round not reached: its words in `text-subtle`, its link (if any) not. */
  dim?: boolean;
}) {
  const name = (
    <span
      className={cn(
        "narrow flex items-center gap-1.5 font-extrabold tracking-[0.01em] uppercase",
        dim && "text-subtle",
      )}
    >
      {round === undefined ? null : <Flag country={round.country} title={round.country} />}
      {roundLabel(round, index)}
    </span>
  );
  return (
    <span className="flex flex-col leading-tight">
      <span className="flex items-center gap-1">
        {disclosure === undefined ? (
          name
        ) : (
          <DisclosureButton open={disclosure.open} onToggle={disclosure.onToggle}>
            {name}
          </DisclosureButton>
        )}
        {link}
      </span>
      <span className="flex items-center gap-2">
        {disclosure === undefined ? null : (
          <span aria-hidden="true" className="invisible text-xs">
            ▶
          </span>
        )}
        {/*
          On a phone the pill drops under the circuit when the two don't fit:
          one wet Hockenheimring would otherwise set the column's width for
          every row and squeeze the winners. Inside its own box, so a dropped
          pill keeps the circuit's indent.
        */}
        <span className="flex items-center gap-x-2 gap-y-1 max-sm:flex-wrap">
          {round === undefined ? null : (
            <span
              className={cn(
                "font-mono text-xs tracking-wider uppercase",
                dim ? "text-subtle" : "text-muted-foreground",
              )}
            >
              {round.circuit}
            </span>
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
    </span>
  );
}

/** A round's pole-sitter or winner, opening their career panel; a dash for nobody. */
function RoundDriver({
  driverId,
  teamFor,
}: {
  driverId: string | null;
  teamFor: ReadonlyMap<string, string>;
}) {
  if (driverId === null) {
    return <DriverName driverId={null} />;
  }
  return (
    <span className="flex min-w-0">
      <DriverHistory driverId={driverId} className={HISTORY_FILL}>
        <DriverName driverId={driverId} teamId={teamFor.get(driverId)} badge tight />
      </DriverHistory>
    </span>
  );
}

/** A round's name for a link's label: the Grand Prix, or its number without one. */
function roundLabel(round: CalendarRace | undefined, index: number): string {
  return round?.name ?? `Round ${index + 1}`;
}

/**
 * One round the reader has seen, and — opened — its classification.
 *
 * **Controlled**, like the roll of honour's `ChampionRow`: whether it is open
 * comes from the table, so an opened row renders on its own without a DOM and
 * without a click. `pages` puts the page icon beside the name, as the roll of
 * honour does beside a year: the name opens the quick look in place, the icon
 * goes to the race's page. Absent in a test without a router, and the icon
 * with it.
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
        <TableCell className={cn(ROUND, "text-muted-foreground")}>{index + 1}</TableCell>
        <TableCell className={GRAND_PRIX}>
          <RoundName
            round={round}
            index={index}
            race={race}
            disclosure={{ open, onToggle }}
            link={
              pages === undefined ? null : (
                <PageLink link={pages.race} label={`${roundLabel(round, index)} race page`} />
              )
            }
          />
        </TableCell>
        <TableCell className={POLE}>
          <RoundDriver driverId={race.poleDriverId} teamFor={teamFor} />
        </TableCell>
        <TableCell className={NAME_COLUMN}>
          <RoundDriver driverId={race.winnerDriverId} teamFor={teamFor} />
        </TableCell>
      </TableRow>
      {open ? (
        <TableExpansion colSpan={4}>
          {/*
            The round's own country, so an entry racing at home is starred
            here exactly as it is on the race screen. The cars too, by the
            author's call — unlike the badges, which an expansion leaves off.
          */}
          <RaceClassification race={race} points={points} country={round?.country} car />
        </TableExpansion>
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
 * qualifying is revealed and whose race is not, which shows its pole and
 * dots for its winner.
 *
 * `pagesOf` gives a round's pages, and with it each name gains the page icon:
 * to its race on a round raced, to its qualifying on the pending round,
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
      <CardBand
        title="Calendar"
        label={raced === rounds ? `${rounds} rounds` : `${raced} of ${rounds} raced`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={ROUND}>Rnd</TableHead>
            <TableHead>Grand Prix</TableHead>
            <TableHead className={POLE}>Pole</TableHead>
            <TableHead className={NAME_COLUMN}>Winner</TableHead>
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
                  <TableCell className={ROUND}>{index + 1}</TableCell>
                  <TableCell className={GRAND_PRIX}>
                    {/* Not a button: there is nothing yet to open. */}
                    <RoundName
                      round={round}
                      index={index}
                      dim
                      link={
                        // Its qualifying is the one page of this round reached.
                        pagesOf === undefined || pole === null ? null : (
                          <PageLink
                            link={pagesOf(index).qualifying}
                            label={`${roundLabel(round, index)} qualifying page`}
                          />
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className={POLE}>
                    {pole === null ? null : <RoundDriver driverId={pole} teamFor={teamFor} />}
                  </TableCell>
                  <TableCell className={NAME_COLUMN}>{pole === null ? null : <NotYet />}</TableCell>
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
