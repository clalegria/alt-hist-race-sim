import type { RaceEntryResult, RaceResult } from "@alt-hist/engine";
import { formatSeconds } from "../lib/format.js";
import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { driverCountry } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { useEntryName } from "./EntryNames.js";
import { FittedDriverName } from "./FittedName.js";
import { Flag } from "./Flag.js";
import { HomeStar } from "./HomeAdvantage.js";
import { TeamBadge } from "./TeamBadge.js";
import { TeamCar } from "./TeamCar.js";

/**
 * One car's slot on the grid.
 *
 * Fixed height, because the stagger below depends on every row being the same
 * size — a name that wrapped to two lines would throw the whole column out.
 * Names shorten to initials and then truncate instead.
 */
function GridSlot({ entry, country }: { entry: RaceEntryResult; country?: string | undefined }) {
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
        <FittedDriverName
          driverId={entry.driverId}
          className={cn("text-sm", pole && "font-semibold")}
        />
        {/*
          The star trails the entry name, exactly as it does in the
          classification — the two sheets show the same mark in the same place
          relative to the same words, rather than one of them putting it in the
          corner of the slot. `min-w-0` on the name and `shrink-0` on the star
          keep the truncation on the name where it belongs: it is the team that
          has to give way when the column is tight, never the mark.
        */}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground truncate text-xs">{nameOf(entry.teamId)}</span>
          <HomeStar driverId={entry.driverId} country={country} className="shrink-0" />
        </span>
      </span>
      {/*
        In the gap between the names and the time. The names keep `flex-1`, so
        the car sits hard against the time and a long name truncates before it
        reaches the car. Hidden on the single-column phone grid, where that gap
        is what the name needs.
      */}
      <TeamCar teamId={entry.teamId} className="hidden sm:block" />
      {/*
        A fixed width, right-aligned, so the car beside it lands in the same
        place in every slot: "pole" is narrower than a time, and at its own
        width it let the pole-sitter's car drift right of everyone else's.
        Nine characters of the mono face holds "+12.345s" with room to spare.
      */}
      <span
        className={cn(
          "w-[9ch] shrink-0 text-right text-xs tabular-nums",
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
function StartingGrid({
  starters,
  country,
}: {
  starters: readonly RaceEntryResult[];
  country?: string | undefined;
}) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:auto-rows-[3.75rem] sm:grid-cols-2 sm:gap-x-6 sm:gap-y-0 sm:pb-8">
      {starters.map((entry) => (
        <li key={entry.driverId} className="sm:even:translate-y-[1.875rem]">
          <GridSlot entry={entry} country={country} />
        </li>
      ))}
    </ol>
  );
}

export function QualifyingResults({
  race,
  country,
}: {
  race: RaceResult;
  /**
   * Where the round was held, so an entry racing at home can be starred. Absent
   * for a grid shown outside a round, which simply stars nobody.
   */
  country?: string | undefined;
}) {
  const order = [...race.entries].sort((a, b) => a.gridPosition - b.gridPosition);
  // Cars outside the cut never form up, so they do not belong on the grid.
  const starters = order.filter((entry) => entry.started);
  const nonQualifiers = order.filter((entry) => !entry.started);

  return (
    <div className="px-5 py-4">
      <StartingGrid starters={starters} country={country} />

      {nonQualifiers.length === 0 ? null : (
        <div className="border-border mt-2 border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Did not qualify
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6">
            {nonQualifiers.map((entry) => (
              <li key={entry.driverId} className="opacity-60">
                <GridSlot entry={entry} country={country} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
