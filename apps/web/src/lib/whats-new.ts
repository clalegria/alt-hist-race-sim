/**
 * What's new: one entry per release, newest first, read from `whats-new.json`.
 *
 * The file is the author's, edited by hand and committed with the work it
 * describes, so it is checked as it loads rather than trusted: a typo there
 * fails the test that loads it (`whats-new.test.ts`), not a reader's screen.
 */

import data from "./whats-new.json";

export interface Release {
  /** The day it went live, `YYYY-MM-DD`. */
  readonly date: string;
  /** What changed, in plain words, one line each. */
  readonly items: readonly string[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written `YYYY-MM-DD`: not `2026-02-30`. */
function isDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DAY.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().startsWith(value)
  );
}

/**
 * The entries, checked: each an object of exactly `date` and `items`, a real
 * day and at least one non-empty line, newest first, one per day (a second
 * release that day adds its lines to the day's entry). Throws naming the first
 * entry that is not.
 */
export function parseReleases(value: unknown): readonly Release[] {
  if (!Array.isArray(value)) {
    throw new Error("What's new must be a list of releases");
  }
  return value.map((entry: unknown, at): Release => {
    const where = `What's new, entry ${at + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`${where} is not an object`);
    }
    const keys = Object.keys(entry).sort();
    if (keys.join() !== "date,items") {
      throw new Error(`${where} must have exactly "date" and "items", not ${keys.join(", ")}`);
    }
    const { date, items } = entry as { date: unknown; items: unknown };
    if (!isDay(date)) {
      throw new Error(`${where}: "${String(date)}" is not a day written YYYY-MM-DD`);
    }
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !items.every((item) => typeof item === "string" && item.trim() !== "")
    ) {
      throw new Error(`${where}: "items" must be a list of at least one line of text`);
    }
    const before: unknown = value[at - 1];
    if (at > 0 && date >= (before as Release).date) {
      throw new Error(
        `${where} is not older than the one above it: one entry per day, newest first`,
      );
    }
    return { date, items };
  });
}

/** Every release, newest first. */
export const RELEASES: readonly Release[] = parseReleases(data);

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A release's day as a reader reads it: `1 November 2026`. */
export function releaseDate(date: string): string {
  return DATE_FORMAT.format(new Date(date));
}
