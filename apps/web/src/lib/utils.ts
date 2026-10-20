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

/** A name as a timing screen sets it: a surname, a team, a popover's title. */
export const TIMING_NAME = "narrow font-extrabold uppercase";
