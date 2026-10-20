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
 *
 * **A flag names its country**, as the SVG's `<title>`: the hover tooltip and
 * the screen-reader name both say "United Kingdom", never the code "GB".
 */
const FLAGS: Readonly<Record<string, FlagIcon>> = Object.fromEntries(
  Object.entries(CountryFlags).filter(([code]) => /^[A-Z]{2}$/.test(code)),
) as Readonly<Record<string, FlagIcon>>;

/** The browser's own English country names, so no table of names is kept here. */
const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** "United Kingdom" for "GB": what a flag's tooltip and screen-reader name say. */
export function countryName(country: string): string {
  const code = country.trim().toUpperCase();
  return COUNTRY_NAMES.of(code) ?? code;
}

export function Flag({ country, className }: { country: string; className?: string }) {
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
      title={countryName(country)}
    />
  );
}

/** Whether a code will actually render. Used to guard the seed data in tests. */
export function hasFlag(country: string): boolean {
  return FLAGS[country.trim().toUpperCase()] !== undefined;
}
