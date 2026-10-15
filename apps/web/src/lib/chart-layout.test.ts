/**
 * The chart's label and tick arithmetic, on synthetic positions.
 *
 * Nothing here comes from the seed data: the rules are that no two labels touch,
 * that none leaves the plot, that order survives, and that an axis reads round.
 */

import { describe, expect, it } from "vitest";
import { niceTicks, spreadLabels } from "./chart-layout.js";

const SPACE = { top: 0, bottom: 300, gap: 11 };

/** The distances between neighbouring labels once sorted top to bottom. */
function gaps(placed: readonly number[]): number[] {
  const sorted = [...placed].sort((a, b) => a - b);
  return sorted.slice(1).map((y, index) => y - (sorted[index] ?? 0));
}

describe("spreadLabels", () => {
  it("leaves labels that already clear each other where their lines end", () => {
    expect(spreadLabels([20, 100, 250], SPACE)).toEqual([20, 100, 250]);
  });

  it("holds labels a point apart a full line-height apart", () => {
    // Two lines a pixel apart is the case the old tie-only rule missed.
    const placed = spreadLabels([100, 101], SPACE);
    expect(Math.min(...gaps(placed))).toBeGreaterThanOrEqual(SPACE.gap - 1e-9);
  });

  it("moves a crowd up as well as down, staying near where it wanted to be", () => {
    // Centred on the middle: the stack spreads both ways rather than all downward.
    const placed = spreadLabels([150, 150, 150], SPACE);
    expect(Math.min(...placed)).toBeLessThan(150);
    expect(Math.max(...placed)).toBeGreaterThan(150);
    expect(Math.min(...gaps(placed))).toBeGreaterThanOrEqual(SPACE.gap - 1e-9);
  });

  it("keeps a crowd at the bottom inside the plot", () => {
    const placed = spreadLabels([300, 300, 299, 298], SPACE);
    expect(Math.max(...placed)).toBeLessThanOrEqual(SPACE.bottom);
    expect(Math.min(...gaps(placed))).toBeGreaterThanOrEqual(SPACE.gap - 1e-9);
  });

  it("keeps a crowd at the top inside the plot", () => {
    const placed = spreadLabels([0, 1, 0, 2], SPACE);
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(SPACE.top);
    expect(Math.min(...gaps(placed))).toBeGreaterThanOrEqual(SPACE.gap - 1e-9);
  });

  it("pulls a label that would end outside the plot back in", () => {
    expect(spreadLabels([-40], SPACE)).toEqual([SPACE.top]);
    expect(spreadLabels([400], SPACE)).toEqual([SPACE.bottom]);
  });

  it("keeps lines in order, a tie reading downward by position", () => {
    const wanted = [90, 100, 100, 96, 100, 40];
    const placed = spreadLabels(wanted, SPACE);
    // Sorted by where they wanted to be, then by position, the labels come out
    // strictly top to bottom.
    const byWish = wanted
      .map((_, index) => index)
      .sort((a, b) => (wanted[a] ?? 0) - (wanted[b] ?? 0) || a - b);
    const down = byWish.map((index) => placed[index] ?? 0);
    expect(down).toEqual([...down].sort((a, b) => a - b));
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("squeezes evenly, inside the plot, when there is no room for a full gap", () => {
    const tight = { top: 10, bottom: 40, gap: 11 };
    const placed = spreadLabels([20, 20, 20, 20, 20], tight);
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(tight.top);
    expect(Math.max(...placed)).toBeLessThanOrEqual(tight.bottom);
    const between = gaps(placed);
    expect(Math.min(...between)).toBeGreaterThan(0);
    expect(Math.max(...between) - Math.min(...between)).toBeLessThan(1e-9);
  });

  it("handles no labels and one label", () => {
    expect(spreadLabels([], SPACE)).toEqual([]);
    expect(spreadLabels([123], SPACE)).toEqual([123]);
  });
});

describe("niceTicks", () => {
  it("rounds an awkward range to a round step", () => {
    const ticks = niceTicks(135, 5);
    const step = ticks[1] ?? 0;
    expect([1, 2, 5].includes(step / 10 ** Math.floor(Math.log10(step)))).toBe(true);
    expect(ticks.every((tick, index) => tick === index * step)).toBe(true);
  });

  it("starts at zero and ends on a multiple of the step that covers the maximum", () => {
    for (const max of [1, 7, 24, 45, 99, 100, 135, 301, 1234]) {
      const ticks = niceTicks(max, 5);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      // No gap wasted at the top: one step less would not cover the maximum.
      const step = ticks[1] ?? 1;
      expect((ticks.at(-1) ?? 0) - step).toBeLessThan(max);
    }
  });

  it("uses no more steps than asked for", () => {
    for (const max of [3, 12, 135, 1234]) {
      expect(niceTicks(max, 5).length - 1).toBeLessThanOrEqual(5);
    }
  });

  it("never steps by less than a whole point", () => {
    expect(niceTicks(3, 10)).toEqual([0, 1, 2, 3]);
  });

  it("still draws an axis for an empty range", () => {
    expect(niceTicks(0, 5)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN, 5)).toEqual([0, 1]);
  });
});
