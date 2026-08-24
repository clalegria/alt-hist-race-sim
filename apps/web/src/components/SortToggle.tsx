import type { SortOrder } from "../lib/sort.js";
import { cn } from "../lib/utils.js";

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
      <span className="border-border inline-flex rounded-md border p-0.5">
        {OPTIONS.map((option) => {
          const selected = option.order === order;
          return (
            <label
              key={option.order}
              className={cn(
                "cursor-pointer rounded px-2 py-1 text-xs font-medium transition",
                "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
