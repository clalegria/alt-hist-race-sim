---
paths:
  - "apps/web/src/lib/car-sprites.ts"
  - "apps/web/src/lib/car-sprites.test.ts"
  - "apps/web/src/components/TeamCar.tsx"
  - "apps/web/src/components/team-car.test.tsx"
  - "apps/web/src/lib/parade.ts"
  - "apps/web/src/lib/parade.test.ts"
  - "apps/web/src/components/HomeParade.tsx"
  - "apps/web/src/components/home-parade.test.tsx"
---

# The team car and the home parade

A pixel-art car per decade in a team's livery (`TeamCar`, `lib/car-sprites.ts`), and the
home screen's parade of them (`HomeParade`, `lib/parade.ts`).

## The car
- **Two sizes only, both whole multiples of the sprite** (`CAR_SIZES`). To make a car
  smaller, redraw it on a smaller canvas; never scale it. Only the champion cards and the
  parade use `large`, and only they turn the wheels.
- **A call site asks for a car** (`car`, default off). Unlike the badge, a round opened
  from the calendar draws cars (the author's call); the roll of honour's tables don't.
- **In a table the car has a column of its own** (`CAR_COLUMN`), never a fixed width in
  the name cell. A qualifying slot's time has a fixed width so "pole" cannot move its car.
- **A sprite character names a role, not a colour**; redraw a car by editing its strings.
  Wheels are generated (`wheelRows`), not drawn. Stripes follow the badge's `badgeStripes`.
- **The livery is drawn as authored, never through `legible()`**: the near-black outline
  is what keeps a car visible in both themes.
- **Fills go through `style`**: an SVG `fill` attribute does not accept `color-mix()`.
- **Wheels turn a quarter turn per step**, never a smooth spin, and only `motion-safe:`.

## The parade
- **It never touches the world**, so it may use `Math.random()`, passed in.
- **A new opaque surface on the home screen needs `PARADE_COVER`**: lanes are chosen clear
  of the covers, and with none open the pass runs in front of the page.
- **The layer never takes a click**; the page wins the pointer (`claimedByPage`). Behind
  is `z-index: -1` after the texture; in front is `z-30`, under the dialogs.
- **Keep both formations**: the author likes both, and the switching between them.
- **Pointer behaviour needs a real browser**; tests reach the state machine, the hit test
  and the label. `pnpm screenshots` runs with reduced motion, so it never shows a pass.
