---
paths:
  - "apps/web/src/lib/car-sprites.ts"
  - "apps/web/src/lib/car-sprites.test.ts"
  - "apps/web/src/components/TeamCar.tsx"
  - "apps/web/src/components/team-car.test.tsx"
  - "apps/web/src/lib/parade.ts"
  - "apps/web/src/lib/parade.test.ts"
  - "apps/web/src/lib/track.ts"
  - "apps/web/src/lib/track.test.ts"
  - "apps/web/src/components/HomeTrack.tsx"
  - "apps/web/src/components/home-track.test.tsx"
---

# The team car and the home track

A pixel-art car per decade in a team's livery (`TeamCar`, `lib/car-sprites.ts`), and the
parade of them lapping the track along the foot of Home (`HomeTrack`, `lib/track.ts`,
`lib/parade.ts`).

## The car
- **Two sizes only, both whole multiples of the sprite** (`CAR_SIZES`). To make a car
  smaller, redraw it on a smaller canvas; never scale it. Only the champion cards and the
  track use `large`, and only they turn the wheels.
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

## The track
- **It never touches the world**, so it may use `Math.random()`, passed in.
- **The track is the parade's only road**: no car drives over the page.
- **`Shell`'s `foot` is where it sits**: full width between the column and the footer;
  the column grows, so on a desktop it meets the bottom of the window.
- **The field is stepped in `lib/track.ts`, not animated in CSS**: the cars react to one
  another. Keep the step pure and every rule in `stepField`; the component only feeds it
  frames and the pointer.
- **No two cars ever overlap**: a car brakes at once for whatever is ahead in any lane it
  takes up, and pulls out only into a lane clear around it.
- **Keep both formations**: the field leaves the grid in file or in echelon, and a car
  pulls out only once the queue ahead is led by a car at its pace, so a file leaves as one.
- **With reduced motion the field stands still, spread along the track**, which is also
  what `pnpm screenshots` shows. The hidden game still names and turns the cars.
- **Pointer behaviour needs a real browser**; tests reach the field, the hit test, the
  game and the label.
