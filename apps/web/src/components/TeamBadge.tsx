import type { Livery } from "@alt-hist/data";
import { cn } from "../lib/utils.js";
import { useLivery } from "./Liveries.js";

/**
 * A team's colours as a circular badge: the primary colour as the disc, with up
 * to two diagonal stripes across it in the accents.
 *
 * **Drawn as a CSS gradient on a `span`, not an SVG.** The shape is two hard
 * colour stops on one axis, which a gradient states exactly and a vector would
 * spell out in clip paths — and more to the point, several tests count the
 * flags in a table by counting `<svg>` elements. A badge beside every flag
 * would double that count, and the failure would look like a flag bug.
 *
 * Sized in `em` so it scales with whatever it sits in rather than needing a
 * size prop per call site — but at 1.5em it is a mark for a whole row, not a
 * glyph beside a name, and it is meant to be centred against the entry rather
 * than aligned to a line of text. Callers wanting a different size override it
 * through `className`.
 *
 * **Where it appears is decided per call site**, never here: the race sheet,
 * the starting grid, both champions, the calendar's poles and winners, both
 * championship tables and the roll of honour. Nothing that only appears after a
 * click wears one — an expansion repeating the screen the reader just left is
 * noise rather than detail — which is why `RaceClassification` and
 * `StandingsTable` take a `badge` prop instead of drawing one unconditionally.
 */

/**
 * Where the stripes sit along the gradient axis, as percentages.
 *
 * They meet at the centre with **no gap** — one band ends exactly where the
 * next begins — so two stripes read as a single diagonal sash split in two
 * rather than as two separate marks. `HALF_WIDTH` is therefore both half of a
 * two-stripe sash and, doubled, the width of a lone one: a single stripe covers
 * the same ground the pair would, so a 1-stripe badge and a 2-stripe badge
 * carry the same weight of colour.
 */
const CENTRE = 50;
/**
 * Measured along the gradient axis, which on a 135° diagonal runs about 1.41×
 * the disc's diameter — so a sash of `2 × HALF_WIDTH` percent covers roughly
 * 1.41 times that fraction of the width you actually see. 13 looked balanced as
 * a number and read as stripes-with-a-background rather than a background with
 * stripes; 9 leaves the primary colour clearly the dominant one, which is the
 * point of it being the primary.
 */
const HALF_WIDTH = 9;

/** Down the disc from top-left to bottom-right. */
const ANGLE = "135deg";

/**
 * The disc's background, from a livery.
 *
 * Exported for tests: the bands are arithmetic, and checking them in the
 * rendered `style` attribute means parsing a string out of the markup.
 */
export function badgeBackground(livery: Livery): string {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = livery;
  if (badgeStripes === 1) {
    const from = CENTRE - HALF_WIDTH;
    const to = CENTRE + HALF_WIDTH;
    return `linear-gradient(${ANGLE}, ${primaryColor} ${from}%, ${secondaryColor1} ${from}%, ${secondaryColor1} ${to}%, ${primaryColor} ${to}%)`;
  }
  if (badgeStripes >= 2) {
    const from = CENTRE - HALF_WIDTH;
    const to = CENTRE + HALF_WIDTH;
    return `linear-gradient(${ANGLE}, ${primaryColor} ${from}%, ${secondaryColor1} ${from}%, ${secondaryColor1} ${CENTRE}%, ${secondaryColor2} ${CENTRE}%, ${secondaryColor2} ${to}%, ${primaryColor} ${to}%)`;
  }
  // 0 stripes is a plain disc. The accents stay authored and are simply not
  // drawn here — they are still the team's colours everywhere else.
  return primaryColor;
}

/**
 * The badge's own shape, exported so tests can count badges by it.
 *
 * `aria-hidden` is the obvious thing to count and the wrong one: chevrons,
 * layout spacers and the theme toggle all carry it, so counting that finds
 * badges only in a tree that happens to have none of them. Following
 * `NAME_TARGET` in `SeasonGrid`, the whole string is the marker.
 *
 * The hairline keeps a white or near-black primary from dissolving into the
 * page in one theme or the other. The size is against the row rather than the
 * text beside it: this is a mark for a whole entry, not a glyph in a sentence,
 * so it is deliberately larger than the flag next to it.
 */
export const BADGE_SHAPE =
  "border-border/60 inline-block size-[1.5em] shrink-0 rounded-full border";

export function TeamBadge({ teamId, className }: { teamId: string; className?: string }) {
  const liveryOf = useLivery();
  const livery = liveryOf(teamId);
  // Nothing rather than a grey placeholder, the same choice `Flag` makes for a
  // country it does not have: a missing badge is quieter than a wrong one.
  if (livery === undefined) {
    return null;
  }
  return (
    <span
      // Decorative: the team is named in the same row, so a screen reader
      // reading a colour here would only add noise.
      aria-hidden="true"
      className={cn(BADGE_SHAPE, className)}
      style={{ background: badgeBackground(livery) }}
    />
  );
}
