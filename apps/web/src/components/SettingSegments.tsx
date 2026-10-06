import { cn } from "../lib/utils.js";

/** One answer on a run setting's segmented control. */
export interface Segment {
  readonly key: string;
  readonly label: string;
  readonly selected: boolean;
  /** Called only when an unselected segment is pressed. */
  readonly onPick: () => void;
}

/**
 * A run setting's name and its segmented control, on one row: the shape every
 * what-if on the setup screen shares, so each reads historical-versus-what-if
 * the same way. The historical answer is the first segment.
 *
 * A button group with `aria-pressed`, copying `RatingModeToggle`, rather than
 * radio inputs: each segment is an action that commits at once.
 *
 * `disabled` greys out a setting another one makes meaningless. It goes on the
 * native `fieldset`, which disables every button inside it, so the pressed
 * segment still shows the reader's choice but nothing can be pressed.
 */
export function SettingSegments({
  name,
  segments,
  disabled = false,
}: {
  name: string;
  segments: readonly Segment[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span
        className={cn("text-sm font-semibold tracking-tight", disabled && "text-muted-foreground")}
      >
        {name}
      </span>
      <fieldset
        aria-label={name}
        disabled={disabled}
        className="border-border inline-flex shrink-0 self-start rounded-md border p-0.5 disabled:opacity-50"
      >
        {segments.map((segment) => (
          <button
            key={segment.key}
            type="button"
            aria-pressed={segment.selected}
            onClick={() => {
              if (!segment.selected) {
                segment.onPick();
              }
            }}
            className={cn(
              "focus-visible:ring-ring h-8 cursor-pointer rounded px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
              segment.selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground enabled:hover:text-foreground",
            )}
          >
            {segment.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** The class a setting's native `select` uses, so every picker under a segment looks alike. */
export const SETTING_SELECT_CLASS =
  "border-border bg-background focus-visible:ring-ring min-w-0 cursor-pointer rounded border px-1.5 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none sm:max-w-sm";
