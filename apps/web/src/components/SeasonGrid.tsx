import type {
  ChassisChange,
  EngineChange,
  EngineRatingChange,
  GridArrangement,
  RatingMode,
  SeasonChassis,
  SeasonEngineRatings,
  SeatChange,
  TrendChange,
} from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { useMemo } from "react";
import { count } from "../lib/format.js";
import type { KeptNotes } from "../lib/kept.js";
import { liveryFor } from "../lib/livery.js";
import { entryName, teamCountry, teamName } from "../lib/names.js";
import { carOverall, carRacing } from "../lib/rating.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { cn } from "../lib/utils.js";
import { EntryNames, useNameYear } from "./EntryNames.js";
import { ArrangementNote, GridChanges, KeptNote, keptSentences } from "./LineupChanges.js";
import { useLiveryYear } from "./Liveries.js";
import { SortToggle } from "./SortToggle.js";
import { type GridEditing, TeamCard, type TeamEntry } from "./TeamCard.js";
import { Button } from "./ui/button.js";
import { Card, CardBand } from "./ui/card.js";
import { Notice } from "./ui/notice.js";

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
 * The chassis and the engine come off the first entrant of each team, which is
 * where this whole page gets them: it reads the field it is handed and never the
 * seed files, so it can be shown a draft grid the world has never run.
 */
export function byTeam(
  field: readonly RaceEntrant[],
  order: SortOrder = DEFAULT_SORT_ORDER,
  // Alphabetical order is over the names the cards show *that season* — the
  // lineage sorted under T as Toleman and sorts under A as Alpine, unless the
  // run keeps each team's first name.
  nameOf: (teamId: string) => string = teamName,
): readonly TeamEntry[] {
  const grouped = new Map<string, TeamEntry & { drivers: RaceEntrant[] }>();
  for (const entrant of field) {
    const existing = grouped.get(entrant.teamId);
    if (existing === undefined) {
      grouped.set(entrant.teamId, {
        teamId: entrant.teamId,
        chassis: entrant.chassis,
        engine: entrant.engine,
        engineId: entrant.engineId,
        developmentTrend: entrant.developmentTrend,
        drivers: [entrant],
      });
    } else {
      existing.drivers.push(entrant);
    }
  }
  return sortBy(
    [...grouped.values()],
    order,
    (entry) => nameOf(entry.teamId),
    (entry) => carOverall(entry.chassis, entry.engine),
    (entry) => carRacing(entry.chassis, entry.engine),
  );
}

export function SeasonGrid({
  field,
  seasonYear,
  ratingMode,
  changes,
  engineChanges,
  chassisChanges,
  engineRatingChanges,
  trendChanges,
  historicalChassis = null,
  historicalEngines = null,
  arrangement = null,
  kept = null,
  openSeats = 0,
  action,
  edit,
  onClearEdits,
  sort = DEFAULT_SORT_ORDER,
  onSortChange,
}: {
  field: readonly RaceEntrant[];
  seasonYear: number;
  /**
   * Which ratings the field was built from. Only the ages read it: the numbers
   * arrive already resolved on the entrants, but a driver's age does not, and
   * the age has to describe the same season the ratings do.
   */
  ratingMode: RatingMode;
  /** Differences from the authored grid, if any. Drives the note and the marks. */
  changes?: readonly SeatChange[];
  /** Teams running an engine the season did not give them. */
  engineChanges?: readonly EngineChange[];
  /** Teams whose chassis the reader re-rated. */
  chassisChanges?: readonly ChassisChange[];
  /** Engines the reader re-rated: every team running one is marked. */
  engineRatingChanges?: readonly EngineRatingChange[];
  /** Teams whose in-season development the reader changed. */
  trendChanges?: readonly TrendChange[];
  /**
   * Each team's chassis as history had it, when the run's own differ — *Car
   * performance* rolled them — or null. The team popover then reads history →
   * this run, rating by rating.
   */
  historicalChassis?: SeasonChassis | null;
  /**
   * Each engine as history rated it, when *Engine performance* rolled the
   * run's own (`historicalEngineRatings`), or null. The engine panel then reads
   * history → this run, as the chassis does.
   */
  historicalEngines?: SeasonEngineRatings | null;
  /**
   * The rule the run's settings reseat the grid by, or null for none.
   *
   * Its own notice, above the edited-grid one (`ArrangementNote`): it is a
   * setting, not an edit, and clearing the edits keeps it. Beside it, the edits'
   * link reads Clear manual edits, so it never promises to undo the rule.
   */
  arrangement?: GridArrangement | null;
  /**
   * What *Teams: The first season's teams* did to this year (`keptNotes`), or null. Its
   * own muted notice, not the edited-grid one: a kept seat is the year's
   * starting point, not a change the reader made.
   */
  kept?: KeptNotes | null;
  /**
   * How many cars nobody is in. Only ever above zero mid-edit — an applied grid
   * has none — and it is what the notice at the top of the grid counts.
   */
  openSeats?: number;
  /** Buttons for the section header — Edit grid, or Apply and Cancel. */
  action?: React.ReactNode;
  /** Present while the reader is rearranging the grid. */
  edit?: GridEditing;
  /**
   * Puts the grid back as the season entered it, from a link in the edited
   * grid's notice. Only while the editor is shut, and only where the grid can
   * still change: absent on a raced grid and on the summary's copy.
   */
  onClearEdits?: () => void;
  /**
   * How the team cards are ordered. Controlled, and held by whoever renders
   * this — so every order the grid can be in renders without a click.
   */
  sort?: SortOrder;
  /** Absent in tests, where nothing is clicked. The switch still renders. */
  onSortChange?: (order: SortOrder) => void;
}) {
  // The year each team's name and flag, and its colours, are read at; the
  // car's shape stays on the season itself.
  const nameYear = useNameYear();
  const liveryYear = useLiveryYear();
  const entries = useMemo(
    () => byTeam(field, sort, (teamId) => teamName(teamId, nameYear(teamId, seasonYear))),
    [field, sort, nameYear, seasonYear],
  );
  // The props default to a fresh `[]` each render, so these key on the props.
  const edited = useMemo(() => changes ?? [], [changes]);
  const resupplied = useMemo(() => engineChanges ?? [], [engineChanges]);
  const rerated = useMemo(
    () => new Map((chassisChanges ?? []).map((change) => [change.teamId, change])),
    [chassisChanges],
  );
  // Everyone who is not where the season put them, so the grid shows its own
  // changes rather than making the reader match names against a list.
  const swappedIn = useMemo(() => new Set(edited.flatMap((change) => change.in)), [edited]);
  const movedEngine = useMemo(
    () => new Set(resupplied.map((change) => change.teamId)),
    [resupplied],
  );
  const reratedEngines = useMemo(
    () => new Map((engineRatingChanges ?? []).map((change) => [change.engineId, change])),
    [engineRatingChanges],
  );
  const retrended = useMemo(
    () => new Map((trendChanges ?? []).map((change) => [change.teamId, change])),
    [trendChanges],
  );
  const nameOf = (teamId: string) => teamName(teamId, nameYear(teamId, seasonYear));
  // Whether a setting's own note is on screen above the edits: a reseat, or a
  // kept grid that changed something (`KeptNote` draws nothing otherwise).
  const automatic =
    arrangement !== null || (kept !== null && keptSentences(kept, seasonYear, nameOf).length > 0);

  return (
    // A `Card`, like every results panel, rather than the bare section this was:
    // the grid is the same kind of thing as a classification — one titled block
    // of the season — and the background texture made the difference obvious,
    // since a transparent panel let the checkerboard run straight through it.
    // The team tiles inside stay `bg-card` on a `bg-card` panel, drawn by their
    // borders and liveries; the qualifying grid already nests exactly that way.
    <Card>
      <CardBand title="Grid" label={`${field.length} cars · ${entries.length} teams`}>
        <SortToggle
          label="Sort teams"
          name="team-sort"
          order={sort}
          {...(onSortChange === undefined ? {} : { onChange: onSortChange })}
        />
        {action === undefined ? null : <div className="flex flex-wrap gap-2">{action}</div>}
      </CardBand>

      <div className="flex flex-col gap-4 px-3 py-4 sm:px-5">
        <p className="text-muted-foreground text-sm">
          {edit === undefined
            ? "Pick any name for its full ratings."
            : "Pick a driver, then who takes their seat. Pick a team's name to change its engine or make its car faster or slower."}
        </p>
        {openSeats === 0 ? null : (
          // Above the change list rather than beside the Apply button, because
          // it is an instruction about the cards below it: the seats to fill
          // are marked on the grid, and this says how many are left.
          <Notice tone="accent" title={count(openSeats, "empty seat")}>
            <p className="text-muted-foreground text-xs">
              Fill {openSeats === 1 ? "it" : "them"} before you apply the grid: pick the seat, then
              a driver.
            </p>
          </Notice>
        )}
        {kept === null ? null : <KeptNote notes={kept} seasonYear={seasonYear} nameOf={nameOf} />}
        {arrangement === null ? null : (
          <ArrangementNote arrangement={arrangement} ratingMode={ratingMode} />
        )}
        {edited.length === 0 &&
        resupplied.length === 0 &&
        rerated.size === 0 &&
        reratedEngines.size === 0 &&
        retrended.size === 0 ? null : (
          <Notice
            className="gap-2"
            title={edit === undefined ? "This grid was edited" : "Changes so far"}
            action={
              edit === undefined && onClearEdits !== undefined ? (
                <Button variant="link" size="inline" className="-my-0.5" onClick={onClearEdits}>
                  {/* Beside a grid the settings also arranged, "all" would
                      promise to undo that too, which clearing never does. */}
                  {automatic ? "Clear manual edits" : "Clear all edits"}
                </Button>
              ) : undefined
            }
          >
            {/* The entry names of this grid's own field, which a draft may have
                resupplied, never those of the world around it. */}
            <EntryNames field={field}>
              <GridChanges
                changes={edited}
                engineChanges={resupplied}
                chassisChanges={[...rerated.values()]}
                engineRatingChanges={[...reratedEngines.values()]}
                trendChanges={[...retrended.values()]}
              />
            </EntryNames>
          </Notice>
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
            const engineChange =
              entry.engineId === undefined ? undefined : reratedEngines.get(entry.engineId);
            const chassisChange = rerated.get(entry.teamId);
            const trendChange = retrended.get(entry.teamId);
            return (
              <TeamCard
                key={entry.teamId}
                entry={entry}
                name={entryName(entry.teamId, entry.engineId, nameYear(entry.teamId, seasonYear))}
                base={teamCountry(entry.teamId, nameYear(entry.teamId, seasonYear))}
                livery={liveryFor(entry.teamId, liveryYear(entry.teamId, seasonYear))}
                seasonYear={seasonYear}
                ratingMode={ratingMode}
                chassisChange={chassisChange}
                historical={historicalChassis?.[entry.teamId]}
                historicalEngine={
                  entry.engineId === undefined ? undefined : historicalEngines?.[entry.engineId]
                }
                engineChange={engineChange}
                trendChange={trendChange}
                ghostCar={kept?.ghosts[entry.teamId]}
                // Everyone else on this engine, whom a step on it moves too.
                sharing={entries
                  .filter(
                    (other) => other.teamId !== entry.teamId && other.engineId === entry.engineId,
                  )
                  .map((other) => teamName(other.teamId, nameYear(other.teamId, seasonYear)))
                  .sort((a, b) => a.localeCompare(b))}
                marked={
                  movedEngine.has(entry.teamId) ||
                  chassisChange !== undefined ||
                  engineChange !== undefined ||
                  trendChange !== undefined
                }
                swappedIn={swappedIn}
                kept={kept}
                {...(edit === undefined ? {} : { edit })}
              />
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
