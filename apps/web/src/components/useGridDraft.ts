import {
  applyChassis,
  applyDraft,
  applyEngineRatings,
  applyEngines,
  authoredChassis,
  authoredEngineRatings,
  authoredEngines,
  authoredLineup,
  availableEngines,
  buildField,
  type ChassisSpec,
  carryOverLineup,
  chassisChanges,
  type Driver,
  drivers,
  emptySeats,
  engineChanges,
  engineRatingChanges,
  exchangePicks,
  filledLineup,
  type GridPick,
  isAuthoredChassis,
  isAuthoredEngineRatings,
  isAuthoredEngines,
  isAuthoredLineup,
  type LineupDraft,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  type SeasonChassis,
  type SeasonEngineRatings,
  type SeasonEngines,
  type SeasonLineup,
  type SeasonSeed,
  seatRefOf,
  stepChassis,
  stepEngine,
} from "@alt-hist/data";
import type { EngineSpec, RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import { adjacentSeason, isPlayable, seasonSeed } from "../lib/seasons.js";
import { EMPTY_SEAT, type GridEditing } from "./SeasonGrid.js";

/**
 * The grid editor's state: what the reader has changed and not yet applied.
 *
 * Editing is a *draft*: changes accumulate in component state and change nothing
 * until Apply, which hands the finished grid to the store and re-runs the year.
 * That is deliberate — every applied grid re-simulates a whole season, and a
 * reader mid-way through moving four drivers around has not yet asked a question
 * worth answering.
 *
 * Four things can be changed, and they are kept as four drafts because they
 * are four questions: **who drives the car**, **what is in the back of it**,
 * **how good the chassis is** and **how good each engine is**. They apply
 * together, as one edit, so a reader who did them all gets one season rather
 * than four. The engine ratings are per engine, not per team: a step moves
 * every team running that engine.
 *
 * The constraint the driver half is built around is that **only swaps exist**.
 * A team fields the number of cars it entered, so taking a seat always means
 * giving one up, and the field stays the size the starting limit was set
 * against. `swapDrivers` in `@alt-hist/data` enforces it; nothing here can
 * express an addition. Engines have the mirror constraint for free: a car has
 * exactly one, so fitting a new one always removes the old one.
 */

/** Every part of an edit, applied together because they are one question. */
export interface GridEdit {
  readonly lineup: SeasonLineup | null;
  readonly engines: SeasonEngines | null;
  readonly chassis: SeasonChassis | null;
  readonly engineRatings: SeasonEngineRatings | null;
}

/** Whether two picks name the same thing. */
function samePick(a: GridPick, b: GridPick): boolean {
  if (a.kind === "driver" && b.kind === "driver") {
    return a.driverId === b.driverId;
  }
  if (a.kind === "seat" && b.kind === "seat") {
    return a.teamId === b.teamId && a.seat === b.seat;
  }
  return false;
}

/** Whether a pick has a seat to write back to — a reserve driver does not. */
function holdsASeat(lineup: LineupDraft, pick: GridPick): boolean {
  return pick.kind === "seat" || seatRefOf(lineup, pick.driverId) !== null;
}

/**
 * What selecting a driver — or an open seat — does, given what is already
 * picked up.
 *
 * Pure, and exported, because it is the whole of the editing interaction and
 * the only part of it a DOM-less test can reach. Four cases:
 *
 * - nothing held: pick this up;
 * - the same thing again: put it down, unchanged;
 * - two picks with no seat between them — two drivers out of the pool — have
 *   nothing to exchange, so the second simply becomes the selection rather than
 *   doing nothing visible;
 * - otherwise: exchange them, and start again with nothing held.
 *
 * The seat cases fall out of the same four. A driver held and an open seat
 * chosen moves them into it, leaving their old car empty if they had one; an
 * open seat held and a name chosen fills it.
 */
export function pickUp(
  lineup: LineupDraft,
  selected: GridPick | null,
  pick: GridPick,
): { readonly lineup: LineupDraft; readonly selected: GridPick | null } {
  if (selected !== null && samePick(selected, pick)) {
    return { lineup, selected: null };
  }
  if (selected === null) {
    return { lineup, selected: pick };
  }
  if (!holdsASeat(lineup, selected) && !holdsASeat(lineup, pick)) {
    return { lineup, selected: pick };
  }
  return { lineup: exchangePicks(lineup, selected, pick), selected: null };
}

/**
 * The draft grid as a field the page can draw, open seats included.
 *
 * `buildField` cannot make an entrant without a driver, and an all-but-empty
 * team would otherwise vanish from the page the reader has to fill it in on. So
 * the season is built without its open seats and they are spliced back in as
 * placeholder entrants — the team's own chassis and engine, nobody driving —
 * which is what lets every layer above this stay a plain function of a field.
 *
 * Nothing simulated can reach one: this field is drawn and thrown away, and the
 * draft behind it cannot be applied while an open seat remains.
 */
export function previewField(
  season: SeasonSeed,
  draft: LineupDraft,
  ratingMode: RatingMode,
  pool: readonly Driver[] = drivers,
): readonly RaceEntrant[] {
  const built = buildField(applyDraft(season, draft), pool, ratingMode);
  const seated = new Map<string, RaceEntrant[]>();
  for (const entrant of built) {
    const already = seated.get(entrant.teamId);
    if (already === undefined) {
      seated.set(entrant.teamId, [entrant]);
    } else {
      already.push(entrant);
    }
  }

  const field: RaceEntrant[] = [];
  for (const entry of season.entries) {
    const taken = seated.get(entry.teamId) ?? [];
    const engine = season.engines.find((spec) => spec.engineId === entry.engineId);
    let next = 0;
    for (const driverId of draft[entry.teamId] ?? entry.drivers) {
      if (driverId === null) {
        field.push({
          driverId: EMPTY_SEAT,
          teamId: entry.teamId,
          driver: {
            racing: 0,
            qualifying: 0,
            consistency: 0,
            adaptability: 0,
            composure: 0,
            wetWeather: 0,
          },
          chassis: entry.chassis,
          engineId: entry.engineId,
          ...(engine === undefined
            ? {}
            : {
                engine: {
                  racing: engine.racing,
                  qualifying: engine.qualifying,
                  reliability: engine.reliability,
                },
              }),
        });
        continue;
      }
      const entrant = taken[next];
      next += 1;
      if (entrant !== undefined) {
        field.push(entrant);
      }
    }
  }
  return field;
}

/**
 * The editor's drafts, what they draw, and every action on them.
 *
 * `season` is the year as the run entered it — what Restore puts back and every
 * change is measured from; `lineup`, `engines`, `chassis` and `engineRatings`
 * are what is applied over it, null for as entered.
 */
export function useGridDraft({
  season,
  field,
  year,
  ratingMode,
  lineup,
  engines,
  chassis,
  engineRatings,
  previousLineup,
  pool,
  onApply,
  onEditingChange,
}: {
  season: SeasonSeed;
  field: readonly RaceEntrant[];
  year: number;
  ratingMode: RatingMode;
  lineup: SeasonLineup | null;
  engines: SeasonEngines | null;
  chassis: SeasonChassis | null;
  engineRatings: SeasonEngineRatings | null;
  previousLineup: SeasonLineup | null;
  pool: readonly Driver[];
  onApply: ((edit: GridEdit) => void) | undefined;
  onEditingChange: ((editing: boolean) => void) | undefined;
}) {
  const applied = useMemo(() => lineup ?? authoredLineup(season), [lineup, season]);
  const appliedEngines = useMemo(() => engines ?? authoredEngines(season), [engines, season]);
  const appliedChassis = useMemo(() => chassis ?? authoredChassis(season), [chassis, season]);
  const appliedRatings = useMemo(
    () => engineRatings ?? authoredEngineRatings(season),
    [engineRatings, season],
  );
  const engineIds = useMemo(
    () => availableEngines(season).map((engine) => engine.engineId),
    [season],
  );

  // Null means "not editing": one flag fewer than a draft plus a boolean, and
  // it cannot get into the state where the editor is open with nothing to edit.
  // The four drafts open and close together, so one null answers for all.
  const [draft, setDraft] = useState<LineupDraft | null>(null);
  const [engineDraft, setEngineDraft] = useState<SeasonEngines | null>(null);
  const [chassisDraft, setChassisDraft] = useState<SeasonChassis | null>(null);
  const [ratingsDraft, setRatingsDraft] = useState<SeasonEngineRatings | null>(null);
  const [selected, setSelected] = useState<GridPick | null>(null);

  const shown = draft ?? applied;
  const shownEngines = engineDraft ?? appliedEngines;
  const shownChassis = chassisDraft ?? appliedChassis;
  const shownRatings = ratingsDraft ?? appliedRatings;
  const changes = useMemo(() => lineupChanges(season, shown), [season, shown]);
  const supplyChanges = useMemo(() => engineChanges(season, shownEngines), [season, shownEngines]);
  const rerated = useMemo(() => chassisChanges(season, shownChassis), [season, shownChassis]);
  const reratedEngines = useMemo(
    () => engineRatingChanges(season, shownRatings),
    [season, shownRatings],
  );
  const untouched =
    (draft === null || isAuthoredLineup(season, draft)) &&
    (engineDraft === null || isAuthoredEngines(season, engineDraft)) &&
    (chassisDraft === null || isAuthoredChassis(season, chassisDraft)) &&
    (ratingsDraft === null || isAuthoredEngineRatings(season, ratingsDraft));

  // Draft grids are rebuilt rather than raced: the ratings are the same
  // function of driver, car, season and mode that `createWorld` will apply,
  // so what is on screen is what the season will be run on. The drafted cars
  // go in first: a team handed a better unit or a better tub is a better car,
  // and the grid ranks it as one. In `createWorld`'s order: the supply, then
  // the engines' ratings, so a team handed a re-rated engine races it as rated.
  const preview = useMemo(() => {
    if (draft === null && engineDraft === null && chassisDraft === null && ratingsDraft === null) {
      return field;
    }
    const resupplied = engineDraft === null ? season : applyEngines(season, engineDraft);
    const rated = ratingsDraft === null ? resupplied : applyEngineRatings(resupplied, ratingsDraft);
    const entered = chassisDraft === null ? rated : applyChassis(rated, chassisDraft);
    return previewField(entered, draft ?? applied, ratingMode, pool);
  }, [draft, engineDraft, chassisDraft, ratingsDraft, field, season, applied, ratingMode, pool]);
  const reserve = useMemo(() => reserveDrivers(shown, pool), [shown, pool]);
  /** The open seats, and therefore whether this grid can be applied at all. */
  const open = useMemo(() => emptySeats(shown), [shown]);

  /**
   * The season to copy from: the playable year before this one, or null at the
   * start of the authored range, where the button is not drawn.
   *
   * The *playable* one rather than `year - 1`, so a gap in the seed data is
   * skipped rather than offering a year `seasonSeed` would throw on.
   */
  const previous = useMemo(() => {
    const before = adjacentSeason(year, -1);
    return before === null || !isPlayable(before) ? null : seasonSeed(before);
  }, [year]);

  const start = (): void => {
    setDraft(applied);
    setEngineDraft(appliedEngines);
    setChassisDraft(appliedChassis);
    setRatingsDraft(appliedRatings);
    setSelected(null);
    onEditingChange?.(true);
  };

  const stop = (): void => {
    setDraft(null);
    setEngineDraft(null);
    setChassisDraft(null);
    setRatingsDraft(null);
    setSelected(null);
    onEditingChange?.(false);
  };

  const select = (pick: GridPick): void => {
    if (draft === null) {
      return;
    }
    const next = pickUp(draft, selected, pick);
    setDraft(next.lineup);
    setSelected(next.selected);
  };

  /**
   * Last season's drivers, over this one.
   *
   * Over the *draft* rather than the applied grid, so it composes with whatever
   * the reader has already changed rather than throwing it away — and so the
   * button can be pressed twice without meaning something different the second
   * time. Whatever is held is put down first: a selection pointing at a seat
   * the copy has just refilled no longer means anything.
   */
  const copyPrevious = (): void => {
    if (draft === null || previous === null) {
      return;
    }
    setDraft(carryOverLineup(season, previous, draft, { previousLineup, mode: ratingMode, pool }));
    setSelected(null);
  };

  const restore = (): void => {
    setDraft(authoredLineup(season));
    setEngineDraft(authoredEngines(season));
    setChassisDraft(authoredChassis(season));
    setRatingsDraft(authoredEngineRatings(season));
    setSelected(null);
  };

  /** Hands the drafts to the store, each part null when it matches the season. */
  const apply = (): void => {
    const filled = draft === null ? null : filledLineup(draft);
    if (filled === null) {
      return;
    }
    onApply?.({
      lineup: isAuthoredLineup(season, filled) ? null : filled,
      engines: engineDraft === null || isAuthoredEngines(season, engineDraft) ? null : engineDraft,
      chassis:
        chassisDraft === null || isAuthoredChassis(season, chassisDraft) ? null : chassisDraft,
      engineRatings:
        ratingsDraft === null || isAuthoredEngineRatings(season, ratingsDraft)
          ? null
          : ratingsDraft,
    });
    stop();
  };

  const chooseEngine = (teamId: string, engineId: string): void => {
    setEngineDraft((current) => (current === null ? current : { ...current, [teamId]: engineId }));
  };

  /** One team's chassis a point better or worse — one rating, or all four. */
  const stepTeamChassis = (teamId: string, step: 1 | -1, key?: keyof ChassisSpec): void => {
    setChassisDraft((current) =>
      current === null ? current : stepChassis(current, teamId, step, key),
    );
  };

  /**
   * One engine a point better or worse — one rating, or all three — for every
   * team running it.
   */
  const stepEngineRatings = (engineId: string, step: 1 | -1, key?: keyof EngineSpec): void => {
    setRatingsDraft((current) =>
      current === null ? current : stepEngine(current, engineId, step, key),
    );
  };

  /** What `SeasonGrid` needs to draw the editor, or undefined while it is shut. */
  const edit: GridEditing | undefined =
    draft === null
      ? undefined
      : {
          selected,
          onSelect: select,
          engineIds,
          onEngineChange: chooseEngine,
          onChassisStep: stepTeamChassis,
          onEngineStep: stepEngineRatings,
        };

  return {
    edit,
    preview,
    changes,
    supplyChanges,
    rerated,
    reratedEngines,
    untouched,
    reserve,
    open,
    selected,
    previous,
    start,
    stop,
    select,
    copyPrevious,
    restore,
    apply,
  };
}
