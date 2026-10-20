---
paths:
  - "apps/web/src/lib/car-drawings.ts"
  - "apps/web/src/lib/car-drawings.test.ts"
  - "apps/web/src/components/TeamCar.tsx"
  - "apps/web/src/components/team-car.test.tsx"
  - "apps/web/src/lib/car-showcase.ts"
  - "apps/web/src/lib/car-showcase.test.ts"
  - "apps/web/src/lib/parade.ts"
  - "apps/web/src/lib/parade.test.ts"
  - "apps/web/src/lib/track.ts"
  - "apps/web/src/lib/track.test.ts"
  - "apps/web/src/components/HomeTrack.tsx"
  - "apps/web/src/components/home-track.test.tsx"
---

# The team car and the home track

A vector car per decade in a team's livery, drawn in ink outline (`TeamCar`,
`lib/car-drawings.ts`), and the parade of them lapping the track along the foot of Home
(`HomeTrack`, `lib/track.ts`, `lib/parade.ts`).

## The car
- **Two sizes only** (`CAR_SIZES`), so a car is the same size wherever it is met. Only the
  champion cards, the team and driver pages, the podium and the track use `large`; only the champion
  cards and the track turn the wheels.
- **One outline around the silhouette, a fixed width on screen per size** (`OUTLINE_PX`,
  `non-scaling-stroke`). It is every shape stroked near-black under the paint; never
  outline parts one by one.
- **Every drawing shares the canvas and the ground** (`GROUND`): a tyre's bottom sits on
  it, so cars of different decades stand level side by side.
- **A call site asks for a car** (`car`, default off). Unlike the badge, a round opened
  from the calendar draws cars (the author's call); the roll of honour's tables don't.
- **In a table the car has a column of its own** (`CAR_COLUMN`), never a fixed width in
  the name cell. A qualifying slot's time has a fixed width so "pole" cannot move its car.
- **A part names a role, not a colour**; redraw a car by editing its paths. Wheels are
  described (size, rim, spokes) and built by `TeamCar`. Stripes follow `badgeStripes`.
- **The livery is drawn as authored, never through `legible()`**: the near-black outline
  is what keeps a car visible in both themes.
- **Fills go through `style`**: an SVG `fill` attribute does not accept `color-mix()`.
- **Wheels spin smoothly**, never in steps, and only `motion-safe:`.
- **Clip path ids come from `useId`**, cleaned of characters `url(#…)` won't take.

## The track
- **It never touches the world**, so it may use `Math.random()`, passed in.
- **The track is the parade's only road**: no car drives over the page.
- **`Shell`'s `foot`**, above the footer as its lower verge, meets the window's bottom.
- **The lanes fit the measured tarmac** (`laneTops`, `refitField`): a short window's is thinner.
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
