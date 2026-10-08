import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";

/** One answer on a run setting's segmented control. */
export interface Segment {
  readonly key: string;
  readonly label: string;
  readonly selected: boolean;
  /** Called only when an unselected segment is pressed. */
  readonly onPick: () => void;
}

/** A setting's name, at the head of its row; smaller for a sub-option. */
function SettingName({ name, sub, disabled }: { name: string; sub: boolean; disabled: boolean }) {
  return (
    <span
      className={cn(
        sub ? "text-xs font-medium" : "text-sm font-semibold tracking-tight",
        disabled && "text-muted-foreground",
      )}
    >
      {name}
    </span>
  );
}

/** The row every setting shares: its name on the left, its control on the right. */
const ROW = "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between";

/**
 * A run setting's name and its segmented control, on one row: the shape every
 * what-if in the settings dialog shares, so each reads historical-versus-what-if
 * the same way. The historical answer is the first segment.
 *
 * A button group with `aria-pressed`, copying `RatingModeToggle`, rather than
 * radio inputs: each segment is an action that commits at once.
 *
 * `disabled` greys out a setting another one makes meaningless. It goes on the
 * native `fieldset`, which disables every button inside it, so the pressed
 * segment still shows the reader's choice but nothing can be pressed. `sub` is
 * an option under another one (*Varies by up to* under Varied), drawn smaller.
 */
export function SettingSegments({
  name,
  segments,
  disabled = false,
  sub = false,
}: {
  name: string;
  segments: readonly Segment[];
  disabled?: boolean;
  sub?: boolean;
}) {
  return (
    <div className={ROW}>
      <SettingName name={name} sub={sub} disabled={disabled} />
      <fieldset
        aria-label={name}
        disabled={disabled}
        className="border-border inline-flex shrink-0 self-start rounded-md border p-0.5 disabled:opacity-50 sm:self-auto"
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
              "focus-visible:ring-ring cursor-pointer rounded px-2.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
              sub ? "h-7" : "h-8",
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

/** The class a setting's native `select` uses, so every picker looks alike. */
export const SETTING_SELECT_CLASS =
  "border-border bg-background focus-visible:ring-ring min-w-0 cursor-pointer rounded border px-1.5 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-xs";

/**
 * A run setting answered from a list — a year, a points table — as one native
 * `select` whose **first option is the historical answer**, the rule
 * `SettingSegments` keeps with its first segment. One control rather than two
 * segments with a picker appearing under the second: the list already says
 * "each year's own or one of these".
 *
 * Native, for the reason the grid's engine picker is: the platform control is
 * keyboard- and screen-reader-complete for free, and a DOM-less test can read
 * which option carries `selected=""`.
 */
export function SettingSelect({
  name,
  value,
  onChange,
  disabled = false,
  children,
}: {
  name: string;
  value: string;
  /** Absent in tests, where nothing is chosen. */
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** The `option`s, the historical one first. */
  children: ReactNode;
}) {
  return (
    <div className={ROW}>
      <SettingName name={name} sub={false} disabled={disabled} />
      <select
        aria-label={name}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange?.(event.target.value);
        }}
        className={cn(SETTING_SELECT_CLASS, "h-8 sm:w-60 sm:max-w-none")}
      >
        {children}
      </select>
    </div>
  );
}

/**
 * What a setting's answer does, under it. **Only for a what-if**: the
 * historical answer says what it is in its own label, and a note under every
 * row is what made the settings a page long.
 */
export function SettingNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

/** The options under a setting's answer — Varied's spread, Keep's seat rules — set in. */
export function SettingSub({ children }: { children: ReactNode }) {
  return <div className="border-border flex flex-col gap-2 border-l-2 pl-3">{children}</div>;
}
