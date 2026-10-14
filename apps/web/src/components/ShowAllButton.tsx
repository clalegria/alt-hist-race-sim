import { cn, MONO_LABEL } from "../lib/utils.js";

/**
 * The control that opens a cut-down list out to its full length.
 *
 * The provisional standings beside a race and the era's record cards both show
 * a top few and hide the tail, and both had the same footer button — down to
 * the class string — so it has one definition, exactly as `DisclosureButton`
 * does for the rows that open into a panel.
 *
 * It says how many rows are hidden rather than "more": a reader deciding
 * whether to press it wants to know whether the tail is two rows or forty.
 * `aria-expanded` is the whole of the accessibility contract, and it is also
 * what the DOM-less tests read the state back out of.
 *
 * Drawn as the list's foot, a centred label in mono capitals under a rule.
 */
export function ShowAllButton({
  expanded,
  onToggle,
  total,
  collapsed,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** How many rows there are in all. */
  total: number;
  /** How many show while it is shut. */
  collapsed: number;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={cn(
        MONO_LABEL,
        "border-border hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring w-full cursor-pointer border-t px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {expanded ? `Show top ${collapsed}` : `Show all ${total}`}
    </button>
  );
}
