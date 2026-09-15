import type { RandomnessLevel } from "@alt-hist/engine";
import { RANDOMNESS_OPTIONS, randomnessLabel } from "./RandomnessSlider.js";

/**
 * The randomness level a season is being raced at, stated and not offered.
 *
 * The setting is chosen on the setup screen and fixed from then on, so what the
 * grid needs is a record rather than a control — the reader should be able to
 * see, without leaving the page, whether the season in front of them is a
 * realistic one or a wild one. It is also one of the facts a bug report has to
 * carry, alongside the seed and the ability mode, and a fact nobody can read
 * off the screen is a fact nobody will report.
 *
 * Read-only in both modes, and there is no version of this that changes it: see
 * the note on `RandomnessSlider`.
 */
export function RandomnessNote({ level }: { level: RandomnessLevel }) {
  const detail = RANDOMNESS_OPTIONS.find((option) => option.level === level)?.detail ?? "";

  return (
    <p className="text-muted-foreground text-xs">
      <span className="text-foreground font-medium">Randomness: {randomnessLabel(level)}</span>
      {detail === "" ? "" : ` — ${detail}`}
    </p>
  );
}
