/**
 * The arithmetic behind a chart's furniture: where its end-of-line labels sit and
 * where its axis ticks fall.
 *
 * Plain functions over numbers, in their own module, for the reason
 * `lib/evolution.ts` is: Recharts renders nothing without a DOM, and a layout rule
 * that can only be seen in a browser is a rule nobody tests. `StandingsEvolution`
 * does the pixel lookups and hands the results here.
 */

/**
 * The step sizes a y axis may use, before scaling by a power of ten: 1, 2 and 5
 * (so 10, 20, 50, 100, 200, 500…). The ticks that follow read as 0/50/100/150
 * rather than 0/45/90/135, which is what a reader's eye expects of a count.
 */
export const NICE_STEPS = [1, 2, 5];

/**
 * An axis from zero up in round steps, ending on a multiple of the step that
 * covers `max`.
 *
 * Takes the smallest nice step that fits the range into `intervals` gaps or
 * fewer. Never smaller than 1: these are points, and the axis shows no decimals.
 * A `max` of zero or less still gets a one-step axis, so there is something to
 * draw against.
 */
export function niceTicks(highest: number, intervals: number): number[] {
  const max = Number.isFinite(highest) ? Math.max(highest, 0) : 0;
  const wanted = max / Math.max(intervals, 1);
  let step = 1;
  // Some candidate always fits before `power` outgrows the target.
  for (let power = 1; power < wanted * 10; power *= 10) {
    const found = NICE_STEPS.map((base) => base * power).find((candidate) => candidate >= wanted);
    if (found !== undefined) {
      step = found;
      break;
    }
  }
  const count = Math.max(Math.ceil(max / step), 1);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** The vertical room labels may use, and how far apart two of them must sit. */
export interface LabelSpace {
  /** The highest a label's centre may go. */
  readonly top: number;
  /** The lowest a label's centre may go. */
  readonly bottom: number;
  /** The least distance between two centres: one label's height. */
  readonly gap: number;
}

/** A run of neighbouring labels that have been pushed into one stack. */
interface Stack {
  /** The first label of the stack, in sorted order. */
  readonly first: number;
  readonly size: number;
  /** Sum over members of (wanted y − its place in the stack × gap). */
  readonly sum: number;
  /** Where the stack's first label sits. */
  readonly start: number;
}

/**
 * Where each label's centre goes, given where its line ends.
 *
 * Every label ends at least `gap` from its neighbours, **in both directions** —
 * the earlier rule nudged only exact ties, and only downward — and inside
 * `top..bottom`, so none is clipped at either end. Each label stays as near its
 * own line as that allows: labels that collide are merged into a stack, centred on
 * where its members wanted to be, and a stack that would leave the space is pushed
 * back in (which can make it collide with its neighbour, and merge again).
 *
 * Order is kept: labels are sorted top to bottom by `wanted`, ties broken by index
 * (the championship position, so level lines still read downward), and the result
 * comes back in the order given. If the space is too short for every label at a
 * full `gap`, the gap shrinks evenly until they fit — squeezed, but never out.
 */
export function spreadLabels(wanted: readonly number[], space: LabelSpace): number[] {
  const order = wanted
    .map((_, index) => index)
    .sort((a, b) => (wanted[a] ?? 0) - (wanted[b] ?? 0) || a - b);
  const count = order.length;
  const room = space.bottom - space.top;
  const gap = count > 1 ? Math.min(space.gap, Math.max(room, 0) / (count - 1)) : space.gap;

  const settle = (first: number, size: number, sum: number): Stack => {
    const centred = sum / size;
    const start = Math.min(Math.max(centred, space.top), space.bottom - (size - 1) * gap);
    return { first, size, sum, start };
  };

  const stacks: Stack[] = [];
  order.forEach((index, place) => {
    let current = settle(place, 1, wanted[index] ?? 0);
    for (let last = stacks.at(-1); last !== undefined; last = stacks.at(-1)) {
      if (last.start + last.size * gap <= current.start) {
        break;
      }
      stacks.pop();
      // The newcomer's members sit `last.size` places further down the stack.
      const sum = last.sum + current.sum - last.size * current.size * gap;
      current = settle(last.first, last.size + current.size, sum);
    }
    stacks.push(current);
  });

  const placed: number[] = Array.from({ length: count }, () => space.top);
  for (const stack of stacks) {
    for (let offset = 0; offset < stack.size; offset += 1) {
      const index = order[stack.first + offset];
      if (index !== undefined) {
        placed[index] = stack.start + offset * gap;
      }
    }
  }
  return placed;
}
