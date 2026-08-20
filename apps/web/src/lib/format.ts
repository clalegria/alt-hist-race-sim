/**
 * Display helpers. Pure string formatting — no data access, no engine calls, so
 * they are trivially testable and shared by every table.
 */

import type { RaceGap } from "@alt-hist/engine";

/** "+5.234s", or "+1:17.230s" once a gap runs past the minute. */
export function formatSeconds(seconds: number): string {
  // Round to milliseconds before splitting, so 59.9999s reads as +1:00.000s
  // rather than +60.000s.
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const rest = (totalMs % 60000) / 1000;
  if (minutes === 0) {
    return `+${rest.toFixed(3)}s`;
  }
  return `+${minutes}:${rest.toFixed(3).padStart(6, "0")}s`;
}

/** A race gap: seconds as above, or "+2 laps" once a car is lapped. */
export function formatGap(gap: RaceGap): string {
  if (gap.kind === "laps") {
    return `+${gap.laps} lap${gap.laps === 1 ? "" : "s"}`;
  }
  return formatSeconds(gap.seconds);
}
