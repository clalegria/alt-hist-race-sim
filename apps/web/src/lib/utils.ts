import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, letting a later Tailwind class win over an earlier one of
 * the same kind. The shadcn/ui convention, and the reason a component can take a
 * `className` prop that actually overrides its defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/*
 * The five voices of `docs/style/timing-tower.md`, each spelled once. A call site
 * adds only its size and colour; a voice is tweaked here, never at a call site.
 */

/** Display capitals: a page, panel or dialog title, the Home hero, the title banner. */
export const DISPLAY_CAPS = "narrow font-extrabold tracking-[0.01em] uppercase";

/** Control capitals: a button, a nav link, a tab, a menu item. */
export const CONTROL_CAPS = "narrow font-bold tracking-wide uppercase";

/** A small label in mono capitals: an eyebrow, a fact's name, a column head, a panel's head band or foot. */
export const MONO_LABEL =
  "text-muted-foreground font-mono text-2xs font-medium tracking-widest uppercase";

/** A running line in mono capitals, a size up from a label: breadcrumbs, a heading's sub-line, a status. */
export const MONO_LINE = "font-mono text-xs tracking-wider uppercase";

/**
 * How a name with a panel behind it says so: nothing at rest, a soft fill under
 * the cursor or the keyboard focus, held while its panel is open. `bg-accent`
 * so the fill shows on top of a swapped-in row's own fill. Tests count this
 * whole string as the marker, so a call site never restates one of its classes.
 */
export const NAME_TARGET =
  "hover:bg-accent focus-visible:ring-ring data-[state=open]:bg-accent -mx-1 min-w-0 cursor-pointer rounded px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none";

/**
 * A small control's tap area, grown past what it draws by an invisible `::after`
 * layer: the usual web answer to a target smaller than a fingertip, which leaves
 * the look alone. A call site adds the `after:` insets, sized to stop short of
 * its neighbours, since where two layers overlap the later control takes the tap.
 */
export const HIT_AREA = "relative after:absolute";

/** A name as a timing screen sets it: a surname, a team, a popover's title. */
export const TIMING_NAME = "narrow font-extrabold uppercase";
