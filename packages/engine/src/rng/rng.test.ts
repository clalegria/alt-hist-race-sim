import { describe, expect, it } from "vitest";
import { createRng, createRngFromSource, createRngFromState, deriveSeed } from "./index.js";
import type { Rng, RngSource } from "./types.js";

function draw(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

/** A stub source, to prove the helpers depend only on the interface. */
function sequenceSource(values: readonly number[]): RngSource {
  let index = 0;
  return {
    next(): number {
      const value = values[index % values.length];
      index += 1;
      return value ?? 0;
    },
    getState: () => [index],
  };
}

describe("reproducibility", () => {
  it("produces the same sequence for the same seed", () => {
    expect(draw(createRng(1980), 100)).toEqual(draw(createRng(1980), 100));
  });

  it("produces different sequences for different seeds", () => {
    expect(draw(createRng(1980), 50)).not.toEqual(draw(createRng(1981), 50));
  });

  it("keeps neighbouring seeds well separated", () => {
    // Without splitmix32 seeding, adjacent seeds would share early output.
    const first = draw(createRng(1), 10);
    const second = draw(createRng(2), 10);
    const overlap = first.filter((value) => second.includes(value));
    expect(overlap).toHaveLength(0);
  });

  it("makes helpers deterministic too, not just next()", () => {
    const a = createRng(7);
    const b = createRng(7);
    const order = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(a.shuffle(order)).toEqual(b.shuffle(order));
    expect(a.gaussian()).toBe(b.gaussian());
    expect(a.nextInt(0, 1000)).toBe(b.nextInt(0, 1000));
  });
});

describe("next", () => {
  it("stays within [0, 1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 100_000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads roughly evenly across the unit interval", () => {
    const rng = createRng(99);
    const buckets = new Array<number>(10).fill(0);
    const samples = 100_000;
    for (let i = 0; i < samples; i += 1) {
      const bucket = Math.floor(rng.next() * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(samples / 10 - 1000);
      expect(count).toBeLessThan(samples / 10 + 1000);
    }
  });
});

describe("nextInt", () => {
  it("includes the lower bound and excludes the upper", () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng.nextInt(3, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(7);
      seen.add(value);
    }
    // Every value in range is reachable; the excluded bound never appears.
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("handles a single-value range", () => {
    const rng = createRng(11);
    expect(rng.nextInt(4, 5)).toBe(4);
  });

  it("supports negative bounds", () => {
    const rng = createRng(12);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.nextInt(-5, 5);
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThan(5);
    }
  });

  it("rejects an empty or inverted range", () => {
    const rng = createRng(13);
    expect(() => rng.nextInt(5, 5)).toThrow(RangeError);
    expect(() => rng.nextInt(9, 2)).toThrow(RangeError);
  });

  it("rejects non-integer bounds", () => {
    const rng = createRng(14);
    expect(() => rng.nextInt(0, 2.5)).toThrow(/must be integers/);
  });
});

describe("pick", () => {
  it("always returns an element of the array", () => {
    const rng = createRng(21);
    const teams = ["williams", "ferrari", "brabham", "lotus"];
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      const chosen = rng.pick(teams);
      expect(teams).toContain(chosen);
      counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
    }
    // Every option comes up; nothing is unreachable.
    expect(counts.size).toBe(teams.length);
  });

  it("throws on an empty array", () => {
    expect(() => createRng(22).pick([])).toThrow(RangeError);
  });
});

describe("shuffle", () => {
  it("returns a valid permutation", () => {
    const rng = createRng(31);
    const input = Array.from({ length: 26 }, (_, i) => i);
    for (let run = 0; run < 200; run += 1) {
      const shuffled = rng.shuffle(input);
      expect(shuffled).toHaveLength(input.length);
      expect(new Set(shuffled).size).toBe(input.length);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
    }
  });

  it("does not mutate the input", () => {
    const rng = createRng(32);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const before = [...input];
    rng.shuffle(input);
    expect(input).toEqual(before);
  });

  it("actually reorders", () => {
    const rng = createRng(33);
    const input = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = rng.shuffle(input);
    expect(shuffled).not.toEqual(input);
  });

  it("handles empty and single-element arrays", () => {
    const rng = createRng(34);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle(["solo"])).toEqual(["solo"]);
  });

  it("is unbiased across every permutation of a small array", () => {
    const rng = createRng(35);
    const runs = 60_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i += 1) {
      const key = rng.shuffle([1, 2, 3]).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(counts.size).toBe(6);
    // The classic off-by-one Fisher-Yates (drawing from the whole array each
    // step instead of [0, i]) still reaches all six orderings, but skews their
    // frequencies — roughly 3.7% off uniform here. Counting catches it; merely
    // observing all six does not.
    const expected = runs / 6;
    for (const count of counts.values()) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.02);
    }
  });
});

describe("gaussian", () => {
  function summarize(values: readonly number[]): { mean: number; standardDeviation: number } {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    return { mean, standardDeviation: Math.sqrt(variance) };
  }

  it("matches the standard normal over a large sample", () => {
    const rng = createRng(1234);
    const samples = Array.from({ length: 200_000 }, () => rng.gaussian());
    const { mean, standardDeviation } = summarize(samples);
    expect(mean).toBeCloseTo(0, 2);
    expect(standardDeviation).toBeCloseTo(1, 2);
  });

  it("honours a requested mean and standard deviation", () => {
    const rng = createRng(4321);
    const samples = Array.from({ length: 200_000 }, () => rng.gaussian(70, 5));
    const { mean, standardDeviation } = summarize(samples);
    expect(mean).toBeGreaterThan(69.9);
    expect(mean).toBeLessThan(70.1);
    expect(standardDeviation).toBeGreaterThan(4.9);
    expect(standardDeviation).toBeLessThan(5.1);
  });

  it("is bell-shaped, not uniform", () => {
    const rng = createRng(555);
    const samples = Array.from({ length: 100_000 }, () => rng.gaussian());
    const withinOneSigma = samples.filter((value) => Math.abs(value) <= 1).length / samples.length;
    const withinTwoSigma = samples.filter((value) => Math.abs(value) <= 2).length / samples.length;
    expect(withinOneSigma).toBeGreaterThan(0.66);
    expect(withinOneSigma).toBeLessThan(0.7);
    expect(withinTwoSigma).toBeGreaterThan(0.94);
    expect(withinTwoSigma).toBeLessThan(0.96);
  });

  it("produces finite values even when the first draw is zero", () => {
    // log(0) would be -Infinity, so a zero draw must be resampled.
    const rng = createRngFromSource(sequenceSource([0, 0, 0.25, 0.5]));
    expect(Number.isFinite(rng.gaussian())).toBe(true);
  });
});

describe("state snapshots", () => {
  it("resumes an identical sequence from a snapshot", () => {
    const original = createRng(2024);
    draw(original, 37);
    const snapshot = original.getState();

    const resumed = createRngFromState(snapshot);
    expect(draw(resumed, 50)).toEqual(draw(original, 50));
  });

  it("survives a JSON round trip, as a save file would", () => {
    const original = createRng(2025);
    draw(original, 10);
    const restored = createRngFromState(JSON.parse(JSON.stringify(original.getState())));
    expect(draw(restored, 20)).toEqual(draw(original, 20));
  });

  it("returns plain numbers with no embedded functions", () => {
    const state = createRng(1).getState();
    expect(state.every((word) => typeof word === "number")).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("rejects a malformed snapshot", () => {
    expect(() => createRngFromState([1, 2])).toThrow(RangeError);
  });
});

describe("the interface seam", () => {
  it("gives a stubbed source the full helper set", () => {
    const rng = createRngFromSource(sequenceSource([0, 0.5, 0.999]));
    expect(rng.next()).toBe(0);
    expect(rng.nextInt(0, 10)).toBe(5);
    expect(rng.pick(["a", "b", "c"])).toBe("c");
  });
});

describe("deriveSeed", () => {
  it("gives the same seed for the same seed and key", () => {
    expect(deriveSeed(1980, "cars")).toBe(deriveSeed(1980, "cars"));
  });

  it("separates keys and seeds", () => {
    const seeds = [1, 2, 1980, 1981].flatMap((seed) =>
      ["cars", "market", "carz"].map((key) => deriveSeed(seed, key)),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("is a uint32", () => {
    for (const seed of [0, 1, -1, 999_999, 2 ** 40]) {
      const derived = deriveSeed(seed, "cars");
      expect(Number.isInteger(derived)).toBe(true);
      expect(derived).toBeGreaterThanOrEqual(0);
      expect(derived).toBeLessThan(2 ** 32);
    }
  });

  it("starts a stream apart from the seed's own", () => {
    const own = draw(createRng(1980), 10);
    const derived = draw(createRng(deriveSeed(1980, "cars")), 10);
    expect(derived.filter((value) => own.includes(value))).toHaveLength(0);
  });

  it("rejects a seed that is not finite", () => {
    expect(() => deriveSeed(Number.NaN, "cars")).toThrow(RangeError);
  });
});
