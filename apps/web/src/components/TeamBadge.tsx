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
  return sash(livery, ANGLE, CENTRE);
}

/**
 * The primary colour with the stripes across it, along `angle`, centred at
 * `centre` percent of the axis. One rule for the badge and the card corner.
 */
function sash(livery: Livery, angle: string, centre: number): string {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = livery;
  const from = centre - HALF_WIDTH;
  const to = centre + HALF_WIDTH;
  if (badgeStripes === 1) {
    return `linear-gradient(${angle}, ${primaryColor} ${from}%, ${secondaryColor1} ${from}%, ${secondaryColor1} ${to}%, ${primaryColor} ${to}%)`;
  }
  if (badgeStripes >= 2) {
    return `linear-gradient(${angle}, ${primaryColor} ${from}%, ${secondaryColor1} ${from}%, ${secondaryColor1} ${centre}%, ${secondaryColor2} ${centre}%, ${secondaryColor2} ${to}%, ${primaryColor} ${to}%)`;
  }
  // 0 stripes is plain primary. The accents stay authored and are simply not
  // drawn here — they are still the team's colours everywhere else.
  return primaryColor;
}

/** How far up a livery barcode stripe its accents reach, from the bottom. */
const BARCODE_ACCENTS = 34;

/**
 * A livery barcode stripe, top to bottom: the primary over the badge's stripes
 * as a band along the bottom, split in two where the badge has two.
 */
export function barcodeBackground(livery: Livery): string {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = livery;
  const from = 100 - BARCODE_ACCENTS;
  if (badgeStripes === 1) {
    return `linear-gradient(${primaryColor} ${from}%, ${secondaryColor1} ${from}%)`;
  }
  if (badgeStripes >= 2) {
    const split = from + BARCODE_ACCENTS / 2;
    return `linear-gradient(${primaryColor} ${from}%, ${secondaryColor1} ${from}%, ${secondaryColor1} ${split}%, ${secondaryColor2} ${split}%)`;
  }
  return primaryColor;
}

/**
 * The corner's sash runs up to the right, so its axis crosses the diagonal the
 * corner is cut along; the corner is the far half of that axis, 50 to 100.
 */
const CORNER_ANGLE = "45deg";
const CORNER_CENTRE = 72;

/** A grid card's corner sash: the badge's, along the corner's axis. */
export function cornerBackground(livery: Livery): string {
  return sash(livery, CORNER_ANGLE, CORNER_CENTRE);
}

/**
 * The corner's shape: a triangle in the card's top-right, 72px on a side, filled
 * in the card's own border colour. Exported so tests can count corners by it as
 * they count badges by `BADGE_SHAPE`.
 */
export const CORNER_SHAPE =
  "bg-border pointer-events-none absolute top-0 right-0 size-18 [clip-path:polygon(0_0,100%_0,100%_100%)]";

/**
 * The sash inside it: the same triangle with its diagonal moved 1.5px in, so a
 * line of the border colour about 1px wide shows along the cut, touching the
 * sash. That line is what draws the corner when the livery matches the card, as
 * a white one does on the light theme. Two clipped shapes rather than a gradient
 * line, because both edges then anti-alias the same way and nothing shows
 * between them.
 */
export const CORNER_SASH =
  "absolute inset-0 [clip-path:polygon(1.5px_0,100%_0,100%_calc(100%-1.5px))]";

/**
 * A team's colours in the top-right corner of its grid card. Decorative, like
 * the badge: the team is named on the card.
 */
export function LiveryCorner({ livery }: { livery: Livery }) {
  return (
    <span aria-hidden="true" className={CORNER_SHAPE}>
      <span className={CORNER_SASH} style={{ background: cornerBackground(livery) }} />
    </span>
  );
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
 * page in one theme or the other.
 *
 * **The size is deliberately not part of it.** `DEFAULT_SIZE` is applied
 * alongside, so a call site that overrides it through `className` —
 * tailwind-merge dropping the default as a conflict — still renders this whole
 * string and is still counted. Folding the two together made a resized badge
 * invisible to every test that counts them, which is a silent failure.
 */
export const BADGE_SHAPE = "border-badge-line inline-block shrink-0 rounded-full border";

/**
 * The size against the row rather than the text beside it: this is a mark for a
 * whole entry, not a glyph in a sentence, so by default it is deliberately
 * larger than the flag next to it.
 */
const DEFAULT_SIZE = "size-[1.5em]";

/**
 * The disc itself, drawn from colours the caller already has.
 *
 * `SeasonGrid` resolves liveries from the year it is handed rather than from
 * the `Liveries` context — that is what lets the grid editor preview a draft
 * the world has never seen — so it cannot use `TeamBadge`, which reads the
 * context. It gets this instead, and both draw the same shape so a test
 * counting `BADGE_SHAPE` finds badges wherever they are.
 */
export function LiveryBadge({
  livery,
  className,
}: {
  livery: Livery;
  className?: string | undefined;
}) {
  return (
    <span
      // Decorative: the team is named in the same row, so a screen reader
      // reading a colour here would only add noise.
      aria-hidden="true"
      className={cn(BADGE_SHAPE, DEFAULT_SIZE, className)}
      style={{ background: badgeBackground(livery) }}
    />
  );
}

export function TeamBadge({ teamId, className }: { teamId: string; className?: string }) {
  const liveryOf = useLivery();
  const livery = liveryOf(teamId);
  // Nothing rather than a grey placeholder, the same choice `Flag` makes for a
  // country it does not have: a missing badge is quieter than a wrong one.
  if (livery === undefined) {
    return null;
  }
  return <LiveryBadge livery={livery} className={className} />;
}
