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
