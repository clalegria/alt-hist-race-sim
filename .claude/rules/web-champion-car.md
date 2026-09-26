---
paths:
  - "apps/web/src/lib/car-sprites.ts"
  - "apps/web/src/lib/car-sprites.test.ts"
  - "apps/web/src/components/ChampionCar.tsx"
  - "apps/web/src/components/champion-car.test.tsx"
---

# Web app — the champion car

Both champion cards on the season summary draw a pixel-art car, in the champion
team's livery, with its wheels turning. There is one sprite per decade (1950s–2020s),
chosen by `carSpriteFor(year)`, which falls back to the nearest decade outside that range.

## Sprites are text

`lib/car-sprites.ts` holds each car as 16 strings of 64 characters, one character per
pixel. **A character names a role, not a colour** (`P` primary, `1`/`2` stripes, `h`
helmet, `o` outline and tyres; the full list is on `PixelRole`), so one drawing serves
every team. To redraw a car, edit its strings. The tests hold every sprite to the shared
canvas and the alphabet, keep every wheel on the ground row, and require one sprite per
decade in `SEASON_DECADES`. None of them checks what a car looks like.

**Wheels are not in the drawing.** `wheelRows` generates them from a size, a rim radius
and a rim material, and they are drawn over the body. Sizes are odd so the hub is one
pixel to turn about.

## Colour

`ChampionCar` resolves roles to colours. The stripes follow the badge's rule: `1` and
`2` take the accents only as far as `badgeStripes` allows, and otherwise fall back to
the primary, so a car never shows an accent that its badge hides. The helmet always
wears the first accent.

**This is the one place a livery is drawn as authored**, not pulled toward the theme
(`web-liveries.md`). It is a picture of a car, and a near-black outline, the same colour
in both themes, is what keeps a white car visible on the light theme and a black one
visible on the dark card.

## Drawing and motion

- It is an **inline SVG with one `<path>` per role**, built from runs of same-role
  pixels, with `crispEdges`. Fills go through `style`, because the shade is a
  `color-mix()` and an SVG `fill` attribute does not accept one.
- It sits **after the card's words**, so the flag test's "between label and name" window
  never sees its `<svg>`. The tables' flag counts are scoped by heading and do not
  reach the cards either.
- It is drawn at **exactly 3× (`w-48 h-12`)**; any other size makes the pixels uneven.
  It sits beside the words from `lg` and beneath them, right-aligned, below that.
- **The wheels turn a quarter turn per step** (`--animate-wheel` in `index.css`,
  `steps(4)`). A quarter turn maps every pixel exactly onto another, and a smooth spin
  would blur them. A test requires every wheel to look the same after a quarter turn
  apart from its one spoke, which is what the eye follows. The animation is
  `motion-safe:`, so it stops for a reader who asks for reduced motion.
