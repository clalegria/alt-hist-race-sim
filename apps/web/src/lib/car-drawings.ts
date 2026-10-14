/**
 * The team cars: one side-on vector drawing per decade, nose to the right.
 *
 * **Each part names a *role* rather than a colour**: `P` is "the team's primary
 * colour", not red, so one drawing serves every team and the livery is applied
 * when it is rendered (`TeamCar.tsx`). Every drawing is on the same canvas, so
 * cars from different decades stand the same size and on the same ground.
 *
 * A drawing is layered, back to front: `under` (floors, gearboxes), the body
 * with its shading and stripes clipped to it, `over` (wings, airboxes,
 * roundels), the driver's helmet, `top` (screens, the halo), then the wheels.
 * The wheels are described rather than drawn, because they are the part that
 * moves: `TeamCar` builds each from its size and turns it.
 *
 * Display only, like `livery.ts`: nothing here reaches the engine.
 */

/**
 * What a part is painted in.
 *
 * - `P` primary colour, `p` the same colour in shadow
 * - `1` / `2` the two stripes — which colours they take follows the badge
 * - `h` helmet, `v` visor
 * - `o` outline and tyres, `c` carbon, `x` dark metal, `m` bright metal, `w` white
 */
export type CarRole = "o" | "P" | "p" | "1" | "2" | "h" | "v" | "c" | "x" | "m" | "w";

/** The canvas every car is drawn on, in canvas units. */
export const CANVAS_WIDTH = 240;
export const CANVAS_HEIGHT = 70;

/** Where every tyre touches the road, so cars side by side stand level. */
export const GROUND = 69;

export interface CarPart {
  /** An SVG path on the canvas. */
  readonly d: string;
  readonly role: CarRole;
  /** A stroke width in canvas units: the part is a line, not a filled shape. */
  readonly line?: number;
}

export interface Wheel {
  /** Centre on the canvas. */
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** How far out the rim reaches, as a share of the radius; the rest is tyre. */
  readonly rim: number;
  /** What the rim is made of. */
  readonly rimRole: "m" | "x";
  readonly spokes: number;
  /** Thin wire spokes rather than the few thick ones of a cast wheel. */
  readonly wire: boolean;
}

export interface Helmet {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface CarDrawing {
  /** The decade it stands for, e.g. 1970. */
  readonly decade: number;
  /** The bodywork's outline: painted `P`, and the clip for shading and stripes. */
  readonly body: string;
  /** Below this the body is in shadow (`p`). */
  readonly shade: number;
  /** The tops of stripe 1 and stripe 2, and the bottom of stripe 2. */
  readonly stripes: readonly [number, number, number];
  /** Where along the body the stripes run; the whole length when absent. */
  readonly stripeSpan?: readonly [number, number];
  readonly under: readonly CarPart[];
  readonly over: readonly CarPart[];
  readonly helmet: Helmet;
  readonly top: readonly CarPart[];
  readonly wheels: readonly Wheel[];
}

/** A circle as a path, so it can sit in a part list or an outline. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
}

function rect(x: number, y: number, width: number, height: number): string {
  return `M${x},${y}h${width}v${height}h${-width}Z`;
}

// Front-engined cigar: tall wire wheels, the driver sitting up behind a long
// bonnet, a white roundel for the race number and the exhaust down the side.
const FIFTIES: CarDrawing = {
  decade: 1950,
  body: "M6,45 C10,35 30,29 56,28 L196,27 C222,27 236,35 236,45 C236,55 222,61 200,61 L40,61 C22,61 8,53 6,45Z",
  shade: 55,
  stripes: [40, 45, 50],
  under: [],
  over: [
    { d: "M56,29 C62,19 74,16 84,20 L86,29Z", role: "P" },
    { d: circlePath(142, 44, 10), role: "w" },
    {
      d: "M222,37 C230,38 233,42 233,45 C233,48 230,52 222,53 C224,48 224,42 222,37Z",
      role: "o",
    },
    { d: "M64,55 L128,55 C131,55 131,59 128,59 L64,59Z", role: "m" },
  ],
  helmet: { cx: 94, cy: 20, r: 9 },
  top: [{ d: "M104,28 L107,17 L113,17 L113,28Z", role: "m" }],
  wheels: [
    { cx: 52, cy: 48, r: 21, rim: 0.7, rimRole: "m", spokes: 16, wire: true },
    { cx: 192, cy: 48, r: 21, rim: 0.7, rimRole: "m", spokes: 16, wire: true },
  ],
};

// Rear-engined and slim: the driver lying back behind a wraparound screen, the
// engine bare between the cockpit and the rear wheel with its intakes standing
// up, and the exhaust out past the back. Shorter than the cars either side.
const SIXTIES: CarDrawing = {
  decade: 1960,
  body: "M26,50 C26,43 32,40 44,39 L80,37 C100,34 120,33 146,33 C182,33 208,38 220,45 C224,48 222,52 216,54 L44,57 C32,57 26,55 26,50Z",
  shade: 52,
  stripes: [38, 43, 48],
  stripeSpan: [76, 190],
  under: [{ d: "M12,45 L36,45 L36,49 L12,49 L10,47Z", role: "m" }],
  over: [
    { d: "M76,37 L78,28 L100,28 L102,35Z", role: "x" },
    { d: rect(80, 22, 3, 6), role: "m" },
    { d: rect(87, 22, 3, 6), role: "m" },
    { d: rect(94, 22, 3, 6), role: "m" },
    { d: "M217,45 C222,47 222,51 217,53Z", role: "o" },
  ],
  helmet: { cx: 117, cy: 25, r: 8.5 },
  top: [{ d: "M128,33 L132,22 L138,22 L137,33Z", role: "m" }],
  wheels: [
    { cx: 54, cy: 48, r: 21, rim: 0.62, rimRole: "m", spokes: 12, wire: true },
    { cx: 186, cy: 49, r: 20, rim: 0.62, rimRole: "m", spokes: 12, wire: true },
  ],
};

// The wedge: huge rear tyres and small fronts, a tall airbox over the
// driver's head and the rear wing up on a pillar behind the gearbox.
const SEVENTIES: CarDrawing = {
  decade: 1970,
  body: "M64,52 L64,36 C64,33 66,31 70,31 L150,31 C172,31 204,37 238,44 L238,50 L232,56 L70,57 C66,57 64,55 64,52Z",
  shade: 51,
  stripes: [37, 42, 47],
  under: [
    { d: rect(0, 30, 22, 22), role: "x" },
    { d: "M20,14 L28,14 L30,40 L22,40Z", role: "x" },
  ],
  over: [
    { d: "M2,6 L50,3 L50,16 L2,17Z", role: "P" },
    { d: "M2,6 L50,3 L50,8 L2,10Z", role: "1" },
    { d: rect(0, 1, 5, 19), role: "o" },
    {
      d: "M76,32 L80,9 C81,6 83,5 86,5 L108,5 C112,5 114,7 114,10 L118,32Z",
      role: "P",
    },
    { d: "M104,10 L112,10 L112,19 L106,19Z", role: "v" },
    { d: "M206,57 L238,55 L238,66 L206,66Z", role: "1" },
    { d: rect(233, 52, 5, 16), role: "o" },
  ],
  helmet: { cx: 130, cy: 25, r: 8.5 },
  top: [{ d: "M142,31 L146,24 L150,24 L150,31Z", role: "m" }],
  wheels: [
    { cx: 42, cy: 42, r: 27, rim: 0.56, rimRole: "m", spokes: 5, wire: false },
    { cx: 192, cy: 53, r: 16, rim: 0.56, rimRole: "m", spokes: 5, wire: false },
  ],
};

// Low and flat: long sidepods sealed to the road by skirts, the driver lying
// almost out of sight, a short rear wing and a flat front wing.
const EIGHTIES: CarDrawing = {
  decade: 1980,
  body: "M30,50 L30,32 L150,30 C175,30 205,36 236,44 L236,52 L180,56 L40,58 C34,58 30,55 30,50Z",
  shade: 52,
  stripes: [36, 41, 46],
  stripeSpan: [40, 160],
  under: [
    { d: rect(0, 44, 32, 8), role: "c" },
    { d: rect(22, 24, 6, 10), role: "x" },
    { d: rect(40, 56, 140, 4), role: "c" },
  ],
  over: [
    { d: rect(1, 5, 30, 20), role: "P" },
    { d: rect(1, 5, 30, 6), role: "1" },
    { d: rect(0, 3, 5, 47), role: "c" },
    { d: "M70,31 C78,22 90,20 100,22 L104,31Z", role: "P" },
    { d: "M196,58 L238,56 L238,65 L196,65Z", role: "1" },
    { d: rect(233, 52, 5, 15), role: "o" },
  ],
  helmet: { cx: 114, cy: 25, r: 7.5 },
  top: [{ d: "M124,30 L128,23 L133,23 L133,30Z", role: "m" }],
  wheels: [
    { cx: 32, cy: 47, r: 22, rim: 0.56, rimRole: "m", spokes: 5, wire: false },
    { cx: 197, cy: 47, r: 22, rim: 0.56, rimRole: "m", spokes: 5, wire: false },
  ],
};

// The raised nose with the front wing hung beneath it, an airbox over the
// driver and a tall rear wing.
const NINETIES: CarDrawing = {
  decade: 1990,
  body: "M26,50 L26,38 L60,35 L172,35 L238,42 L238,49 L178,52 L176,57 L40,58 C32,58 26,55 26,50Z",
  shade: 52,
  stripes: [40, 45, 50],
  under: [
    { d: rect(0, 44, 30, 8), role: "c" },
    { d: "M40,58 L176,57 L176,63 L46,64Z", role: "c" },
    { d: rect(212, 48, 5, 14), role: "c" },
  ],
  over: [
    { d: rect(1, 4, 28, 22), role: "P" },
    { d: rect(1, 4, 28, 6), role: "1" },
    { d: rect(0, 2, 5, 48), role: "c" },
    {
      d: "M64,36 C70,22 80,12 92,10 L104,10 C108,10 110,13 110,16 L112,36Z",
      role: "P",
    },
    { d: circlePath(103, 17, 3.2), role: "o" },
    { d: "M206,61 L239,60 L239,68 L206,68Z", role: "1" },
    { d: rect(234, 56, 5, 13), role: "o" },
  ],
  helmet: { cx: 120, cy: 31, r: 8 },
  top: [],
  wheels: [
    { cx: 32, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
    { cx: 197, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
  ],
};

// A high, needle nose with a two-plane front wing hung beneath it,
// bargeboards behind the front wheel, a tall narrow rear wing, and a low
// engine cover rising only to a small intake behind the driver's head.
const NOUGHTIES: CarDrawing = {
  decade: 2000,
  body: "M26,50 L26,39 L60,36 L166,34 L238,39 L238,45 L180,49 L176,57 L40,58 C32,58 26,55 26,50Z",
  shade: 52,
  stripes: [39, 44, 49],
  under: [
    { d: rect(0, 44, 30, 8), role: "c" },
    { d: "M40,58 L176,57 L176,63 L46,64Z", role: "c" },
    { d: rect(214, 44, 4, 17), role: "c" },
  ],
  over: [
    { d: rect(1, 1, 24, 24), role: "P" },
    { d: rect(1, 1, 24, 6), role: "1" },
    { d: rect(0, 0, 5, 50), role: "c" },
    {
      d: "M28,38 C50,35 74,29 94,22 C102,19 110,18 114,20 C117,22 118,26 118,30 L120,36Z",
      role: "P",
    },
    { d: circlePath(113, 24, 2.6), role: "o" },
    { d: "M156,52 L174,50 L174,58 L158,58Z", role: "c" },
    { d: "M210,56 L237,54 L237,58 L210,59Z", role: "1" },
    { d: "M200,61 L239,60 L239,64 L200,65Z", role: "1" },
    { d: rect(234, 52, 5, 17), role: "o" },
  ],
  helmet: { cx: 128, cy: 31, r: 7.5 },
  top: [],
  wheels: [
    { cx: 32, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
    { cx: 197, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
  ],
};

// Long and low-nosed, with the engine cover sweeping smoothly up to a small
// rounded intake, and a wide, flat rear wing.
const TENS: CarDrawing = {
  decade: 2010,
  body: "M26,50 L26,38 L60,36 L170,35 L238,45 L238,53 L178,56 L176,58 L40,58 C32,58 26,55 26,50Z",
  shade: 53,
  stripes: [40, 45, 50],
  stripeSpan: [40, 175],
  under: [
    { d: rect(0, 44, 30, 8), role: "c" },
    { d: "M40,58 L176,57 L176,63 L46,64Z", role: "c" },
  ],
  over: [
    { d: rect(1, 5, 32, 20), role: "P" },
    { d: rect(1, 5, 32, 6), role: "1" },
    { d: rect(0, 3, 5, 47), role: "c" },
    {
      d: "M30,38 C54,35 82,28 102,22 C108,19 115,18 118,22 C120,25 121,30 121,36Z",
      role: "P",
    },
    { d: circlePath(115, 24, 2.6), role: "o" },
    { d: "M200,60 L239,59 L239,68 L200,68Z", role: "1" },
    { d: rect(235, 55, 4, 14), role: "o" },
  ],
  helmet: { cx: 131, cy: 30, r: 7.5 },
  top: [],
  wheels: [
    { cx: 32, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
    { cx: 192, cy: 47, r: 22, rim: 0.56, rimRole: "x", spokes: 5, wire: false },
  ],
};

// Ground-effect again: the halo over the cockpit, sidepods cut away beneath,
// and eighteen-inch wheels — more rim, less tyre.
const TWENTIES: CarDrawing = {
  decade: 2020,
  body: "M28,50 L28,39 L56,36 L160,35 C190,37 214,40 238,44 L238,51 L172,55 L62,58 C40,58 28,55 28,50Z",
  shade: 53,
  stripes: [41, 46, 51],
  stripeSpan: [58, 150],
  under: [
    { d: rect(0, 44, 32, 8), role: "c" },
    { d: "M62,58 L176,55 L178,62 L66,63Z", role: "c" },
  ],
  over: [
    { d: rect(1, 4, 26, 22), role: "P" },
    { d: rect(1, 4, 26, 5), role: "1" },
    { d: rect(0, 2, 5, 48), role: "c" },
    {
      d: "M58,37 C76,26 94,18 110,17 L126,17 C131,17 133,21 133,26 L134,36Z",
      role: "P",
    },
    { d: "M125,18 L131,18 L132,26 L125,26Z", role: "v" },
    { d: "M200,58 L239,57 L239,66 L200,66Z", role: "P" },
    { d: rect(200, 62, 39, 4), role: "1" },
  ],
  helmet: { cx: 142, cy: 31, r: 7.5 },
  top: [{ d: "M132,24 C142,19 156,21 164,36", role: "c", line: 3 }],
  wheels: [
    { cx: 37, cy: 47, r: 22, rim: 0.7, rimRole: "x", spokes: 5, wire: false },
    { cx: 192, cy: 47, r: 22, rim: 0.7, rimRole: "x", spokes: 5, wire: false },
  ],
};

/** Oldest first; `carDrawingFor` relies on the order. */
export const CAR_DRAWINGS: readonly CarDrawing[] = [
  FIFTIES,
  SIXTIES,
  SEVENTIES,
  EIGHTIES,
  NINETIES,
  NOUGHTIES,
  TENS,
  TWENTIES,
];

/**
 * The car for a season: its decade's, clamped to the ones drawn, so a run that
 * simulates past the last decade keeps the newest car rather than drawing none.
 */
export function carDrawingFor(year: number): CarDrawing {
  let found = CAR_DRAWINGS[0] as CarDrawing;
  for (const drawing of CAR_DRAWINGS) {
    if (drawing.decade <= year) {
      found = drawing;
    }
  }
  return found;
}
