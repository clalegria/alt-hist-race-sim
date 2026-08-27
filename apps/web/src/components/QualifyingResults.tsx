import type { RaceEntryResult, RaceResult } from "@alt-hist/engine";
import { formatSeconds } from "../lib/format.js";
import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { driverCountry, driverName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { useEntryName } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { TeamBadge } from "./TeamBadge.js";

/**
 * One car's slot on the grid.
 *
 * Fixed height, because the stagger below depends on every row being the same
 * size — a name that wrapped to two lines would throw the whole column out.
 * Names truncate instead.
 */
function GridSlot({ entry }: { entry: RaceEntryResult }) {
  const nameOf = useEntryName();
  const nationality = driverCountry(entry.driverId);
  const pole = entry.gridPosition === 1;

  return (
    <div
      className={cn(
        "border-border bg-card flex h-[3.25rem] items-center gap-2 rounded-lg border px-2.5",
        pole && STANDOUT_SURFACE,
      )}
    >
      <span
        className={cn(
          "w-5 shrink-0 text-right text-sm tabular-nums",
          pole ? cn(STANDOUT_TEXT, "font-semibold") : "text-muted-foreground",
        )}
      >
        {entry.gridPosition}
      </span>
      <TeamBadge teamId={entry.teamId} />
      {nationality === undefined ? null : <Flag country={nationality} title={nationality} />}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={cn("truncate text-sm", pole && "font-semibold")}>
          {driverName(entry.driverId)}
        </span>
        <span className="text-muted-foreground truncate text-xs">{nameOf(entry.teamId)}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          pole ? STANDOUT_TEXT : "text-muted-foreground",
        )}
      >
        {pole ? "pole" : formatSeconds(entry.qualifyingGapToPole)}
      </span>
    </div>
  );
}

/**
 * The starting grid, laid out like one.
 *
 * Two columns, odd positions on the left and even on the right, with the right
 * column set back half a row — the staggered formation a real grid forms up in.
 *
 * The geometry is worth stating because it is easy to get subtly wrong. Rows are
 * a fixed height (the "step"), and even slots are shifted by exactly half a step
 * with `translate-y`, which moves them visually without changing layout height.
 * That puts car N at `(N - 1) × step / 2` down the page for every N, so the
 * spacing between P1 and P2 is the same as between P2 and P3. Using a margin
 * instead would grow the row it sits in and break that evenly-spaced illusion —
 * P2 would sit far closer to P1 than P3 does.
 *
 * Two numbers control the look: the row height and the offset, which must stay
 * exactly half of it. Below `sm` the stagger is dropped entirely and the grid
 * becomes a single column, since two columns of names do not fit on a phone.
 */
function StartingGrid({ starters }: { starters: readonly RaceEntryResult[] }) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:auto-rows-[3.75rem] sm:grid-cols-2 sm:gap-x-6 sm:gap-y-0 sm:pb-8">
      {starters.map((entry) => (
        <li key={entry.driverId} className="sm:even:translate-y-[1.875rem]">
          <GridSlot entry={entry} />
        </li>
      ))}
    </ol>
  );
}

export function QualifyingResults({ race }: { race: RaceResult }) {
  const order = [...race.entries].sort((a, b) => a.gridPosition - b.gridPosition);
  // Cars outside the cut never form up, so they do not belong on the grid.
  const starters = order.filter((entry) => entry.started);
  const nonQualifiers = order.filter((entry) => !entry.started);

  return (
    <div className="px-5 py-4">
      <StartingGrid starters={starters} />

      {nonQualifiers.length === 0 ? null : (
        <div className="border-border mt-2 border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Did not qualify
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6">
            {nonQualifiers.map((entry) => (
              <li key={entry.driverId} className="opacity-60">
                <GridSlot entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
