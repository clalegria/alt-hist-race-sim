import { season1980 } from "@alt-hist/data";
import type { SeasonResult } from "@alt-hist/engine";
import { driverNameOrDash, teamName } from "../lib/names.js";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Season</CardTitle>
        <CardDescription>
          {season.races.length} rounds. Every circuit runs the same race — the calendar is cosmetic.
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
            return (
              <TableRow key={round?.round ?? index}>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">{round?.name ?? `Round ${index + 1}`}</span>
                    {round === undefined ? null : (
                      <span className="text-muted-foreground text-xs">{round.circuit}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DriverCell driverId={race.poleDriverId} teamFor={teamFor} />
                </TableCell>
                <TableCell>
                  <DriverCell driverId={race.winnerDriverId} teamFor={teamFor} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
