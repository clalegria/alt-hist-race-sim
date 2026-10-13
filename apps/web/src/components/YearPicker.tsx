import { decadeOf, isPlayable, SEASON_DECADES, yearsInDecade } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Segmented } from "./ui/segmented.js";

/**
 * Each grid is one bordered group: a 1px gap with every cell ringed in the
 * border colour, so neighbouring rings meet in the gap as a single line.
 */
const GRID = "grid grid-cols-4 gap-px border-0 p-px sm:grid-cols-8";
const CELL = "ring-border text-sm font-medium tabular-nums ring-1";

/**
 * Which year to run, in two steps: a rail of decades, then the years in one.
 *
 * The whole 1950–2026 range used to be drawn as one block of seventy-seven
 * buttons, which said what the app was for and was also a wall of
 * near-identical numbers that dominated the screen. Splitting it costs a click
 * to reach a decade you are not already in and buys a screen with a reading
 * order.
 *
 * **Controlled by the selected year alone, and no other state.** Which decade
 * is open is `decadeOf(year)` — not a second piece of state beside it — so the
 * picker cannot get into the one incoherent position it otherwise could: a
 * decade open with the selection somewhere else entirely, and a Begin button
 * quietly pointing at a year that is not on screen. Picking a decade therefore
 * *selects* its earliest playable year, and the year grid follows. Nothing
 * commits until the button below this, so browsing decades is free.
 *
 * The single-value shape is also what makes every state render without a click,
 * which is the level this app is tested at.
 *
 * `aria-pressed` buttons rather than a radio group: they act on the rest of the
 * screen the moment they are pressed, and a screen reader is better told
 * "1980s, pressed" than walked through a seventy-seven-strong radio group.
 */
export function YearPicker({
  year,
  onSelect,
  title,
  lead,
  describeYear,
  playable = isPlayable,
}: {
  /** The selected year. Its decade is the one that is open. */
  year: number;
  /** Absent in tests, where nothing is clicked. The picker still renders. */
  onSelect?: (year: number) => void;
  title: string;
  lead: string;
  /** The accessible label on a playable year's button. */
  describeYear: (year: number) => string;
  /**
   * Whether a year can actually be run. Injected so the *rule* — an unplayable
   * year is drawn and disabled, a decade holding none is unpickable — can be
   * tested against a range with gaps in it. Every season from 1950 to 2026 is
   * authored today, so against the real data both of those branches are dead,
   * and a test that only ever sees the real data asserts nothing about them.
   */
  playable?: (year: number) => boolean;
}) {
  const decade = decadeOf(year);
  /** The year a decade opens on: its earliest playable one, or none. */
  const opener = (each: number): number | null => yearsInDecade(each).find(playable) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{lead}</CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-subtle text-xs font-medium tracking-wide uppercase">Decade</span>
          <Segmented
            label="Decade"
            className={GRID}
            segment={cn(CELL, "h-9")}
            items={SEASON_DECADES.map((each) => {
              const opens = opener(each);
              return {
                key: String(each),
                label: `${each}s`,
                ariaLabel: opens === null ? `The ${each}s are not available yet` : `The ${each}s`,
                selected: each === decade,
                disabled: opens === null,
                onPick: () => {
                  if (opens !== null) {
                    onSelect?.(opens);
                  }
                },
              };
            })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-subtle text-xs font-medium tracking-wide uppercase">
            Season in the {decade}s
          </span>
          <Segmented
            label={`Season in the ${decade}s`}
            className={cn(GRID, "grid-cols-5 sm:grid-cols-10")}
            segment={cn(CELL, "h-11")}
            items={yearsInDecade(decade).map((each) => {
              const runnable = playable(each);
              return {
                key: String(each),
                label: String(each),
                ariaLabel: runnable ? describeYear(each) : `${each} is not available yet`,
                selected: each === year,
                disabled: !runnable,
                onPick: () => {
                  onSelect?.(each);
                },
              };
            })}
          />
        </div>
      </div>
    </Card>
  );
}
