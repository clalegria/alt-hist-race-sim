/**
 * The control that opens a row into its own panel.
 *
 * Three tables use it — the championship standings, the season calendar and the
 * era's roll of honour — and each had its own copy of the same markup, down to
 * the class string. One definition, so the affordance cannot end up meaning
 * three slightly different things.
 *
 * **The name is the control**, not a separate chevron beside it: one action does
 * not deserve two tab stops, and the name is what the reader is aiming at. The
 * chevron is a text glyph rather than an SVG because the display tests count one
 * flag per row by counting `<svg>`, and it rotates instead of swapping character
 * so nothing reflows when a row opens.
 *
 * `aria-expanded` is the whole of the accessibility contract here, and it is
 * also what the DOM-less tests read a row's state back out of.
 */

import { cn } from "../lib/utils.js";

export function DisclosureButton({
  open,
  onToggle,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "focus-visible:ring-ring -mx-1 flex cursor-pointer items-center gap-2 rounded px-1 text-left focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "text-muted-foreground inline-block text-xs transition-transform",
          open && "rotate-90",
        )}
      >
        ▶
      </span>
      {children}
    </button>
  );
}
