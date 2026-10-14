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

/** A small label in mono capitals: an eyebrow, a fact's name, a panel's head band or foot. */
export const MONO_LABEL =
  "text-muted-foreground font-mono text-[11px] font-medium tracking-widest uppercase";

/** A name as a timing screen sets it: a surname, a team, a popover's title. */
export const TIMING_NAME = "narrow font-extrabold uppercase";
