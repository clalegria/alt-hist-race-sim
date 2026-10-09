import { parseRandomnessLevel, RANDOMNESS_LEVELS, type RandomnessLevel } from "@alt-hist/engine";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
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
 * It lives in the run settings dialog, in both modes, and changes only while
 * the run is untouched — on the setup screen, or from its first grid as
 * entered. The ability toggle stays changeable on an edited grid; randomness
 * answers "under what rules", a question about the run as a whole, and a level
 * re-picked once the run is under way would be a different run.
 */

interface Level {
  readonly level: RandomnessLevel;
  readonly label: string;
  readonly detail: string;
}

/**
 * The words on the slider.
 *
 * The opening stop is *marked* as the default rather than named "Default",
 * because what each stop is is a description of the racing, and which one the
 * screen opens on is a fact about the control. The marker reads
 * `STARTING_RANDOMNESS_LEVEL` rather than naming a level here, so moving that
 * offer is one line in `preferences.ts` and not a copy edit that can be
 * forgotten — which is exactly what happened the last time it moved.
 *
 * Every detail line describes the racing and nothing else. None of them is the
 * place to explain how the model was arrived at: a reader choosing a season
 * wants to know what it will feel like.
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
    detail: "The order holds, but a good day and a bad one can swap two cars over.",
  },
  {
    level: 3,
    label: "Exciting",
    detail: "More scatter. The order still holds, but less firmly.",
  },
  {
    level: 4,
    label: "Chaotic",
    detail: "Form swings from weekend to weekend, and a midfield car can win.",
  },
  {
    level: 5,
    label: "Lottery",
    detail: "Anyone can win anything. A title goes to whoever catches a wave.",
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
    // No card chrome of its own: it is one setting inside `RunSettingsGroup`, which
    // draws the panel and the rule between settings. It kept its own name in
    // the row below, though — the name belongs to the control that answers to
    // it, not to whatever happens to be wrapping it today.
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold tracking-tight">Luck on the day</span>
        <span className="text-muted-foreground text-xs">
          {active?.label}
          {active?.level === STARTING_RANDOMNESS_LEVEL ? " (default)" : ""}
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
          aria-label="Luck on the day"
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

      {/*
        Uncapped: `max-w-prose` is for a paragraph someone reads down, and this
        is a single sentence sitting in a panel several hundred pixels wider
        than 65ch. The cap did not aid reading here, it just left a stubby
        column with a hard edge two-thirds of the way across an otherwise
        full-width card, which read as a mistake because it looked like one.
      */}
      <p className="text-muted-foreground text-xs">{active?.detail}</p>
    </div>
  );
}
