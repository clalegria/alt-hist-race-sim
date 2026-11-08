import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld } from "../test-support.js";
import { bugReportUrl, runDetails } from "./bug-report.js";

const FIELD = "entry.1105900486";

const season = (seed: number): Run => ({
  kind: "season",
  world: seededWorld(seed),
  cursor: { kind: "grid" } as Run["cursor"],
});

describe("the bug report link", () => {
  it("opens the bare form when there is no run", () => {
    const url = new URL(bugReportUrl(null));
    expect(url.hostname).toBe("docs.google.com");
    expect(url.searchParams.has(FIELD)).toBe(false);
  });

  it("writes the run into the form's run question, pre-filled", () => {
    const run = season(4242);
    const url = new URL(bugReportUrl(run));
    expect(url.searchParams.get("usp")).toBe("pp_url");
    expect(url.searchParams.get(FIELD)).toBe(runDetails(run));
  });

  it("names the seed, the year, the ability and the luck", () => {
    const { world } = season(4242);
    const details = runDetails(season(4242));
    expect(details).toContain(`Seed ${world.seed}`);
    expect(details).toContain(`season ${world.year}`);
    expect(details).toContain("Driver ability:");
    expect(details).toContain(`(${world.randomness})`);
  });

  it("names where an era started, and its first seed", () => {
    const first = seededWorld(7);
    const now = seededWorld(8, undefined, first.year + 1);
    const run: Run = {
      kind: "era",
      run: { startYear: first.year, seasons: [first] },
      world: now,
      cursor: { kind: "grid" } as Run["cursor"],
    };
    expect(runDetails(run)).toContain(`era from ${first.year}, first seed ${first.seed}`);
  });
});
