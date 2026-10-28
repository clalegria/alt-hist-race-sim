/**
 * The control that opens a row into its own panel.
 *
 * Every row that opens draws it, inside an `ExpandableRow`: one definition, so
 * the affordance cannot end up meaning slightly different things per table.
 *
 * **The name is the control**, not a separate chevron beside it: one action does
 * not deserve two tab stops, and the name is what the reader is aiming at. The
 * chevron is a text glyph rather than an SVG because the display tests count one
 * flag per row by counting `<svg>`, and it rotates instead of swapping character
 * so nothing reflows when a row opens.
 *
 * `aria-expanded` is the whole of the accessibility contract here, and it is
 * also what the DOM-less tests read a row's state back out of.
 *
 * **The chevron can stand alone**, and wherever the row's text is a driver's or
 * a team's name it has to: a name opens its career panel, and a name cannot be
 * both a button and the trigger of another one. The championship tables and a
 * record card's lineage row are those rows. There the chevron keeps the
 * expansion and the name keeps the panel, which is the file-tree split and the
 * only arrangement that leaves both reachable. It costs the tab stop the note
 * above is about, so it is opted into per call site with `label` — the
 * accessible name the row's text was providing until it stopped being inside
 * the button.
 */

import { cn, HIT_AREA } from "../lib/utils.js";

/** Whether a row is open, and how to flip it: what `ExpandableRow` hands its cells. */
export interface Disclosure {
  readonly open: boolean;
  readonly onToggle: () => void;
}

export function DisclosureButton({
  open,
  onToggle,
  className,
  label,
  children,
}: Disclosure & {
  className?: string;
  /** Name the control itself, for a chevron drawn without the row's text. */
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      {...(label === undefined ? {} : { "aria-label": label })}
      className={cn(
        "focus-visible:ring-ring -mx-1 flex cursor-pointer items-center gap-2 rounded px-1 text-left focus-visible:ring-2 focus-visible:outline-none",
        // A row's height, and a lone chevron the position cell's padding too:
        // its right is the name, a control of its own.
        HIT_AREA,
        "after:-inset-y-2",
        label === undefined ? "after:inset-x-0" : "after:-left-3 after:right-0",
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
