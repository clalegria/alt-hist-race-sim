import { season1980 } from "@alt-hist/data";
import type { SeasonResult } from "@alt-hist/engine";
import { Fragment, useState } from "react";
import { driverNameOrDash, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { RaceClassification } from "./RaceClassification.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** A driver's name with their team beneath it, as every table shows them. */
function DriverCell({
  driverId,
  teamFor,
}: {
  driverId: string | null;
  teamFor: ReadonlyMap<string, string>;
}) {
  const teamId = driverId === null ? undefined : teamFor.get(driverId);
  return (
    <div className="flex flex-col leading-tight">
      <span>{driverNameOrDash(driverId)}</span>
      {teamId === undefined ? null : (
        <span className="text-muted-foreground text-xs">{teamName(teamId)}</span>
      )}
    </div>
  );
}

export function SeasonCalendar({
  season,
  teamFor,
}: {
  season: SeasonResult;
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
          {season.races.length} rounds. Select a race for its full classification. Every circuit
          runs the same race — the calendar is cosmetic.
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
            const round = season1980.calendar[index];
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
                        <span className="font-medium">{round?.name ?? `Round ${index + 1}`}</span>
                        {round === undefined ? null : (
                          <span className="text-muted-foreground text-xs">{round.circuit}</span>
                        )}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <DriverCell driverId={race.poleDriverId} teamFor={teamFor} />
                  </TableCell>
                  <TableCell>
                    <DriverCell driverId={race.winnerDriverId} teamFor={teamFor} />
                  </TableCell>
                </TableRow>
                {isOpen ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <RaceClassification race={race} />
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
