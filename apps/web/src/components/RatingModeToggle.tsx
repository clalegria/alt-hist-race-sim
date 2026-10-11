import type { RatingMode } from "@alt-hist/data";
import { cn } from "../lib/utils.js";

/**
 * Which ratings the season is simulated from.
 *
 * This is a *simulation* input, not a display filter — switching it re-runs the
 * year, because the grid it produces is a different grid. It therefore lives on
 * the opening page and nowhere else: once qualifying has been revealed, changing
 * the drivers would invalidate everything the reader has already seen.
 *
 * The seed does not change with it, so the two modes are the same dice thrown at
 * different drivers, which is the comparison worth having.
 */

const OPTIONS = [
  {
    mode: "aged",
    label: "At their age",
    detail: "Drivers as they were that year: young ones still learning, old ones past their best.",
  },
  {
    mode: "peak",
    label: "At their peak",
    detail: "Every driver at the best they ever were, whatever year it is.",
  },
] as const satisfies readonly { mode: RatingMode; label: string; detail: string }[];

export function RatingModeToggle({
  mode,
  year,
  onChange,
}: {
  mode: RatingMode;
  year: number;
  onChange?: (mode: RatingMode) => void;
}) {
  const active = OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[0];

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold tracking-tight">Driver ability</span>
        <span className="text-muted-foreground text-xs">
          {active.detail.replace("that year", `in ${year}`)}
        </span>
      </div>

      <fieldset
        aria-label="Driver ability"
        className="border-border inline-flex shrink-0 rounded-md border p-0.5"
      >
        {OPTIONS.map((option) => {
          const selected = option.mode === mode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onChange?.(option.mode);
              }}
              className={cn(
                "focus-visible:ring-ring h-8 cursor-pointer rounded px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
