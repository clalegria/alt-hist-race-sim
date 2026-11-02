/**
 * Which of its own colours each team draws a chart line in, so that two teams
 * in the same white do not become one line.
 *
 * A livery is authored against a racing car, and whole eras of the grid share a
 * colour: 1980 has Williams and Brabham both white, and a chart drawing both in
 * their primaries leaves the title fight as three near-identical lines. So the
 * teams are taken best placed first (`pickingOrder`), and each keeps
 * the first of its colours far enough from every colour already taken. The
 * leader always keeps its primary; the one below it falls back to an accent.
 *
 * Plain functions over colours, in their own module, for the reason
 * `lib/chart-layout.ts` is one: Recharts renders nothing without a DOM, and a
 * rule only a browser can see is a rule nobody tests.
 */

import type { Livery } from "@alt-hist/data";

/** A colour in OKLab: lightness, then the green–red and blue–yellow axes. */
type Oklab = readonly [number, number, number];

/**
 * A team's colour for a chart: the CSS to draw it in, and where it sits in OKLab
 * — perceptual, so a blend's point is the plain average of its two colours'.
 */
export interface SeriesColour {
  /** Raw, before `legible()`: a livery hex or a `color-mix` of two. */
  readonly css: string;
  readonly lab: Oklab;
}

/**
 * How far apart two line colours must be to read as two, in `asLine`'s space,
 * on whichever theme draws them closer.
 */
const CLASH_DISTANCE = 0.11;

/**
 * Each theme as `legible()` draws a line on it: the lightness of the foreground
 * every colour is pulled toward (its faint tint ignored), and `--line-pull`.
 *
 * Copies of `index.css`, held equal by `series-colours.test.ts`. Needed because
 * a clash is decided by what is drawn, not by the livery: the dark theme's
 * stronger pull washes two greens a car tells apart into one pale green.
 */
export const THEMES = [
  { name: "dark", foreground: 0.97, pull: 0.45 },
  { name: "light", foreground: 0.18, pull: 0.28 },
] as const;

/**
 * The OKLab lightness below which a colour's hue starts to fade from a line.
 *
 * A 2px line in navy reads as black: a hue that shows on a car's flank is too
 * dark to see at that width. Below this, the hue axes are scaled down in step
 * with the lightness, to nothing at black.
 */
const HUE_FADES_BELOW = 0.5;

/**
 * WCAG's allowance for light scattered off the screen, as a share of white:
 * the 0.05 in its contrast ratio, and what makes two darks hard to tell apart.
 */
const WCAG_FLARE = 0.05;

/** sRGB to linear light, per channel: the curve undone before any matrix. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** A `#RRGGBB` colour in OKLab, by Björn Ottosson's published matrices. */
export function oklab(hex: string): Oklab {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = linear((value >> 16) & 0xff);
  const g = linear((value >> 8) & 0xff);
  const b = linear(value & 0xff);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * A colour as it reads drawn as a thin line, where distance means "tell apart".
 *
 * Plain OKLab distance is for patches of colour, and it called Tyrrell's navy
 * and Lotus's black, in 1985, as far apart as red and orange. A line is read
 * mostly by its brightness, so lightness here is the log of the WCAG contrast
 * ratio against black, scaled to 0–1 — the scale on which two darks sit close
 * and two mid-tones far apart. Brightness is taken as OKLab lightness cubed,
 * exact for greys and close for colours, so a blend needs no second conversion.
 * Hue counts at full weight only where the colour is light enough to show it.
 */
function asLine([lightness, a, b]: Oklab): Oklab {
  const contrast = (lightness ** 3 + WCAG_FLARE) / WCAG_FLARE;
  const hue = Math.min(1, lightness / HUE_FADES_BELOW);
  return [Math.log(contrast) / Math.log((1 + WCAG_FLARE) / WCAG_FLARE), a * hue, b * hue];
}

/** A colour after `legible()` on one theme: mixed toward its foreground in OKLab. */
function drawnOn([lightness, a, b]: Oklab, theme: (typeof THEMES)[number]): Oklab {
  const keep = 1 - theme.pull;
  return [lightness * keep + theme.foreground * theme.pull, a * keep, b * keep];
}

/** How far apart two colours read as lines, on the theme that draws them closer. */
function distance(first: Oklab, second: Oklab): number {
  return Math.min(
    ...THEMES.map((theme) => {
      const a = asLine(drawnOn(first, theme));
      const b = asLine(drawnOn(second, theme));
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }),
  );
}

/** Two line colours a reader could take for one another. */
export function clashes(a: SeriesColour, b: SeriesColour): boolean {
  return distance(a.lab, b.lab) < CLASH_DISTANCE;
}

/**
 * What a team may be drawn in, most like the team first: its primary, its two
 * accents, then half-and-half blends of those.
 *
 * The blends are the last resort before giving up on colour. A white car with a
 * green stripe drawn in a pale green is still recognisably that car; a colour
 * from outside the livery would be a team nobody raced. The blend is mixed by
 * CSS in OKLab, so its point here is the plain average of the two.
 */
/** How many of `candidates` are the livery's own colours; the rest are blends. */
const OWN_COLOURS = 3;

function candidates(livery: Livery): SeriesColour[] {
  const primary = authored(livery.primaryColor);
  const first = authored(livery.secondaryColor1);
  const second = authored(livery.secondaryColor2);
  return [
    primary,
    first,
    second,
    blend(primary, first),
    blend(primary, second),
    blend(first, second),
  ];
}

function authored(hex: string): SeriesColour {
  return { css: hex, lab: oklab(hex) };
}

function blend(a: SeriesColour, b: SeriesColour): SeriesColour {
  return {
    css: `color-mix(in oklab, ${a.css} 50%, ${b.css})`,
    lab: [(a.lab[0] + b.lab[0]) / 2, (a.lab[1] + b.lab[1]) / 2, (a.lab[2] + b.lab[2]) / 2],
  };
}

/**
 * The order teams pick their colours in, from both charts at once, so a team is
 * one colour on both: the drivers' champion's team, then the constructors'
 * champion, then each table's second, and so on, a team counted once.
 *
 * Interleaved rather than one table then the other, so a constructors' champion
 * with no driver near the top still outranks the drivers' fifth car.
 */
export function pickingOrder(
  drivers: readonly { teamId: string }[],
  teams: readonly { teamId: string }[],
): string[] {
  const order = new Set<string>();
  for (let rank = 0; rank < Math.max(drivers.length, teams.length); rank++) {
    for (const line of [drivers[rank], teams[rank]]) {
      if (line !== undefined) {
        order.add(line.teamId);
      }
    }
  }
  return [...order];
}

/**
 * One colour per livery, in the order given — `pickingOrder`'s, best placed
 * first, since each team picks only around the ones above it.
 *
 * A team takes the first of its own three colours clear of every colour
 * already taken. Where none is, it takes whichever candidate, blends included,
 * stands furthest from its nearest neighbour, the first of those on a tie: no
 * blend is more the team's than another, and the first to scrape clear is often
 * a pale copy of a colour already taken — 1985's McLaren in pink, under
 * Tyrrell's red. Dashes are for team-mates, never for two teams. An undefined
 * livery (a team the seed does not know) takes no colour and constrains nobody.
 */
export function seriesColours(
  liveries: readonly (Livery | undefined)[],
): (SeriesColour | undefined)[] {
  const taken: SeriesColour[] = [];
  const gapOf = (candidate: SeriesColour) =>
    Math.min(Infinity, ...taken.map((other) => distance(candidate.lab, other.lab)));
  return liveries.map((livery) => {
    if (livery === undefined) {
      return undefined;
    }
    const all = candidates(livery);
    const pick =
      all.slice(0, OWN_COLOURS).find((own) => gapOf(own) >= CLASH_DISTANCE) ??
      all.reduce((best, candidate) => (gapOf(candidate) > gapOf(best) ? candidate : best));
    taken.push(pick);
    return pick;
  });
}
