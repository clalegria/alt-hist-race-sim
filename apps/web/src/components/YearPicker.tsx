import { decadeOf, isPlayable, SEASON_DECADES, yearsInDecade } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

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
        {/*
          `aria-pressed` rather than a radio group: these are buttons that act
          on the rest of the screen the moment they are pressed, and a screen
          reader is better told "1980s, pressed" than walked through a
          seventy-seven-strong radio group to find the same thing.
        */}
        <div className="flex flex-col gap-1.5">
          <span className="text-subtle text-xs font-medium tracking-wide uppercase">Decade</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {SEASON_DECADES.map((each) => {
              const opens = opener(each);
              const open = each === decade;
              return (
                <button
                  key={each}
                  type="button"
                  disabled={opens === null}
                  aria-pressed={open}
                  aria-label={
                    opens === null ? `The ${each}s are not available yet` : `The ${each}s`
                  }
                  onClick={() => {
                    if (opens !== null) {
                      onSelect?.(opens);
                    }
                  }}
                  className={cn(
                    "focus-visible:ring-ring h-9 rounded-md border text-sm font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                    opens === null
                      ? "border-border text-subtle cursor-not-allowed"
                      : open
                        ? "border-primary bg-primary text-primary-foreground cursor-pointer"
                        : "border-border hover:bg-accent cursor-pointer",
                  )}
                >
                  {each}s
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-subtle text-xs font-medium tracking-wide uppercase">
            Season in the {decade}s
          </span>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {yearsInDecade(decade).map((each) => {
              const runnable = playable(each);
              const chosen = each === year;
              return (
                <button
                  key={each}
                  type="button"
                  disabled={!runnable}
                  aria-pressed={chosen}
                  aria-label={runnable ? describeYear(each) : `${each} is not available yet`}
                  onClick={() => {
                    onSelect?.(each);
                  }}
                  className={cn(
                    "focus-visible:ring-ring h-11 rounded-md border text-sm font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                    !runnable
                      ? "border-border text-subtle cursor-not-allowed"
                      : chosen
                        ? "border-primary bg-primary text-primary-foreground cursor-pointer"
                        : "border-primary/50 bg-primary/10 text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer",
                  )}
                >
                  {each}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
