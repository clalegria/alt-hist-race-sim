import type { SortOrder } from "../lib/sort.js";
import { SEGMENTED_GROUP, segmentClass } from "./ui/segmented.js";

/**
 * Which way a list is ordered, as a two-way switch.
 *
 * Native radios in a fieldset rather than two `aria-pressed` buttons, for the
 * reason the pool filters are native checkboxes and the engine picker is a
 * native `select`: arrow-key navigation and the grouping announcement come for
 * free, and a DOM-less test can read `checked=""` back out of the markup. The
 * inputs are visually hidden and the label beside each one is what is drawn.
 */

const OPTIONS = [
  { order: "name", label: "A\u2013Z" },
  { order: "overall", label: "Rating" },
] as const satisfies readonly { order: SortOrder; label: string }[];

export function SortToggle({
  label,
  name,
  order,
  onChange,
}: {
  /** What is being sorted — "Sort teams". Announced, and drawn beside the switch. */
  label: string;
  /** Groups the radios. Must be unique on the page: two lists, two names. */
  name: string;
  order: SortOrder;
  /** Absent in tests, where nothing is clicked. The switch still renders. */
  onChange?: (order: SortOrder) => void;
}) {
  return (
    <fieldset className="flex shrink-0 items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        Sort
      </span>
      <span className={SEGMENTED_GROUP}>
        {OPTIONS.map((option) => {
          const selected = option.order === order;
          return (
            <label
              key={option.order}
              className={segmentClass(
                selected ? "chosen" : "idle",
                "has-[:focus-visible]:ring-ring cursor-pointer px-2 py-1 text-xs font-medium has-[:focus-visible]:ring-2",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.order}
                checked={selected}
                onChange={() => {
                  onChange?.(option.order);
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </span>
    </fieldset>
  );
}
