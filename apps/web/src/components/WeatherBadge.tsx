import type { RaceWeather } from "@alt-hist/engine";
import { cn } from "../lib/utils.js";

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
 * stated in words next to it; a drizzle icon and a downpour icon would be two
 * ways of saying the same thing, and the reader would have to learn which was
 * which.
 */
export function RainIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]", className)}
      role="img"
      aria-label={title ?? "Wet race"}
    >
      {title === undefined ? null : <title>{title}</title>}
      {/* The cloud, as one path: a flat base with three lobes over it. */}
      <path d="M6.5 14.5a3.6 3.6 0 0 1 .5-7.16 4.8 4.8 0 0 1 9.1 1.03 3.3 3.3 0 0 1-.6 6.13" />
      {/* Three falling drops, staggered, so the icon reads as rain at 14px. */}
      <path d="M8.5 17.5 7.5 20" />
      <path d="M12 17.5 11 20" />
      <path d="M15.5 17.5 14.5 20" />
    </svg>
  );
}

/**
 * The label a wet round wears wherever it appears: the icon, the word, and how
 * wet it was.
 *
 * **Renders nothing at all for a dry race.** Six rounds in seven are dry, and a
 * column reading "Dry" down the whole calendar is a column that says nothing —
 * the same argument the classification's status column already makes. What a
 * reader is scanning for is the round where the sky changed the result.
 *
 * `compact` drops the word and keeps the icon and the number, for a table cell
 * where the round's name is already using the width.
 */
export function WeatherBadge({
  weather,
  compact = false,
  className,
}: {
  weather: RaceWeather;
  compact?: boolean;
  className?: string;
}) {
  if (!weather.wet) {
    return null;
  }
  const percent = wetnessPercent(weather);
  const label = `Wet race — ${percent}% wet`;
  return (
    <span
      className={cn(
        "text-primary inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        className,
      )}
      title={label}
    >
      <RainIcon title={label} />
      {compact ? null : "Wet"}
      <span className="tabular-nums">{percent}%</span>
    </span>
  );
}
