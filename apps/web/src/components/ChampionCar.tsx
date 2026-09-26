import type { Livery } from "@alt-hist/data";
import {
  type CarSprite,
  type PixelRole,
  pixelRuns,
  runsPath,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  wheelRows,
} from "../lib/car-sprites.js";
import { cn } from "../lib/utils.js";

/**
 * A champion's car: its decade's sprite painted in the team's livery, wheels
 * turning.
 *
 * **An inline SVG, drawn as one path per colour**, with `crispEdges` so the
 * browser does not blur the pixel edges when it scales them up. Inline rather
 * than an `<img>` because the colours are the team's and are only known at
 * render time, and because the page's own stylesheet can then animate the
 * wheels — including switching them off for a reader who has asked their
 * system for reduced motion (`motion-safe:`).
 *
 * The livery is used as authored, not pulled toward the theme as a card's wash
 * is (`.claude/rules/web-liveries.md`): this is a picture of the car, and every
 * pixel of it sits inside a near-black outline, which is what keeps a white car
 * visible on the light theme. The outline is one colour in both themes; dark
 * against the dark card is still a clear step.
 */

/** The colours that do not come from the livery. */
const FIXED = {
  o: "#16181a",
  v: "#1f2a3d",
  c: "#2c2e31",
  x: "#5b5f64",
  m: "#bcc0c5",
  w: "#f4f3ef",
} as const;

/** How far a primary colour is darkened for the underside of the body. */
const SHADE = 72;

/** Each role's colour for this livery. Stripes follow the badge's count. */
function coloursFor(livery: Livery): Record<PixelRole, string> {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = livery;
  const stripe1 = badgeStripes >= 1 ? secondaryColor1 : primaryColor;
  const stripe2 = badgeStripes >= 2 ? secondaryColor2 : stripe1;
  return {
    ...FIXED,
    P: primaryColor,
    p: `color-mix(in oklab, ${primaryColor} ${SHADE}%, black)`,
    "1": stripe1,
    "2": stripe2,
    h: secondaryColor1,
  };
}

function Pixels({
  rows,
  colours,
}: {
  rows: readonly string[];
  colours: Record<PixelRole, string>;
}) {
  return (
    <>
      {[...pixelRuns(rows)].map(([role, runs]) => (
        // `style` rather than the `fill` attribute: an SVG presentation
        // attribute does not take `color-mix()`, a CSS property does.
        <path key={role} d={runsPath(runs)} style={{ fill: colours[role] }} />
      ))}
    </>
  );
}

export function ChampionCar({
  sprite,
  livery,
  className,
}: {
  sprite: CarSprite;
  livery: Livery;
  className?: string | undefined;
}) {
  const colours = coloursFor(livery);
  return (
    <svg
      // Decorative: the card names the champion and the team in words.
      aria-hidden="true"
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
    >
      <Pixels rows={sprite.rows} colours={colours} />
      {sprite.wheels.map((wheel) => (
        <g key={wheel.x} transform={`translate(${wheel.x} ${wheel.y})`}>
          {/*
            The turning is on an inner group so it pivots about the wheel's
            own centre (`fill-box`) rather than the corner of the canvas.
          */}
          <g className="motion-safe:animate-wheel [transform-box:fill-box] [transform-origin:center]">
            <Pixels rows={wheelRows(wheel)} colours={colours} />
          </g>
        </g>
      ))}
    </svg>
  );
}
