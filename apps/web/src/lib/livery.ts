/**
 * A team's colours, resolved for a season.
 *
 * Every team carries a default livery in `teams.json`; a season's entry may
 * override it, all four fields or none — Benetton is green in 1991 and blue in
 * 1996, and both are the same team. This module is the one place that rule is
 * applied, so a badge, a card outline and whatever uses colour next cannot
 * disagree about what a team looks like in a given year.
 *
 * Display only. Nothing in the engine reads a livery, and nothing here feeds
 * the simulation — which is why this sits beside `names.ts` rather than in
 * `@alt-hist/data`, and why the module-level map is built the same way.
 */

import { hasSeason, type Livery, type SeasonEntry, seasonSeed, teamsById } from "@alt-hist/data";

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
 * What a team looks like — that season's livery if it has one, otherwise the
 * team's default.
 *
 * Undefined for a team the seed data does not know, which every caller already
 * treats as "draw nothing", the same contract `Flag` has for an unknown
 * country. Omit `year` outside a season, where only the default applies.
 */
export function liveryFor(teamId: string, year?: number): Livery | undefined {
  if (year !== undefined) {
    const override = overridesFor(year).get(teamId);
    if (override !== undefined) {
      return override;
    }
  }
  return teams.get(teamId);
}

/**
 * How far a card's wash travels from the card colour toward the team's, as a
 * percentage. Bigger than it first was: the wash has to survive being laid over
 * a surface it is only tinting, and 18 was low enough to read as absent.
 */
const TINT = 32;

/**
 * How far a team colour is pulled toward the theme's own foreground before it
 * is used on anything.
 *
 * This is the whole anti-clash mechanism, and it is used for **both** the wash
 * and the outline. A livery is authored against a racing car, not against this
 * palette, so any colour in it can land on top of whichever background the
 * reader is using — white vanished on the light theme, near-black would on the
 * dark one. `--color-foreground` is by definition the far end of the live theme
 * from its background, so pulling every team colour a fixed distance toward it
 * guarantees separation in both themes, with no JavaScript and no per-theme
 * branch.
 *
 * The obvious alternative — clamping the colour's lightness into a band with
 * `oklch(from ...)` — is more precise and was tried. It needs relative colour
 * syntax, which is newer than everything else here relies on; where that is
 * missing the whole declaration is invalid and the wash silently disappears,
 * which is how it shipped once. `color-mix` is the same baseline as the rest of
 * the app and is already proven in it.
 */
const CONTRAST_PULL = 28;

/**
 * A team colour, moved far enough from the current background to be seen on it.
 *
 * Note this pulls *every* colour, not only the ones that would have clashed —
 * a colour already contrasting is muted slightly for no benefit. That is the
 * price of having no way to ask, in CSS, how close a colour is to the surface
 * it is about to sit on.
 *
 * Exported because the standings charts need it too: a line drawn in a raw
 * livery is the same white-on-white problem the team cards had, and there is
 * not a second mechanism for it. A chart cannot pass this string to an SVG
 * `stroke` attribute, though — see `StandingsEvolution.tsx` for why it travels
 * as a custom property instead.
 */
export function legible(color: string): string {
  return `color-mix(in oklab, ${color} ${100 - CONTRAST_PULL}%, var(--color-foreground))`;
}

/**
 * A card's background: a diagonal wash from the team's primary colour back to
 * the plain card surface.
 *
 * Mixed against `--color-card` rather than laid on as a translucent overlay, so
 * the tint is computed from whichever theme is live — an `rgba` overlay would
 * lighten on dark and do nothing at all on light for a white primary. The
 * primary goes through `legible` first for the same reason: mixing a colour
 * toward a surface it already matches produces no wash whatsoever, which is
 * what made white teams look ungradiented on the light theme.
 */
export function cardTint(livery: Livery): string {
  return `linear-gradient(135deg, color-mix(in oklab, var(--color-card) ${100 - TINT}%, ${legible(livery.primaryColor)}) 0%, var(--color-card) 100%)`;
}

/** A card's outline: the first accent, pulled far enough to stay visible. */
export function cardOutline(livery: Livery): string {
  return legible(livery.secondaryColor1);
}
