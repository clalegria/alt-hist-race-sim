import * as CountryFlags from "country-flag-icons/react/3x2";
import { cn } from "../lib/utils.js";

type FlagIcon = React.ComponentType<{ className?: string; title?: string }>;

/**
 * A country flag as an inline SVG.
 *
 * Emoji flags were the obvious first choice and the wrong one: Windows ships no
 * country-flag glyphs, so every driver rendered as two grey letters. These are
 * real vectors.
 *
 * Every flag in the package is imported, not a hand-kept subset. The subset was
 * ~240 kB cheaper, but it made a new country in the seed data — a nationality, a
 * team base, a round on a newly authored calendar — an edit to this file, which
 * is exactly the kind of manual step that goes missing. The whole set is a few
 * hundred kB of static SVG paths; correctness by construction is worth it.
 *
 * An unknown code renders nothing rather than a placeholder: a missing flag is
 * quieter than a wrong one.
 */
const FLAGS: Readonly<Record<string, FlagIcon>> = Object.fromEntries(
  Object.entries(CountryFlags).filter(([code]) => /^[A-Z]{2}$/.test(code)),
) as Readonly<Record<string, FlagIcon>>;

export function Flag({
  country,
  title,
  className,
}: {
  country: string;
  title?: string;
  className?: string;
}) {
  const Icon = FLAGS[country.trim().toUpperCase()];
  if (Icon === undefined) {
    return null;
  }
  return (
    <Icon
      className={cn(
        "border-badge-line inline-block h-3 w-[1.125rem] shrink-0 rounded-[2px] border align-[-0.1em]",
        className,
      )}
      {...(title === undefined ? {} : { title })}
    />
  );
}

/** Whether a code will actually render. Used to guard the seed data in tests. */
export function hasFlag(country: string): boolean {
  return FLAGS[country.trim().toUpperCase()] !== undefined;
}
