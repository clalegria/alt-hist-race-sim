import type { RaceEntrant } from "@alt-hist/engine";
import { Fragment } from "react";
import { driverName, teamName } from "../lib/names.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** Driver rating columns, in the order the race model weighs them. */
const DRIVER_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Quali" },
  { key: "consistency", label: "Consist" },
  { key: "composure", label: "Composure" },
  { key: "adaptability", label: "Adapt" },
] as const;

const CAR_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Quali" },
  { key: "consistency", label: "Consist" },
  { key: "reliability", label: "Reliability" },
] as const;

interface TeamEntry {
  readonly teamId: string;
  readonly car: RaceEntrant["car"];
  readonly drivers: readonly RaceEntrant[];
}

/**
 * Regroups the flat field into teams, strongest car first.
 *
 * The field is one row per car, which is what the race model wants; a grid page
 * wants the team as the unit, with its drivers underneath.
 */
function byTeam(field: readonly RaceEntrant[]): readonly TeamEntry[] {
  const teams = new Map<string, TeamEntry & { drivers: RaceEntrant[] }>();
  for (const entrant of field) {
    const existing = teams.get(entrant.teamId);
    if (existing === undefined) {
      teams.set(entrant.teamId, { teamId: entrant.teamId, car: entrant.car, drivers: [entrant] });
    } else {
      existing.drivers.push(entrant);
    }
  }
  return [...teams.values()].sort((a, b) => b.car.racing - a.car.racing);
}

export function SeasonGrid({ field }: { field: readonly RaceEntrant[] }) {
  const teams = byTeam(field);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grid</CardTitle>
        <CardDescription>
          {field.length} cars across {teams.length} teams, ordered by car pace. These are the exact
          ratings the season was simulated from — all on a 0–100 scale where higher is better.
          Consistency is a pace stat, not a variance one: a low rating simply makes a car slower in
          both sessions.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team / Driver</TableHead>
            {DRIVER_RATINGS.map((rating) => (
              <TableHead key={rating.key} className="text-right">
                {rating.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <Fragment key={team.teamId}>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableCell className="font-semibold">{teamName(team.teamId)}</TableCell>
                <TableCell colSpan={DRIVER_RATINGS.length} className="text-right">
                  <span className="text-muted-foreground text-xs">
                    Car —{" "}
                    {CAR_RATINGS.map((rating) => (
                      <span key={rating.key} className="ml-2 inline-block">
                        {rating.label}{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {team.car[rating.key]}
                        </span>
                      </span>
                    ))}
                  </span>
                </TableCell>
              </TableRow>
              {team.drivers.map((entrant) => (
                <TableRow key={entrant.driverId}>
                  <TableCell className="pl-6">{driverName(entrant.driverId)}</TableCell>
                  {DRIVER_RATINGS.map((rating) => (
                    <TableCell key={rating.key} className="text-right tabular-nums">
                      {entrant.driver[rating.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground border-border border-t px-5 py-3 text-xs">
        Adaptability is authored but not yet read by anything — it is reserved for the transfer
        market and progression. Every driver is shown at their career peak: no ageing curve exists
        yet, so a 24-year-old Prost races at the level he reached in 1987.
      </p>
    </Card>
  );
}
