import { driversById, teamsById } from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { driverName, teamName } from "../lib/names.js";
import { ageInSeason } from "../lib/people.js";
import { carOverall, driverOverall } from "../lib/rating.js";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

const drivers = driversById();
const teams = teamsById();

const DRIVER_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "consistency", label: "Consistency" },
  { key: "composure", label: "Composure" },
  { key: "adaptability", label: "Adaptability" },
] as const;

const CAR_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "consistency", label: "Consistency" },
  { key: "reliability", label: "Reliability" },
] as const;

/** One rating as a labelled bar, so a 92 and a 44 differ at a glance. */
function Rating({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-24 shrink-0 text-xs",
          muted ? "text-muted-foreground/60" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <span
          className={cn(
            "block h-full rounded-full",
            muted ? "bg-muted-foreground/40" : "bg-primary",
          )}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </span>
      <span className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** The headline number, tinted by how good it is. */
function Overall({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "w-8 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
        value >= 85 && "bg-primary/15 text-primary",
        value >= 70 && value < 85 && "bg-muted text-foreground",
        value < 70 && "bg-muted/60 text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

/** The name button that opens an attribute panel. Same affordance for both. */
function NameTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <PopoverTrigger
      className={cn(
        "focus-visible:ring-ring -mx-1 cursor-pointer rounded px-1 text-left underline decoration-dotted decoration-from-font underline-offset-4 focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </PopoverTrigger>
  );
}

function DriverEntry({ entrant, seasonYear }: { entrant: RaceEntrant; seasonYear: number }) {
  const driver = drivers.get(entrant.driverId);
  const age = driver === undefined ? null : ageInSeason(seasonYear, driver.birthYear);

  return (
    <li className="flex items-center gap-2 text-sm">
      <Popover>
        <NameTrigger className="flex min-w-0 flex-1 items-center gap-1.5">
          {driver === undefined ? null : (
            <Flag country={driver.nationality} title={driver.nationality} />
          )}
          <span className="truncate">{driverName(entrant.driverId)}</span>
          {age === null ? null : (
            <span className="text-muted-foreground shrink-0 text-xs">({age}y)</span>
          )}
        </NameTrigger>
        <PopoverContent>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="font-semibold">{driverName(entrant.driverId)}</span>
            <span className="text-muted-foreground text-xs">
              {age === null ? "" : `${age} years old`}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {DRIVER_RATINGS.map((rating) => (
              <Rating
                key={rating.key}
                label={rating.label}
                value={entrant.driver[rating.key]}
                muted={rating.key === "adaptability"}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Overall value={driverOverall(entrant.driver)} />
    </li>
  );
}

interface TeamEntry {
  readonly teamId: string;
  readonly car: RaceEntrant["car"];
  readonly drivers: readonly RaceEntrant[];
}

/**
 * Regroups the flat field into teams, alphabetically.
 *
 * Alphabetical on purpose: ordering by car pace would give away the pecking
 * order before a wheel has turned, which is the one thing this page must not do.
 */
function byTeam(field: readonly RaceEntrant[]): readonly TeamEntry[] {
  const grouped = new Map<string, TeamEntry & { drivers: RaceEntrant[] }>();
  for (const entrant of field) {
    const existing = grouped.get(entrant.teamId);
    if (existing === undefined) {
      grouped.set(entrant.teamId, { teamId: entrant.teamId, car: entrant.car, drivers: [entrant] });
    } else {
      existing.drivers.push(entrant);
    }
  }
  return [...grouped.values()].sort((a, b) => teamName(a.teamId).localeCompare(teamName(b.teamId)));
}

export function SeasonGrid({
  field,
  seasonYear,
}: {
  field: readonly RaceEntrant[];
  seasonYear: number;
}) {
  const entries = byTeam(field);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Grid</h2>
        <p className="text-muted-foreground text-sm">
          {field.length} cars, {entries.length} teams. Select any name for its full ratings.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const team = teams.get(entry.teamId);
          return (
            <li key={entry.teamId} className="border-border bg-card rounded-xl border p-4">
              <div className="border-border/60 flex items-center gap-2 border-b pb-2">
                <Popover>
                  <NameTrigger className="flex flex-1 items-center gap-1.5 text-sm font-semibold">
                    {team === undefined ? null : <Flag country={team.base} title={team.base} />}
                    <span>{teamName(entry.teamId)}</span>
                  </NameTrigger>
                  <PopoverContent>
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{teamName(entry.teamId)}</span>
                      <span className="text-muted-foreground text-xs">
                        {team === undefined ? "" : `est. ${team.foundedYear}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {CAR_RATINGS.map((rating) => (
                        <Rating
                          key={rating.key}
                          label={rating.label}
                          value={entry.car[rating.key]}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Overall value={carOverall(entry.car)} />
              </div>

              <ul className="mt-2.5 flex flex-col gap-1.5">
                {entry.drivers.map((entrant) => (
                  <DriverEntry key={entrant.driverId} entrant={entrant} seasonYear={seasonYear} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
