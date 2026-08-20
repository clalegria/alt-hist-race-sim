import {
  AR,
  AT,
  AU,
  BE,
  BR,
  CA,
  CH,
  DE,
  FI,
  FR,
  GB,
  IE,
  IT,
  MC,
  MX,
  NL,
  NZ,
  SE,
  US,
  ZA,
} from "country-flag-icons/react/3x2";
import { cn } from "../lib/utils.js";

/**
 * A country flag as an inline SVG.
 *
 * Emoji flags were the obvious first choice and the wrong one: Windows ships no
 * country-flag glyphs, so every driver rendered as two grey letters. These are
 * real vectors.
 *
 * Imported one country at a time on purpose. `import * as Flags` reads far
 * better and costs 240 kB — the namespace defeats tree-shaking and drags in all
 * ~250 flags, when this sim needs twenty. The price is that a new country in the
 * seed data must be added here too, which `Flag.test.tsx` fails loudly about.
 *
 * An unknown code renders nothing rather than a placeholder: a missing flag is
 * quieter than a wrong one.
 */
const FLAGS: Readonly<Record<string, React.ComponentType<{ className?: string; title?: string }>>> =
  { AR, AT, AU, BE, BR, CA, CH, DE, FI, FR, GB, IE, IT, MC, MX, NL, NZ, SE, US, ZA };

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
        "border-border/60 inline-block h-3 w-[1.125rem] shrink-0 rounded-[2px] border align-[-0.1em]",
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
