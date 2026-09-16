/**
 * The star on an entry racing at home.
 *
 * Three things have to meet to draw one: the grid as it was raced (which knows
 * where a driver, a team and an engine supplier are from), the round's host
 * country, and the engine's rule for comparing them. The first is a fact about
 * the whole season and rides a context, exactly as the engine supply in
 * `EntryNames` does — a result row records a `driverId` and nothing else, and
 * threading the field through `QualifyingResults`, `RaceClassification` and the
 * calendar's expansion would be three pass-through props deep. The second is a
 * fact about *one round*, so it stays a prop: the same classification component
 * is rendered for Monza and for Interlagos.
 *
 * The field comes off `world.field` rather than the seed files for the reason it
 * always does: who supplies whose engine is something the reader can change, and
 * the field is the record of the grid that actually raced.
 *
 * The default is an empty grid, so a component rendered on its own — which is
 * how most of this app is tested — draws no stars rather than throwing.
 */

import { AWAY, type HomeAllegiances, homeAllegiances, type RaceEntrant } from "@alt-hist/engine";
import { createContext, useContext, useMemo } from "react";
import { homeAdvantageLabel } from "../lib/home.js";
import { cn } from "../lib/utils.js";

const NO_GRID: ReadonlyMap<string, RaceEntrant> = new Map();

const Grid = createContext<ReadonlyMap<string, RaceEntrant>>(NO_GRID);

export function HomeAdvantage({
  field,
  children,
}: {
  field: readonly RaceEntrant[];
  children: React.ReactNode;
}) {
  const grid = useMemo(() => new Map(field.map((entrant) => [entrant.driverId, entrant])), [field]);
  return <Grid.Provider value={grid}>{children}</Grid.Provider>;
}

/**
 * Which of an entry's three allegiances are at home at a round in `country`.
 *
 * Everything away for a driver the grid does not know, which covers both a
 * component rendered outside a season and a round nobody said the country of.
 */
export function useHomeAllegiances(): (
  driverId: string,
  country: string | undefined,
) => HomeAllegiances {
  const grid = useContext(Grid);
  return (driverId, country) => {
    const entrant = grid.get(driverId);
    if (entrant === undefined || country === undefined) {
      return AWAY;
    }
    return homeAllegiances(entrant, { country });
  };
}

/**
 * A five-pointed star, drawn rather than fetched, for the same reasons `Flag`
 * and `RainIcon` are — an emoji ⭐ is a different picture on every platform.
 *
 * Filled in pale gold with a darker edge, and both are needed: the fill carries
 * it on the dark theme, the edge is what keeps it visible on a white card. See
 * `--color-home` in `index.css`.
 */
function StarIcon({ className, title }: { className?: string; title: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("fill-home stroke-home-edge inline-block h-3 w-3 shrink-0", className)}
      strokeWidth={1.5}
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M12 3.1 14.7 8.9 21 9.8 16.5 14.2 17.6 20.5 12 17.5 6.4 20.5 7.5 14.2 3 9.8 9.3 8.9Z" />
    </svg>
  );
}

/**
 * The mark itself: a star for an entry with someone at home this round, and
 * **nothing at all** for everyone else.
 *
 * Nothing, rather than a greyed-out star, for the reason the weather badge
 * draws nothing on a dry round: most of the field is away at most rounds, and a
 * column of faint stars down a classification is a column that says nothing.
 *
 * What it means is in the tooltip, never in the star alone — the same rule the
 * gain and loss arrows and the wet badge follow. The `title` sits on both the
 * wrapper and the `<svg>`: browsers do not agree on which one a hover finds.
 */
export function HomeStar({
  driverId,
  country,
  className,
}: {
  driverId: string;
  /** The round's host country. Undefined outside a round, which draws nothing. */
  country: string | undefined;
  className?: string;
}) {
  const allegiancesOf = useHomeAllegiances();
  const label = homeAdvantageLabel(allegiancesOf(driverId, country));
  if (label === null) {
    return null;
  }
  return (
    <span className={cn("inline-flex", className)} title={label}>
      <StarIcon title={label} />
    </span>
  );
}
