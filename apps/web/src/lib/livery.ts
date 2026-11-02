/**
 * A team's colours, resolved for a season.
 *
 * Two sources, in order. A team's `liveries` in `teams.json` are a list of eras
 * — McLaren is Marlboro white from 1974 and silver from 1997 — and that is
 * where a livery normally comes from. A season's entry may still override the
 * era for that one year, all four fields or none, for a car that was
 * deliberately unlike the seasons either side of it. This module is the one
 * place both are applied, so a badge, a card's corner and whatever uses colour
 * next cannot disagree about what a team looks like in a given year.
 *
 * Display only. Nothing in the engine reads a livery, and nothing here feeds
 * the simulation — which is why this sits beside `names.ts` rather than in
 * `@alt-hist/data`, and why the module-level map is built the same way.
 */

import {
  hasSeason,
  type Livery,
  type SeasonEntry,
  seasonSeed,
  teamLiveryIn,
  teamsById,
} from "@alt-hist/data";

const teams = teamsById();

/**
 * The overrides a season declares, built once per year on first use.
 *
 * Cached because a race classification asks for one per row and a grid asks for
 * one per card, and rebuilding the map each time would rescan the entry list on
 * every render.
 */
const overrides = new Map<number, ReadonlyMap<string, Livery>>();

function overridesFor(year: number): ReadonlyMap<string, Livery> {
  const cached = overrides.get(year);
  if (cached !== undefined) {
    return cached;
  }
  const found = new Map<string, Livery>();
  // An unauthored year has no entries to read. `seasonSeed` throws rather than
  // falling back, and a missing colour is not worth failing a render over.
  if (hasSeason(year)) {
    for (const entry of seasonSeed(year).entries) {
      const override = wholeLivery(entry);
      if (override !== undefined) {
        found.set(entry.teamId, override);
      }
    }
  }
  overrides.set(year, found);
  return found;
}

/**
 * A season entry's override, or undefined where it declares none.
 *
 * All four fields are checked rather than trusting one to imply the rest.
 * `validateSeedData` does guarantee it — a partial override is an authoring
 * error, not a merge — but that guarantee runs over the *bundled* seed, and
 * defaulting the three fields off `primaryColor` would put colours nobody
 * authored on screen if it ever stopped holding.
 */
function wholeLivery(entry: SeasonEntry): Livery | undefined {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = entry;
  if (
    primaryColor === undefined ||
    secondaryColor1 === undefined ||
    secondaryColor2 === undefined ||
    badgeStripes === undefined
  ) {
    return undefined;
  }
  return { primaryColor, secondaryColor1, secondaryColor2, badgeStripes };
}

/**
 * What a team looks like — that season's override if it declares one, otherwise
 * the livery era in force.
 *
 * Undefined for a team the seed data does not know, which every caller already
 * treats as "draw nothing", the same contract `Flag` has for an unknown
 * country. Omitting `year` gives the team's most recent livery, which is for a
 * caller with no season in hand; inside one, pass it.
 */
export function liveryFor(teamId: string, year?: number): Livery | undefined {
  if (year !== undefined) {
    const override = overridesFor(year).get(teamId);
    if (override !== undefined) {
      return override;
    }
  }
  const team = teams.get(teamId);
  return team === undefined ? undefined : teamLiveryIn(team, year);
}

/**
 * A team colour, moved far enough from the current background to be seen on it.
 *
 * A livery is authored against a racing car, not against this palette, so any
 * colour in it can land on top of whichever background the reader is using —
 * white vanishes on the light theme, near-black on the dark one.
 * `--color-foreground` is by definition the far end of the live theme from its
 * background, so pulling every team colour toward it guarantees separation in
 * both themes. How far is `--line-pull` in `index.css`, a value per theme, since
 * the dark card sits further from black than the light one does from white.
 *
 * Note this pulls *every* colour, not only the ones that would have clashed —
 * a colour already contrasting is muted slightly for no benefit. That is the
 * price of having no way to ask, in CSS, how close a colour is to the surface
 * it is about to sit on. The obvious alternative — clamping the colour's
 * lightness with `oklch(from ...)` — was tried: it needs relative colour syntax,
 * newer than everything else here relies on, and where that is missing the
 * whole declaration is invalid and the colour silently disappears, which is how
 * it shipped once. `color-mix` is the same baseline as the rest of the app.
 *
 * Used by the standings charts, where a line drawn in a raw livery would be
 * white on white. A chart cannot pass this string to an SVG
 * `stroke` attribute, though — see `StandingsEvolution.tsx` for why it travels
 * as a custom property instead.
 */
export function legible(color: string): string {
  return `color-mix(in oklab, ${color}, var(--color-foreground) var(--line-pull))`;
}
