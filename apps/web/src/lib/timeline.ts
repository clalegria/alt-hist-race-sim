/**
 * The run's timeline: the ordered beats a reader steps through, and where any
 * one of them sits relative to another.
 *
 * The whole year is simulated the moment a seed is drawn — one continuous RNG
 * stream through every round, which is what makes a season reproducible. The
 * cursor therefore *reveals* a season that already exists rather than driving
 * the simulation. Continue is a promise about what the reader sees next, not
 * about when the dice are rolled.
 *
 * ```
 * grid → qualifying 1 → race 1 → … → summary → (era) review → next year's grid
 * ```
 *
 * Each beat kind is one page (`run-places.ts`) and one line in the run bar
 * (`describeBeat`), so a new kind — a market event, a decision — is a row added
 * here rather than a screen redesigned. Pure, so all of it is tested without a
 * store or a DOM.
 */

/**
 * A beat the season screen draws: the grid, one session, or the summary.
 *
 * `round` is a zero-based index into `world.season.races`.
 */
export type View =
  | { readonly kind: "grid" }
  | { readonly kind: "qualifying"; readonly round: number }
  | { readonly kind: "race"; readonly round: number }
  | { readonly kind: "summary" };

/**
 * One step of a run. `review` is the era's roll of honour after a year has
 * been crowned; a one-year run never reaches it.
 */
export type Beat = View | { readonly kind: "review" };

/** A beat somewhere in the run: which year, and which beat of it. */
export interface Place {
  readonly year: number;
  readonly beat: Beat;
}

/**
 * The next beat within the same season — qualifying, then that race, then the
 * next qualifying, and the summary once the last race has been seen. The
 * summary is as far as one season goes; what follows it is the run's business
 * (`nextBeat`).
 */
export function advance(view: View, rounds: number): View {
  switch (view.kind) {
    case "grid":
      return rounds > 0 ? { kind: "qualifying", round: 0 } : { kind: "summary" };
    case "qualifying":
      return { kind: "race", round: view.round };
    case "race":
      return view.round + 1 < rounds
        ? { kind: "qualifying", round: view.round + 1 }
        : { kind: "summary" };
    case "summary":
      return view;
  }
}

/**
 * What Continue reveals after `beat`, or null where the run has nowhere further
 * to go: a one-year run's summary, or an era's review once the data runs out.
 *
 * After a review the answer is a grid — the *next year's*, which the store
 * builds on the way there.
 */
export function nextBeat(
  beat: Beat,
  rounds: number,
  inEra: boolean,
  hasNextYear: boolean,
): Beat | null {
  switch (beat.kind) {
    case "summary":
      return inEra ? { kind: "review" } : null;
    case "review":
      return hasNextYear ? { kind: "grid" } : null;
    default:
      return advance(beat, rounds);
  }
}

/**
 * Where a beat sorts within its year, as `[stage, step]`. Sessions interleave
 * by round, qualifying before its race. No round count is needed, so two
 * places compare without either season to hand.
 */
function rank(beat: Beat): readonly [number, number] {
  switch (beat.kind) {
    case "grid":
      return [0, 0];
    case "qualifying":
      return [1, 2 * beat.round];
    case "race":
      return [1, 2 * beat.round + 1];
    case "summary":
      return [2, 0];
    case "review":
      return [3, 0];
  }
}

/** Negative if `a` comes before `b` in the run, zero if they are the same beat. */
export function comparePlaces(a: Place, b: Place): number {
  const [aStage, aStep] = rank(a.beat);
  const [bStage, bStep] = rank(b.beat);
  return a.year - b.year || aStage - bStage || aStep - bStep;
}

/** Whether the reader has got as far as `place`: it is the cursor, or behind it. */
export function isReached(cursor: Place, place: Place): boolean {
  return comparePlaces(place, cursor) <= 0;
}

/** Where in the season a beat is, short enough for the run bar. */
export function describeBeat(beat: Beat, rounds: number): string {
  switch (beat.kind) {
    case "grid":
      return "Grid";
    case "qualifying":
      return `Round ${beat.round + 1}/${rounds} · Qualifying`;
    case "race":
      return `Round ${beat.round + 1}/${rounds} · Race`;
    case "summary":
      return "Season summary";
    case "review":
      return "Between seasons";
  }
}
