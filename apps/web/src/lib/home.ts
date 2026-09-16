/**
 * How a home race is worded.
 *
 * Which allegiances are at home is the **engine's** question — `homeAllegiances`
 * decides it on the same entrant record the race was scored on, so the star on a
 * classification marks exactly the entries that collected the bonus, and there
 * is no second spelling of "is this driver at home" to drift. What lives here is
 * only the sentence that describes it.
 *
 * Kept out of the component so the wording is testable without rendering
 * anything, in the way `format.ts` and `names.ts` already are.
 */

import type { HomeAllegiances } from "@alt-hist/engine";

/** What each allegiance is called in the label, in the order they are listed. */
const NOUNS: readonly (readonly [keyof HomeAllegiances, string])[] = [
  ["driver", "the driver"],
  ["team", "the team"],
  ["engine", "the engine manufacturer"],
];

/** "a, b and c" — an Oxford-comma-free list, which is how a sentence reads it. */
function listed(parts: readonly string[]): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * What the star says when the reader hovers it, or null for an entry with
 * nothing to say — which is how a component knows to draw no star at all.
 *
 * Phrased as "home race for X" rather than "X is racing at home" on purpose:
 * one, two or three subjects all fit the same sentence, so there is no verb to
 * make agree and no three separate strings to keep in step.
 */
export function homeAdvantageLabel(allegiances: HomeAllegiances): string | null {
  const at = NOUNS.filter(([key]) => allegiances[key]).map(([, noun]) => noun);
  if (at.length === 0) {
    return null;
  }
  return `Home race for ${listed(at)} — worth a small bonus in qualifying and the race.`;
}
