import { parseRandomnessLevel, RANDOMNESS_LEVELS, type RandomnessLevel } from "@alt-hist/engine";
import { cn } from "../lib/utils.js";

/**
 * How much the dice decide, chosen before anything is simulated.
 *
 * A slider rather than a row of buttons because the five stops are one ordered
 * axis, and the ordering is the thing worth saying: "more exciting" is only
 * obviously more than "exciting" when it sits further along a line. A native
 * `input[type=range]` gets arrow-key and Home/End navigation, the announcement
 * of position out of five, and a value a DOM-less test can read back — none of
 * which a set of divs would have without being rebuilt by hand.
 *
 * It lives on the setup screens and nowhere else, in both modes. That is a
 * deliberate asymmetry with the ability toggle, which a standalone season can
 * still change from its grid: ability answers "who is racing", and seeing the
 * grid is exactly when a reader might want the other answer. Randomness answers
 * "under what rules", which is a question about the run as a whole, and a level
 * re-picked once the season is under way would be a different run.
 */

interface Level {
  readonly level: RandomnessLevel;
  readonly label: string;
  readonly detail: string;
}

/**
 * The words on the slider.
 *
 * Level 2 is marked as the default rather than named "Default", because what it
 * *is* is the calibrated model — the one the season was measured against — and
 * every other stop is a departure from it in one direction or the other.
 */
export const RANDOMNESS_OPTIONS: readonly Level[] = [
  {
    level: 1,
    label: "Realistic",
    detail: "The quick cars win. Upsets happen, but they take a real slice of luck.",
  },
  {
    level: 2,
    label: "Balanced",
    detail: "The calibrated model: the season as it was measured against real history.",
  },
  {
    level: 3,
    label: "Exciting",
    detail: "A little more scatter. The order is still the order, but it holds less firmly.",
  },
  {
    level: 4,
    label: "More exciting",
    detail: "Form swings weekend to weekend, and a midfield car can find a race in it.",
  },
  {
    level: 5,
    label: "Chaotic",
    detail: "Anyone can win anything. A championship becomes a story about who caught a wave.",
  },
];

/** The words for a level — exported so the read-only display reads the same. */
export function randomnessLabel(level: RandomnessLevel): string {
  return (
    RANDOMNESS_OPTIONS.find((option) => option.level === level)?.label ??
    RANDOMNESS_OPTIONS[1]?.label ??
    ""
  );
}

export function RandomnessSlider({
  level,
  onChange,
}: {
  level: RandomnessLevel;
  /** Absent in tests, where nothing is dragged. The slider still renders. */
  onChange?: (level: RandomnessLevel) => void;
}) {
  const active =
    RANDOMNESS_OPTIONS.find((option) => option.level === level) ?? RANDOMNESS_OPTIONS[1];
  const first = RANDOMNESS_LEVELS[0] ?? 1;
  const last = RANDOMNESS_LEVELS.at(-1) ?? 5;
  /** Gaps between stops, which is what a position is a fraction of. */
  const steps = Math.max(RANDOMNESS_OPTIONS.length - 1, 1);

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold tracking-tight">Randomness</span>
        <span className="text-muted-foreground text-xs">
          {active?.label}
          {active?.level === 2 ? " (default)" : ""}
        </span>
      </div>

      {/*
        The track is inset by half a thumb on each side, because that is where a
        range input's *thumb centre* actually travels: at the minimum the handle
        sits flush with the left edge, so its centre is half a thumb in. The
        labels are positioned against this same inset box, which is what makes
        each one sit under the position it names — spacing them evenly across
        the full width, as a plain flex row does, leaves every label but the
        middle one off its mark, by half a thumb at the ends.

        9px is half of a native thumb, which browsers draw at roughly 16-20px
        and none of them expose to CSS. The input is pulled back out of the
        padding so the track still spans the card; only the labels sit inside
        it. The height is left tall enough for the thumb not to be clipped —
        a track thinner than the handle is a control that looks broken.
      */}
      <div className="px-[9px]">
        <input
          type="range"
          min={first}
          max={last}
          step={1}
          value={level}
          aria-label="Randomness"
          // The number on its own says nothing; the word is what was chosen.
          aria-valuetext={active?.label ?? ""}
          onChange={(event) => {
            onChange?.(parseRandomnessLevel(Number(event.target.value)));
          }}
          className="accent-primary focus-visible:ring-ring -mx-[9px] h-5 w-[calc(100%+18px)] cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
        />

        {/* Labelled ticks, hidden from screen readers: `aria-valuetext` already
            says which one is selected, and the other four are decoration to
            anyone who cannot see where the handle sits.

            Each label is centred on its own stop and given a fixed narrow box,
            so a long one wraps onto a second line instead of growing sideways
            into its neighbour on a phone. The row is as tall as two lines for
            that reason: the copy underneath should not jump when the wrapping
            changes. */}
        <div aria-hidden="true" className="relative mt-2 h-7 text-[0.65rem] leading-tight">
          {RANDOMNESS_OPTIONS.map((option, index) => (
            <span
              key={option.level}
              style={{ left: `${(index / steps) * 100}%` }}
              className={cn(
                "absolute top-0 w-14 -translate-x-1/2 text-center transition sm:w-16",
                option.level === level ? "text-foreground font-medium" : "text-subtle",
              )}
            >
              <span className="bg-border mx-auto mb-1 block h-1 w-px" />
              {option.label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground max-w-prose text-xs">{active?.detail}</p>
    </div>
  );
}
