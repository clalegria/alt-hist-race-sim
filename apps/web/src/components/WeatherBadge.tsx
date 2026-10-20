import { type RaceWeather, WEATHER_CONSTANTS } from "@alt-hist/engine";
import { cn, MONO_LINE } from "../lib/utils.js";

/**
 * How wet a race was, as a whole percentage.
 *
 * The engine's `wetness` is a 0-1 number saying how far the afternoon moved
 * toward being decided by the conditions rather than by the cars. A percentage
 * is the honest way to show that — it is not millimetres of rain — and rounding
 * to whole points matches every other number on the page, none of which claims
 * a precision the model does not have.
 */
export function wetnessPercent(weather: RaceWeather): number {
  return Math.round(weather.wetness * 100);
}

/** How wet a race was in a fan's words, lightest first. */
export const RAIN_WORDS = ["Damp", "Wet", "Heavy rain"] as const;

/**
 * The word for a wet race: the engine's wetness range cut into equal thirds,
 * read off its own constants so the words follow the range if it moves.
 */
export function rainWord(weather: RaceWeather): (typeof RAIN_WORDS)[number] {
  const { wetnessFloor, wetnessCeiling } = WEATHER_CONSTANTS;
  const share = (weather.wetness - wetnessFloor) / (wetnessCeiling - wetnessFloor);
  const step = Math.min(RAIN_WORDS.length - 1, Math.max(0, Math.floor(share * RAIN_WORDS.length)));
  return RAIN_WORDS[step] ?? RAIN_WORDS[0];
}

/**
 * A rain cloud, drawn rather than fetched.
 *
 * Inline SVG for the reason `Flag` is: an emoji ☔ renders as a different
 * picture on every platform and as a grey box on some, and an image from
 * elsewhere is a network dependency in an app that has none. `currentColor`
 * throughout, so it takes the colour of whatever it sits beside and works in
 * both themes without a second copy.
 *
 * Deliberately one icon rather than a scale of them. How wet the race was is
 * stated in a word next to it; a drizzle icon and a downpour icon would be two
 * ways of saying the same thing, and the reader would have to learn which was
 * which.
 *
 * **Two drops rather than three, at 16px and stroke 2.** It was drawn with three
 * finer ones at 14px and they merged into a smudge under the cloud at the size
 * it actually renders — compared side by side at real size, this is the version
 * that still reads as rain. The rule generalises: an icon this small has room
 * for a shape and a gesture, not for detail.
 */
export function RainIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block h-4 w-4 shrink-0 align-[-0.15em]", className)}
      role="img"
      aria-label={title ?? "Wet race"}
    >
      {title === undefined ? null : <title>{title}</title>}
      {/* The cloud, as one path: a flat base with three lobes over it. */}
      <path d="M6.5 14.5a3.6 3.6 0 0 1 .5-7.16 4.8 4.8 0 0 1 9.1 1.03 3.3 3.3 0 0 1-.6 6.13" />
      {/* Two falling drops, offset from each other so they read as rain. */}
      <path d="M9.5 17.5 8.5 20.2" />
      <path d="M14.5 17.5 13.5 20.2" />
    </svg>
  );
}

/**
 * The tag a wet round wears wherever it appears, the same on the race page and
 * in the calendar: the icon and how wet it was, in a word.
 *
 * **Renders nothing at all for a dry race.** Six rounds in seven are dry, and a
 * column reading "Dry" down the whole calendar is a column that says nothing —
 * the same argument the classification's status column already makes. What a
 * reader is scanning for is the round where the sky changed the result.
 *
 * **A word, not the percentage**: a bare "72%" beside a cloud reads as a chance
 * of rain, when the race is certainly wet. The percentage stays in the tooltip.
 *
 * *Blue*, because blue means rain. Not the primary, which this app spends on
 * "won the thing on screen" (`lib/highlight.ts`), and not red, which reads as a
 * warning rather than as weather. `--color-wet` is a hue outside the
 * warm-grey-and-teal palette, and it earns the exception by describing the
 * world rather than emphasising a result. Both tokens are per-theme and were
 * picked by measuring contrast — see the note in `index.css`.
 *
 * *Square*, like every other tag: the blue and the cloud already set it apart.
 *
 * It stays paired with the icon, never colour alone — the same rule the gain and
 * loss arrows follow.
 */
export function WeatherBadge({ weather, className }: { weather: RaceWeather; className?: string }) {
  if (!weather.wet) {
    return null;
  }
  const word = rainWord(weather);
  const label = `${word}, ${wetnessPercent(weather)}% wet: the wetter the track, the more it's down to the drivers rather than the cars`;
  return (
    <span
      className={cn(
        "bg-wet text-wet-foreground inline-flex items-center gap-1",
        // Tighter vertical padding than horizontal, so the tag stays the height
        // of the line it sits on rather than growing the row it is in.
        "px-2 py-0.5 whitespace-nowrap",
        // The weight is set rather than inherited, since the tag sits inside the
        // heavy race heading.
        MONO_LINE,
        "font-semibold",
        className,
      )}
      title={label}
    >
      <RainIcon title={label} />
      {word}
    </span>
  );
}
