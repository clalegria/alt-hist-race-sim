import type { Livery } from "@alt-hist/data";
import {
  carSpriteFor,
  type PixelRole,
  pixelRuns,
  runsPath,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  wheelRows,
} from "../lib/car-sprites.js";
import { cn } from "../lib/utils.js";
import { useLivery, useSeasonYear } from "./Liveries.js";

/**
 * A team's car: its decade's sprite painted in the team's livery.
 *
 * **Two sizes, and only two.** Every row, slot and panel that shows a car uses
 * `small`, so a car is the same size wherever it is met; only the champion
 * cards and the home screen's track use `large`, and only they turn the wheels. Both are whole multiples of
 * the sprite (1× and 3×), which is what keeps every pixel square.
 *
 * **An inline SVG, drawn as one path per colour**, with `crispEdges` so the
 * browser does not blur the pixel edges when it scales them up. Inline rather
 * than an `<img>` because the colours are the team's and are only known at
 * render time, and because the page's own stylesheet can then animate the
 * wheels — including switching them off for a reader who has asked their
 * system for reduced motion (`motion-safe:`).
 *
 * The livery is used as authored, not pulled toward the theme as a chart's line
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

/**
 * Width and height at each size: 1× and 3× the sprite's canvas. Exported so
 * tests can tell the sizes apart in a rendered tree.
 */
export const CAR_SIZES = {
  small: "h-3.5 w-12",
  large: "h-10.5 w-36",
} as const;

export type CarSize = keyof typeof CAR_SIZES;

/**
 * A car drawn from colours the caller already has.
 *
 * `SeasonGrid` resolves liveries from the year it is handed rather than from
 * the `Liveries` context, which is what lets the grid editor preview a draft
 * the world has never seen — the reason `LiveryBadge` exists beside
 * `TeamBadge`, and this beside `TeamCar`.
 */
export function LiveryCar({
  livery,
  year,
  size = "small",
  animated = false,
  className,
}: {
  livery: Livery;
  /** Which decade's car. Outside a season, the newest. */
  year?: number | undefined;
  size?: CarSize;
  /** Turn the wheels. The champion cards and the track only. */
  animated?: boolean;
  className?: string | undefined;
}) {
  const sprite = carSpriteFor(year ?? Number.POSITIVE_INFINITY);
  const colours = coloursFor(livery);
  return (
    <svg
      // Decorative: wherever a car appears, the team is named in words beside it.
      aria-hidden="true"
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0", CAR_SIZES[size], className)}
    >
      <Pixels rows={sprite.rows} colours={colours} />
      {sprite.wheels.map((wheel) => (
        <g key={wheel.x} transform={`translate(${wheel.x} ${wheel.y})`}>
          {/*
            The turning is on an inner group so it pivots about the wheel's
            own centre (`fill-box`) rather than the corner of the canvas.
          */}
          <g
            className={
              animated
                ? "motion-safe:animate-wheel [transform-box:fill-box] [transform-origin:center]"
                : undefined
            }
          >
            <Pixels rows={wheelRows(wheel)} colours={colours} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** A team's car in the season in scope, from the `Liveries` context. */
export function TeamCar({
  teamId,
  size,
  animated,
  className,
}: {
  teamId: string;
  size?: CarSize;
  animated?: boolean;
  className?: string | undefined;
}) {
  const liveryOf = useLivery();
  const year = useSeasonYear();
  const livery = liveryOf(teamId);
  // Nothing for a team the seed data does not know, as `TeamBadge` does.
  if (livery === undefined) {
    return null;
  }
  return (
    <LiveryCar
      livery={livery}
      year={year}
      size={size ?? "small"}
      animated={animated ?? false}
      className={className}
    />
  );
}
