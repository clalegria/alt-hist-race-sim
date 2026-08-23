import type { CalendarRace } from "@alt-hist/data";
import type { SeasonResult } from "@alt-hist/engine";
import { Fragment, useState } from "react";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Flag } from "./Flag.js";
import { RaceClassification } from "./RaceClassification.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

export function SeasonCalendar({
  season,
  calendar,
  teamFor,
}: {
  season: SeasonResult;
  /** The rounds of the year being shown, in order. Names the races. */
  calendar: readonly CalendarRace[];
  teamFor: ReadonlyMap<string, string>;
}) {
  // Which round is expanded, or null for none. Purely view state — it says
  // nothing about the simulation, so it stays here rather than in the store.
  const [openRound, setOpenRound] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season</CardTitle>
        <CardDescription>
          {season.races.length} rounds. Select a race for its full classification.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">Rnd</TableHead>
            <TableHead>Grand Prix</TableHead>
            <TableHead>Pole</TableHead>
            <TableHead>Winner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {season.races.map((race, index) => {
            const round = calendar[index];
            const isOpen = openRound === index;
            return (
              <Fragment key={round?.round ?? index}>
                <TableRow className={cn(isOpen && "bg-muted/60")}>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => {
                        setOpenRound(isOpen ? null : index);
                      }}
                      className="focus-visible:ring-ring -mx-1 flex cursor-pointer items-center gap-2 rounded px-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "text-muted-foreground inline-block text-xs transition-transform",
                          isOpen && "rotate-90",
                        )}
                      >
                        ▶
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span className="flex items-center gap-1.5 font-medium">
                          {round === undefined ? null : (
                            <Flag country={round.country} title={round.country} />
                          )}
                          {round?.name ?? `Round ${index + 1}`}
                        </span>
                        {round === undefined ? null : (
                          <span className="text-muted-foreground text-xs">{round.circuit}</span>
                        )}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <DriverName
                      driverId={race.poleDriverId}
                      teamId={teamFor.get(race.poleDriverId)}
                    />
                  </TableCell>
                  <TableCell>
                    <DriverName
                      driverId={race.winnerDriverId}
                      teamId={
                        race.winnerDriverId === null ? undefined : teamFor.get(race.winnerDriverId)
                      }
                    />
                  </TableCell>
                </TableRow>
                {isOpen ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <div className="bg-muted/40 border-border border-y px-3 py-3">
                        <RaceClassification race={race} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
