/**
 * The pixel-art team cars: one side-on sprite per decade.
 *
 * **Authored as text, one character per pixel**, so a sprite can be read and
 * redrawn in an editor without a drawing tool. Each character names a *role*
 * rather than a colour — `P` is "the team's primary colour", not red — so one
 * drawing serves every team, and the livery is applied when it is rendered
 * (`TeamCar.tsx`). Every sprite is the same size, which lets them all be
 * scaled by the same whole number and keeps the pixels square and crisp.
 *
 * The wheels are not in the drawing. They are generated here from a size and
 * drawn over the body, because they are the part that moves: each is rotated a
 * quarter turn at a time, which on a square grid of pixels maps every pixel
 * exactly onto another — the only rotation pixel art survives without blurring.
 *
 * Display only, like `livery.ts`: nothing here reaches the engine.
 */

/**
 * What each character in a sprite stands for.
 *
 * - `o` outline and tyres; `.` nothing
 * - `P` primary colour, `p` the same colour in shadow
 * - `1` / `2` the two stripes — which colours they take follows the badge
 * - `h` helmet, `v` visor
 * - `c` carbon, `x` dark metal, `m` bright metal, `w` white
 */
export type PixelRole = "o" | "P" | "p" | "1" | "2" | "h" | "v" | "c" | "x" | "m" | "w";

export const PIXEL_ROLES: readonly PixelRole[] = [
  "o",
  "P",
  "p",
  "1",
  "2",
  "h",
  "v",
  "c",
  "x",
  "m",
  "w",
];

/** The canvas every sprite is drawn on, in sprite pixels. */
export const SPRITE_WIDTH = 48;
export const SPRITE_HEIGHT = 14;

export interface Wheel {
  /** Top-left corner on the sprite's canvas. */
  readonly x: number;
  readonly y: number;
  /** Diameter in pixels. Odd, so the hub is a single pixel to turn about. */
  readonly size: number;
  /** How far out the rim reaches, in pixels from the hub; the rest is tyre. */
  readonly rim: number;
  /** What the rim is made of. */
  readonly rimRole: PixelRole;
}

export interface CarSprite {
  /** The decade it stands for, e.g. 1970. */
  readonly decade: number;
  readonly rows: readonly string[];
  readonly wheels: readonly Wheel[];
}

/** A run of same-role pixels along one row: the unit the sprite is drawn in. */
export interface PixelRun {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

// Front-engined cigar: tall wire wheels, the driver sitting up behind a long
// bonnet, a white roundel for the race number and the exhaust down the side.
const FIFTIES: CarSprite = {
  decade: 1950,
  rows: [
    "................................................",
    "................oooo............................",
    "...............ohhhho...........................",
    "...............ohhvvo.om........................",
    "..........oooooohhhhooom........................",
    ".......oooPPPPPPooooooooooooooooooooooooo.......",
    ".....ooPPPPPPPPPPPPPPPPPPoooooPPPPPPPPPPPoo.....",
    "...ooPPPPPPPPPPPPPPPPPPPowwwwwoPPPPPPPPPPPPoo...",
    "..oPP1111111111111111111owwwwwo11111111111PPPoo.",
    "..oPP2222222222222222222owwwwwo22222222222PPPPox",
    "..opPPPPPPPPmmmmmmmmPPPPPowwwoPPPPPPPPPPPPPPPPox",
    "...oppppppppppppppppppppppooopppppppppppppppppo.",
    "....ooooooooooooooooooooooooooooooooooooooooooo.",
    "................................................",
  ],
  wheels: [
    { x: 6, y: 5, size: 9, rim: 2, rimRole: "m" },
    { x: 34, y: 5, size: 9, rim: 2, rimRole: "m" },
  ],
};

// Rear-engined and slim: the driver lying back behind a wraparound screen, the
// engine bare behind him with its exhausts curling up.
const SIXTIES: CarSprite = {
  decade: 1960,
  rows: [
    "................................................",
    "................................................",
    "....................oooo........................",
    "...................ohhhho.o.....................",
    "...m.m.m...........ohhvvoom.....................",
    "..ommmmmmmoooooooooohhhhoooooooooo..............",
    ".oxxxxxxxxxxxxoPPPPPPPPPPPPPPPPPPPoooooo........",
    ".oxxxxxxxxxxxoP11111111111111111111PPPPPooo.....",
    ".oPPPPPPPPPPPPP22222222222222222222PPPPPPPPPoo..",
    "..opPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPoxo",
    "...opppppppppppppppppppppppppppppppppppppppppoo.",
    "....ooooooooooooooooooooooooooooooooooooooooo...",
    "................................................",
    "................................................",
  ],
  wheels: [
    { x: 4, y: 5, size: 9, rim: 2, rimRole: "m" },
    { x: 34, y: 5, size: 9, rim: 2, rimRole: "m" },
  ],
};

// The wedge: huge rear tyres and small fronts, a tall airbox over the
// driver's head and the rear wing up on a pillar behind the gearbox.
const SEVENTIES: CarSprite = {
  decade: 1970,
  rows: [
    "oooooooooo......................................",
    "o11111111o......oooooo..........................",
    "oPPPPPPPPo.....oPPPPPPo.........................",
    ".ooooxoooo.....oPPPvvPo.oooo....................",
    ".oxo...........oPPPPPPoohhvvo...................",
    ".oxo..........ooPPPPPPPPhhhhoooooooo............",
    "ooxo.........oPPPPPPPPPPPPPPPPPPPPPPoooooooo....",
    "oxxx.........oPP1111111111111111111111PPPPPPoo..",
    "oxxx.........oPP2222222222222222222222PPPPPPPPoo",
    "oooo.........opPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPo",
    "..............oppppppppppppppppppppppppppppppppo",
    "...............ooooooooooooooooooooooo..oooooooo",
    ".......................................o111111o.",
    ".......................................oooooooo.",
  ],
  wheels: [
    { x: 3, y: 3, size: 11, rim: 3, rimRole: "m" },
    { x: 35, y: 7, size: 7, rim: 2, rimRole: "m" },
  ],
};

// Low and flat: long sidepods, the driver lying almost out of sight, a short
// rear wing and a flat front wing at the tip of a long nose.
const EIGHTIES: CarSprite = {
  decade: 1980,
  rows: [
    "................................................",
    "ooooooo.........................................",
    "o11111o.........................................",
    "oPPPPPo..........ooo.oooo.......................",
    "oPPPPPo.........oPPPoohvvo......................",
    "oppppp.oooooooooPPPPPPhhhhoooooo................",
    ".ooooooPPPPPPPPPPPPPPPPPPPPPPPPPoooooo..........",
    "......oPP1111111111111111111111PPPPPPPoooooo....",
    "......oPP2222222222222222222222PPPPPPPPPPPPPoo..",
    "......opPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPo.",
    ".......oppppppppppppppppppppppppppppppppppppppo.",
    "........ooooooooooooooooooooooooooooo...oooooooo",
    ".......................................o111111o.",
    ".......................................oooooooo.",
  ],
  wheels: [
    { x: 2, y: 5, size: 9, rim: 2, rimRole: "m" },
    { x: 35, y: 5, size: 9, rim: 2, rimRole: "m" },
  ],
};

// The raised nose with the front wing hung beneath it, an airbox over the
// driver and a tall rear wing.
const NINETIES: CarSprite = {
  decade: 1990,
  rows: [
    "................................................",
    "oooooo..........................................",
    "o1111o..........ooooo...........................",
    "oPPPPo.........oPPPPPo..........................",
    "oPPPPo........oPPPoPPoooo.......................",
    "oPPPPo.......oPPPPPPPohvvo......................",
    "opppp.ooooooPPPPPPPPPPhhhhooooooooo.............",
    ".ooooPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPoooooooooo...",
    ".....oPP111111111111111111111111111PPPPPPPPPPoo.",
    ".....oPP222222222222222222222222222PPPPPPPPPPPPo",
    ".....opPPPPPPPPPPPPPPPPPPPPPPPPPPPPoooooooooooo.",
    "......oopppppppppppppppppppppppppppo....oo......",
    "........occcccccccccccccccccccccccco.oooooooooo.",
    "........ooooooooooooooooooooooooooooo.o11111111o",
  ],
  wheels: [
    { x: 2, y: 5, size: 9, rim: 2, rimRole: "x" },
    { x: 35, y: 5, size: 9, rim: 2, rimRole: "x" },
  ],
};

// Still a high nose, but sharper and busier: bargeboards behind the front
// wheel, chimneys on the sidepods, a bigger airbox.
const NOUGHTIES: CarSprite = {
  decade: 2000,
  rows: [
    "oooooo..........................................",
    "o1111o..........oooooo..........................",
    "oPPPPo.........oPPPPPPo.........................",
    "oPPPPo........oPPPooPPo.ooo.....................",
    "oPPPPo.......oPPPPPPPPoohvvo....................",
    "oPPPPo......oPPPPPPPPPPhhhhoo...................",
    "opppp.oooooPPPPPPPPoccoPPPPPoooooooo............",
    ".ooooPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPoooooooooo.",
    ".....oPP111111111111111111111111111PPPPPPPPPPPPo",
    ".....oPP222222222222222222222222222PPPPPPPPPPPPo",
    ".....opPPPPPPPPPPPPPPPPPPPPPPPPPPPPooooooooooooo",
    "......ooppppppppppppppppppppppppcccco....oo.....",
    "........occcccccccccccccccccccccccco..ooooooooo.",
    "........ooooooooooooooooooooooooooooo.oc1111111o",
  ],
  wheels: [
    { x: 2, y: 5, size: 9, rim: 2, rimRole: "x" },
    { x: 35, y: 5, size: 9, rim: 2, rimRole: "x" },
  ],
};

// Long and low-nosed, with the shark fin down the engine cover and a wide,
// flat rear wing.
const TENS: CarSprite = {
  decade: 2010,
  rows: [
    "................................................",
    "ooooooo.........................................",
    "o11111o.........oooo............................",
    "oPPPPPo...oooooooPPPo...........................",
    "oPPPPPo.ooPPPPPPPPoPPo.ooo......................",
    "oPPPPPooPPPPPPPPPPPPPoohvvo.....................",
    "opppppPPPPPPPPPPPPPPPPPhhhhooooooooo............",
    ".ooooPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPoooooooo...",
    ".....oPP111111111111111111111111111PPPPPPPPPPoo.",
    ".....oPP222222222222222222222222222PPPPPPPPPPPPo",
    ".....opPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPo",
    "......oopppppppppppppppppppppppppppppppppppppppo",
    "........occcccccccccccccccccccccccco.oooooooooo.",
    "........ooooooooooooooooooooooooooooo.o11111111o",
  ],
  wheels: [
    { x: 2, y: 5, size: 9, rim: 2, rimRole: "x" },
    { x: 34, y: 5, size: 9, rim: 2, rimRole: "x" },
  ],
};

// Ground-effect again: the halo over the cockpit, sidepods cut away beneath,
// and eighteen-inch wheels — more rim, less tyre.
const TWENTIES: CarSprite = {
  decade: 2020,
  rows: [
    "................................................",
    "oooooo..........................................",
    "o1111o..........................................",
    "oPPPPo..............ooooo.......................",
    "oPPPPo.............oPPPPPoooooo.................",
    "oPPPPo............oPPPPPPohhv.o.................",
    "oppppo.....oooooooPPPPPPPhhhhhoooo..............",
    ".ooooooooooPPPPPPPPPPPPPPPPPPPPPPPPooooo........",
    ".....oPPPPPP11111111111111111PPPPPPPPPPPoooooo..",
    ".....oPPPPPP22222222222222222PPPPPPPPPPPPPPPPPoo",
    ".....oppppppPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPo",
    "......ooooooppppppppppppppppppppppppppppppppppo.",
    "...........occcccccccccccccccccccccco.oPPPPPPPPo",
    "...........oooooooooooooooooooooooooo.o1111111o.",
  ],
  wheels: [
    { x: 3, y: 5, size: 9, rim: 3, rimRole: "x" },
    { x: 34, y: 5, size: 9, rim: 3, rimRole: "x" },
  ],
};

/** Oldest first; `carSpriteFor` relies on the order. */
export const CAR_SPRITES: readonly CarSprite[] = [
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
export function carSpriteFor(year: number): CarSprite {
  let found = CAR_SPRITES[0] as CarSprite;
  for (const sprite of CAR_SPRITES) {
    if (sprite.decade <= year) {
      found = sprite;
    }
  }
  return found;
}

/**
 * A wheel as rows in the same alphabet as a sprite, so both are drawn by the
 * same code: tyre outside the rim, a dark hub at the centre, and one bright
 * spoke pointing straight up from it.
 *
 * The spoke is the only thing that is not symmetric, so it is what the eye
 * follows as the wheel turns. Its colour is fixed: bright metal on a dark rim,
 * dark metal on a bright one.
 */
export function wheelRows(wheel: Wheel): string[] {
  const centre = (wheel.size - 1) / 2;
  // A shade over the radius rounds the circle out: exactly `centre` leaves
  // single pixels poking out at the four points of the compass.
  const outer = centre + 0.4;
  const spoke: PixelRole = wheel.rimRole === "m" ? "x" : "m";
  const rows: string[] = [];
  for (let y = 0; y < wheel.size; y++) {
    let row = "";
    for (let x = 0; x < wheel.size; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      if (distance > outer) {
        row += ".";
      } else if (distance > wheel.rim + 0.4) {
        row += "o";
      } else if (distance < 0.5) {
        row += "x";
      } else if (x === centre && y < centre) {
        row += spoke;
      } else {
        row += wheel.rimRole;
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Every run of same-role pixels in a drawing, grouped by role.
 *
 * Runs rather than single pixels because each role becomes one SVG path, and a
 * row of forty body pixels is then one rectangle rather than forty. Unknown
 * characters are skipped, not thrown on: a typo in a sprite should leave a
 * hole, not take the season summary down with it. A test holds the sprites to
 * the alphabet instead.
 */
export function pixelRuns(rows: readonly string[]): Map<PixelRole, PixelRun[]> {
  const runs = new Map<PixelRole, PixelRun[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const role = row[x] as PixelRole;
      let end = x + 1;
      while (end < row.length && row[end] === role) {
        end++;
      }
      if (PIXEL_ROLES.includes(role)) {
        const list = runs.get(role) ?? [];
        list.push({ x, y, width: end - x });
        runs.set(role, list);
      }
      x = end;
    }
  });
  return runs;
}

/** A role's runs as one SVG path: a one-pixel-tall rectangle per run. */
export function runsPath(runs: readonly PixelRun[]): string {
  return runs.map(({ x, y, width }) => `M${x} ${y}h${width}v1h${-width}z`).join("");
}
