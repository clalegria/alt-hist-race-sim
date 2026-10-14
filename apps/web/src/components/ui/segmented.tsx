import { cn } from "../../lib/utils.js";

/**
 * A segmented control's look: one bordered group, the chosen segment filled.
 * Exported as classes, like `buttonClass`, because the controls that wear it
 * differ in what they are — buttons that act (`Segmented`), radios
 * (`SortToggle`), tabs (`Tabs`).
 */
export const SEGMENTED_GROUP = "border-border inline-flex border";

export type SegmentState = "chosen" | "idle" | "disabled";

const STATES = {
  // Inside a disabled fieldset (the locked settings dialog) the answer still shows, unaccented.
  chosen: "bg-primary text-primary-foreground disabled:bg-muted disabled:text-foreground",
  idle: "text-muted-foreground hover:not-disabled:text-foreground hover:not-disabled:bg-accent cursor-pointer disabled:text-subtle disabled:cursor-not-allowed",
  disabled: "text-subtle cursor-not-allowed",
} as const satisfies Record<SegmentState, string>;

/** One segment's classes; size and type are the caller's. */
export function segmentClass(state: SegmentState, className?: string): string {
  return cn(
    "focus-visible:ring-ring inline-flex items-center justify-center transition focus-visible:ring-2 focus-visible:outline-none",
    STATES[state],
    className,
  );
}

/** One answer on a segmented control. */
export interface SegmentItem {
  readonly key: string;
  readonly label: string;
  /** The accessible name, when it says more than the label. */
  readonly ariaLabel?: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  /** Called only when an unselected segment is pressed. */
  readonly onPick: () => void;
}

/**
 * A button group with `aria-pressed` rather than radio inputs: each segment is
 * an action that commits at once. `className` lays the group out (a grid of
 * years); `segment` sizes each one.
 */
export function Segmented({
  label,
  items,
  className,
  segment,
}: {
  /** The group's accessible name. */
  label: string;
  items: readonly SegmentItem[];
  className?: string;
  segment?: string;
}) {
  return (
    <fieldset aria-label={label} className={cn(SEGMENTED_GROUP, "m-0 min-w-0 p-0", className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.selected}
          {...(item.ariaLabel === undefined ? {} : { "aria-label": item.ariaLabel })}
          disabled={item.disabled === true}
          onClick={() => {
            if (!item.selected) {
              item.onPick();
            }
          }}
          className={segmentClass(
            item.disabled === true ? "disabled" : item.selected ? "chosen" : "idle",
            segment,
          )}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
