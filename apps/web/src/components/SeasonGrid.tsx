import type { EngineChange, SeatChange } from "@alt-hist/data";
import { driversById, teamsById } from "@alt-hist/data";
import type { EngineSpec, RaceEntrant } from "@alt-hist/engine";
import { driverName, engineName, entryName, teamName } from "../lib/names.js";
import { ageInSeason } from "../lib/people.js";
import { carOverall, driverOverall } from "../lib/rating.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";
import { GridChanges } from "./LineupChanges.js";
import { SortToggle } from "./SortToggle.js";
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

/**
 * An engine has three, not four: consistency belongs to the chassis, so the
 * chassis panel lists one rating the engine panel underneath it does not.
 */
const ENGINE_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "reliability", label: "Reliability" },
] as const;

/**
 * Editing mode: which driver has been picked up, what happens when one is
 * chosen, and which engines a team may be given.
 *
 * Controlled, with the draft living in `GridStage` above — so this component
 * stays a pure function of what it is handed, and every state the editor can be
 * in renders on its own without a DOM.
 */
export interface GridEditing {
  readonly selectedDriverId: string | null;
  readonly onSelect: (driverId: string) => void;
  /** Every engine the season rates, in the order it offers them. */
  readonly engineIds: readonly string[];
  readonly onEngineChange: (teamId: string, engineId: string) => void;
}

/** The soft fill marking a driver — or an engine — that is not where history put it. */
export const SWAPPED_IN = "bg-muted/70";

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
export function Overall({ value }: { value: number }) {
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

/**
 * Flag, name and age, laid out identically whether the row opens a popover or
 * picks the driver up — so the grid does not reflow on entering edit mode.
 */
export function DriverLabel({ driverId, seasonYear }: { driverId: string; seasonYear: number }) {
  const driver = drivers.get(driverId);
  const age = driver === undefined ? null : ageInSeason(seasonYear, driver.birthYear);

  return (
    <>
      {driver === undefined ? null : (
        <Flag country={driver.nationality} title={driver.nationality} />
      )}
      <span className="truncate">{driverName(driverId)}</span>
      {age === null ? null : (
        <span className="text-muted-foreground shrink-0 text-xs">({age}y)</span>
      )}
    </>
  );
}

function DriverEntry({
  entrant,
  seasonYear,
  edit,
  swappedIn,
}: {
  entrant: RaceEntrant;
  seasonYear: number;
  edit?: GridEditing;
  swappedIn: boolean;
}) {
  const driver = drivers.get(entrant.driverId);
  const age = driver === undefined ? null : ageInSeason(seasonYear, driver.birthYear);
  const selected = edit?.selectedDriverId === entrant.driverId;

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded px-1 py-0.5 text-sm",
        swappedIn && SWAPPED_IN,
        selected && "ring-primary ring-2",
      )}
    >
      {edit === undefined ? (
        <Popover>
          <NameTrigger className="flex min-w-0 flex-1 items-center gap-1.5">
            <DriverLabel driverId={entrant.driverId} seasonYear={seasonYear} />
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
      ) : (
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => {
            edit.onSelect(entrant.driverId);
          }}
          className="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <DriverLabel driverId={entrant.driverId} seasonYear={seasonYear} />
        </button>
      )}
      <Overall value={driverOverall(entrant.driver)} />
    </li>
  );
}

/**
 * The supplier picker, on every team card while the editor is open.
 *
 * A native `select` rather than a styled listbox: the choice is a plain one-of-N
 * from a short list, the platform control is keyboard- and screen-reader-correct
 * for free, and it is the only control in the editor whose rendered state —
 * which option carries `selected` — a DOM-less test can read back.
 */
function EnginePicker({
  teamId,
  engineId,
  edit,
}: {
  teamId: string;
  engineId: string | undefined;
  edit: GridEditing;
}) {
  return (
    <label className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">Engine</span>
      <select
        value={engineId ?? ""}
        onChange={(event) => {
          edit.onEngineChange(teamId, event.target.value);
        }}
        className="border-border bg-background focus-visible:ring-ring min-w-0 flex-1 cursor-pointer rounded border px-1.5 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {edit.engineIds.map((id) => (
          <option key={id} value={id}>
            {engineName(id)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TeamEntry {
  readonly teamId: string;
  readonly car: RaceEntrant["car"];
  /** The unit in the back of it, as the field was built. */
  readonly engine: EngineSpec | undefined;
  readonly engineId: string | undefined;
  readonly drivers: readonly RaceEntrant[];
}

/**
 * Regroups the flat field into teams, in the order the reader asked for.
 *
 * Alphabetical by default, and on purpose: ordering by car pace gives away the
 * pecking order before a wheel has turned, which is not something the opening
 * page should do unasked. Sorted on the *team* name rather than the entry name,
 * so a team does not move down the page because it changed engine supplier.
 *
 * By rating it is the same overall the card shows — `carOverall`, engine
 * included — so the list agrees with the numbers down its right-hand edge.
 *
 * The car and the engine come off the first entrant of each team, which is where
 * this whole page gets them: it reads the field it is handed and never the seed
 * files, so it can be shown a draft grid the world has never run.
 */
export function byTeam(
  field: readonly RaceEntrant[],
  order: SortOrder = DEFAULT_SORT_ORDER,
): readonly TeamEntry[] {
  const grouped = new Map<string, TeamEntry & { drivers: RaceEntrant[] }>();
  for (const entrant of field) {
    const existing = grouped.get(entrant.teamId);
    if (existing === undefined) {
      grouped.set(entrant.teamId, {
        teamId: entrant.teamId,
        car: entrant.car,
        engine: entrant.engine,
        engineId: entrant.engineId,
        drivers: [entrant],
      });
    } else {
      existing.drivers.push(entrant);
    }
  }
  return sortBy(
    [...grouped.values()],
    order,
    (entry) => teamName(entry.teamId),
    (entry) => carOverall(entry.car, entry.engine),
  );
}

export function SeasonGrid({
  field,
  seasonYear,
  changes,
  engineChanges,
  action,
  edit,
  sort = DEFAULT_SORT_ORDER,
  onSortChange,
}: {
  field: readonly RaceEntrant[];
  seasonYear: number;
  /** Differences from the authored grid, if any. Drives the note and the marks. */
  changes?: readonly SeatChange[];
  /** Teams running an engine the season did not give them. */
  engineChanges?: readonly EngineChange[];
  /** Buttons for the section header — Edit grid, or Apply and Cancel. */
  action?: React.ReactNode;
  /** Present while the reader is rearranging the grid. */
  edit?: GridEditing;
  /**
   * How the team cards are ordered. Controlled, and held by whoever renders
   * this — so every order the grid can be in renders without a click.
   */
  sort?: SortOrder;
  /** Absent in tests, where nothing is clicked. The switch still renders. */
  onSortChange?: (order: SortOrder) => void;
}) {
  const entries = byTeam(field, sort);
  const edited = changes ?? [];
  const resupplied = engineChanges ?? [];
  // Everyone who is not where the season put them, so the grid shows its own
  // changes rather than making the reader match names against a list.
  const swappedIn = new Set(edited.flatMap((change) => change.in));
  const movedEngine = new Set(resupplied.map((change) => change.teamId));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Grid</h2>
          <p className="text-muted-foreground text-sm">
            {edit === undefined
              ? `${field.length} cars, ${entries.length} teams. Select any name for its full ratings.`
              : "Select a driver, then whoever takes the seat — teams keep the number of cars they entered, so every change is a swap. Each team can be given any engine the season ran."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SortToggle
            label="Sort teams"
            name="team-sort"
            order={sort}
            {...(onSortChange === undefined ? {} : { onChange: onSortChange })}
          />
          {action === undefined ? null : <div className="flex flex-wrap gap-2">{action}</div>}
        </div>
      </div>

      {edited.length === 0 && resupplied.length === 0 ? null : (
        <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border border-dashed px-3 py-2">
          <span className="text-xs font-semibold tracking-tight">
            {edit === undefined ? "This grid was edited" : "Changes so far"}
          </span>
          <GridChanges changes={edited} engineChanges={resupplied} />
        </div>
      )}

      <ul
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          // Three across normally, two while the reserve list holds the third
          // column, so the cards are not squeezed by a sidebar beside them.
          edit === undefined && "lg:grid-cols-3",
        )}
      >
        {entries.map((entry) => {
          const team = teams.get(entry.teamId);
          const name = entryName(entry.teamId, entry.engineId);
          return (
            <li key={entry.teamId} className="border-border bg-card rounded-xl border p-4">
              <div
                className={cn(
                  "border-border/60 flex items-center gap-2 border-b pb-2",
                  // The same soft fill a moved driver carries, for the same
                  // reason: the note at the top and the cards should agree
                  // without the reader matching names between them.
                  movedEngine.has(entry.teamId) && cn(SWAPPED_IN, "-mx-1 rounded px-1"),
                )}
              >
                <Popover>
                  <NameTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold">
                    {team === undefined ? null : <Flag country={team.base} title={team.base} />}
                    <span className="truncate">{name}</span>
                  </NameTrigger>
                  <PopoverContent>
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{name}</span>
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
                    {entry.engine === undefined || entry.engineId === undefined ? null : (
                      // The chassis above and the engine below it, separately,
                      // because the headline number is already the two blended
                      // and a reader who opens this wants the parts.
                      <>
                        <div className="border-border/60 mt-3 mb-2 flex items-baseline justify-between gap-2 border-t pt-3">
                          <span className="text-xs font-semibold">
                            {engineName(entry.engineId)} engine
                          </span>
                          <span className="text-muted-foreground text-xs">{seasonYear} spec</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {ENGINE_RATINGS.map((rating) => (
                            <Rating
                              key={rating.key}
                              label={rating.label}
                              value={entry.engine?.[rating.key] ?? 0}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
                <Overall value={carOverall(entry.car, entry.engine)} />
              </div>

              {edit === undefined ? null : (
                <EnginePicker teamId={entry.teamId} engineId={entry.engineId} edit={edit} />
              )}

              <ul className="mt-2.5 flex flex-col gap-1.5">
                {entry.drivers.map((entrant) => (
                  <DriverEntry
                    key={entrant.driverId}
                    entrant={entrant}
                    seasonYear={seasonYear}
                    swappedIn={swappedIn.has(entrant.driverId)}
                    {...(edit === undefined ? {} : { edit })}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
