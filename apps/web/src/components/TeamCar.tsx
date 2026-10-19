import type { Livery } from "@alt-hist/data";
import { useId } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type CarDrawing,
  type CarPart,
  type CarRole,
  carDrawingFor,
  circlePath,
  type Wheel,
} from "../lib/car-drawings.js";
import { cn } from "../lib/utils.js";
import { useLivery, useSeasonYear } from "./Liveries.js";

/**
 * A team's car: its decade's drawing painted in the team's livery, in ink
 * outline — flat colour inside one bold near-black outline, with a gloss
 * along the top of the bodywork.
 *
 * **Two sizes, and only two.** Every row, slot and panel that shows a car uses
 * `small`, so a car is the same size wherever it is met; only the champion
 * cards, the team and driver pages, the podium and the home screen's track use
 * `large`, and
 * only the champion cards and the track turn the wheels.
 *
 * **An inline SVG** rather than an `<img>`, because the colours are the team's
 * and are only known at render time, and because the page's own stylesheet can
 * then animate the wheels — including switching them off for a reader who has
 * asked their system for reduced motion (`motion-safe:`).
 *
 * **The outline is a fixed width on screen, not on the canvas**
 * (`vector-effect: non-scaling-stroke`), set per size: scaled with the drawing
 * it would be a hairline in a row and a slab on a card. It is drawn as one
 * shape under everything else — every part stroked and filled near-black — so
 * it rings the car's silhouette rather than every part inside it.
 *
 * The livery is used as authored, not pulled toward the theme as a chart's line
 * is (`.claude/rules/web-liveries.md`): this is a picture of the car, and every
 * colour of it sits inside the near-black outline, which is what keeps a white
 * car visible on the light theme. The outline is one colour in both themes;
 * dark against the dark card is still a clear step.
 */

/** The colours that do not come from the livery. */
const FIXED = {
  o: "#16181a",
  v: "#1f2a3d",
  c: "#2c2e31",
  x: "#5b5f64",
  m: "#bcc0c5",
  w: "#f4f3ef",
  // The helmet is the driver's, not the team's: one neutral colour on every car.
  h: "#d9dcdf",
} as const;

/** How far a primary colour is darkened for the underside of the body. */
const SHADE = 72;

/** The gloss along the top of the bodywork: how deep, in canvas units, and how strong. */
const GLOSS_DEPTH = 3;
const GLOSS_OPACITY = 0.42;

/** The glint on the helmet: its size as a share of the helmet, and its strength. */
const GLINT_SIZE = 0.22;
const GLINT_OPACITY = 0.55;

/** The visor's height as a share of the helmet's radius. */
const VISOR_HEIGHT = 0.48;

/** Spoke widths in canvas units: wire, and cast. */
const SPOKE_WIDTH = { wire: 0.7, cast: 2.4 } as const;

/** The hub's radius as a share of the rim's: a wire wheel's spinner is smaller. */
const HUB_SIZE = { wire: 0.24, cast: 0.3 } as const;

/**
 * A wire wheel's knock-off: a bar across the hub, its reach as a share of the
 * rim and its width in canvas units. Many identical thin spokes give the eye
 * nothing to follow, so the spokes are softened toward the rim and this is
 * what shows the wheel turning.
 */
const KNOCK_OFF = { reach: 0.55, width: 3.2 } as const;

/** How far a wire wheel's spokes are mixed toward the rim's colour. */
const WIRE_SPOKE_MIX = 50;

/** Each role's colour for this livery. Stripes follow the badge's count. */
function coloursFor(livery: Livery): Record<CarRole, string> {
  const { primaryColor, secondaryColor1, secondaryColor2, badgeStripes } = livery;
  const stripe1 = badgeStripes >= 1 ? secondaryColor1 : primaryColor;
  const stripe2 = badgeStripes >= 2 ? secondaryColor2 : stripe1;
  return {
    ...FIXED,
    P: primaryColor,
    p: `color-mix(in oklab, ${primaryColor} ${SHADE}%, black)`,
    "1": stripe1,
    "2": stripe2,
  };
}

/**
 * What a car looks like, as a string: its decade's drawing and the colours it
 * is painted. Two years with the same look draw the same picture.
 */
export function carLook(livery: Livery, year: number): string {
  const colours = coloursFor(livery);
  return [carDrawingFor(year).decade, colours.P, colours[1], colours[2]].join(" ");
}

function rect(x: number, y: number, width: number, height: number): string {
  return `M${x},${y}h${width}v${height}h${-width}Z`;
}

function Part({ part, colours }: { part: CarPart; colours: Record<CarRole, string> }) {
  // `style` rather than the `fill` attribute: an SVG presentation attribute
  // does not take `color-mix()`, a CSS property does.
  if (part.line !== undefined) {
    return (
      <path
        d={part.d}
        strokeLinecap="round"
        style={{ fill: "none", stroke: colours[part.role], strokeWidth: part.line }}
      />
    );
  }
  return <path d={part.d} style={{ fill: colours[part.role] }} />;
}

/**
 * The car's silhouette in near-black, stroked wide: drawn first, so what shows
 * of it is the band around the edge. Lines (`line`) are left out: the only
 * one is dark already.
 */
function Outline({ drawing, width }: { drawing: CarDrawing; width: number }) {
  const { helmet } = drawing;
  const shapes = [
    ...drawing.under.filter((part) => part.line === undefined).map((part) => part.d),
    drawing.body,
    ...drawing.over.filter((part) => part.line === undefined).map((part) => part.d),
    circlePath(helmet.cx, helmet.cy, helmet.r),
    ...drawing.wheels.map((wheel) => circlePath(wheel.cx, wheel.cy, wheel.r)),
  ];
  return (
    <g>
      {shapes.map((d) => (
        <path
          key={d}
          d={d}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          style={{ fill: FIXED.o, stroke: FIXED.o, strokeWidth: `${width}px` }}
        />
      ))}
    </g>
  );
}

/**
 * A wheel, centred on the origin so it turns about its own hub: tyre, rim,
 * spokes in the metal the rim is not (dark on a bright rim, bright on a dark
 * one) and a hub, and on a wire wheel a knock-off across it.
 */
function WheelShape({ wheel, colours }: { wheel: Wheel; colours: Record<CarRole, string> }) {
  const rim = wheel.r * wheel.rim;
  const kind = wheel.wire ? "wire" : "cast";
  const metal = wheel.rimRole === "m" ? colours.x : colours.m;
  const spoke = wheel.wire
    ? `color-mix(in oklab, ${metal} ${WIRE_SPOKE_MIX}%, ${colours[wheel.rimRole]})`
    : metal;
  const knockOff = rim * KNOCK_OFF.reach;
  // Every spoke in one path, out from the hub; the first points straight up.
  const spokes = Array.from({ length: wheel.spokes }, (_, i) => {
    const angle = (i / wheel.spokes) * 2 * Math.PI - Math.PI / 2;
    return `M0,0L${(rim * Math.cos(angle)).toFixed(2)},${(rim * Math.sin(angle)).toFixed(2)}`;
  }).join("");
  return (
    <>
      <circle r={wheel.r} style={{ fill: colours.o }} />
      <circle r={rim} style={{ fill: colours[wheel.rimRole] }} />
      <path
        d={spokes}
        strokeLinecap="round"
        style={{ fill: "none", stroke: spoke, strokeWidth: SPOKE_WIDTH[kind] }}
      />
      <circle r={rim * HUB_SIZE[kind]} style={{ fill: wheel.wire ? colours.m : colours.c }} />
      {wheel.wire && (
        <path
          d={`M${-knockOff},0L${knockOff},0`}
          strokeLinecap="round"
          style={{ fill: "none", stroke: metal, strokeWidth: KNOCK_OFF.width }}
        />
      )}
    </>
  );
}

/**
 * Width and height at each size, and the outline's width on screen. Exported
 * so tests can tell the sizes apart in a rendered tree.
 */
export const CAR_SIZES = {
  small: "h-3.5 w-12",
  large: "h-10.5 w-36",
} as const;

export type CarSize = keyof typeof CAR_SIZES;

/** The outline's width in screen pixels, per size. */
const OUTLINE_PX: Record<CarSize, number> = { small: 1.4, large: 3.2 };

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
  // Clip paths need ids unique on the page; `useId`'s own characters are not
  // all safe inside `url(#…)`.
  const id = useId().replace(/[^\w-]/g, "");
  const drawing = carDrawingFor(year ?? Number.POSITIVE_INFINITY);
  const colours = coloursFor(livery);
  const { helmet } = drawing;
  const [stripe1, stripe2, stripeEnd] = drawing.stripes;
  const [from, to] = drawing.stripeSpan ?? [0, CANVAS_WIDTH];
  const bodyClip = `url(#${id}-body)`;
  return (
    <svg
      // Decorative: wherever a car appears, the team is named in words beside it.
      aria-hidden="true"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      // The outline runs a little past the canvas at the wing tips and tyres.
      className={cn("shrink-0 overflow-visible", CAR_SIZES[size], className)}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d={drawing.body} />
        </clipPath>
        <clipPath id={`${id}-helmet`}>
          <circle cx={helmet.cx} cy={helmet.cy} r={helmet.r} />
        </clipPath>
      </defs>
      <Outline drawing={drawing} width={OUTLINE_PX[size]} />
      {drawing.under.map((part) => (
        <Part key={part.d} part={part} colours={colours} />
      ))}
      <path d={drawing.body} style={{ fill: colours.P }} />
      <g clipPath={bodyClip}>
        {/* The gloss: the body lightened, then repainted one step lower. */}
        <path d={drawing.body} opacity={GLOSS_OPACITY} style={{ fill: FIXED.w }} />
        <path
          d={drawing.body}
          transform={`translate(0 ${GLOSS_DEPTH})`}
          style={{ fill: colours.P }}
        />
        <path
          d={rect(0, drawing.shade, CANVAS_WIDTH, CANVAS_HEIGHT - drawing.shade)}
          style={{ fill: colours.p }}
        />
        <path d={rect(from, stripe1, to - from, stripe2 - stripe1)} style={{ fill: colours[1] }} />
        <path
          d={rect(from, stripe2, to - from, stripeEnd - stripe2)}
          style={{ fill: colours[2] }}
        />
      </g>
      {drawing.over.map((part) => (
        <Part key={part.d} part={part} colours={colours} />
      ))}
      <circle cx={helmet.cx} cy={helmet.cy} r={helmet.r} style={{ fill: colours.h }} />
      <path
        d={rect(helmet.cx, helmet.cy - helmet.r / 2, helmet.r, helmet.r * VISOR_HEIGHT)}
        clipPath={`url(#${id}-helmet)`}
        style={{ fill: colours.v }}
      />
      <circle
        cx={helmet.cx - helmet.r / 3}
        cy={helmet.cy - helmet.r / 2}
        r={helmet.r * GLINT_SIZE}
        opacity={GLINT_OPACITY}
        style={{ fill: FIXED.w }}
      />
      {drawing.top.map((part) => (
        <Part key={part.d} part={part} colours={colours} />
      ))}
      {drawing.wheels.map((wheel) => (
        <g key={wheel.cx} transform={`translate(${wheel.cx} ${wheel.cy})`}>
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
            <WheelShape wheel={wheel} colours={colours} />
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
