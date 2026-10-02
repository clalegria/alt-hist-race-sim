---
paths:
  - "apps/web/**/*.test.ts"
  - "apps/web/**/*.test.tsx"
  - "apps/web/src/test-support.ts"
---

# Web app — testing

Vitest with **no jsdom**. `SeasonView` takes the world and the cursor as **props**
rather than reading the store, so every stage renders through `renderToStaticMarkup`
without a DOM and without clicking through fourteen rounds; `MainMenu` and
`SeasonPicker` take their callbacks the same way — the only level at which a greyed-out
mode or an unplayable year can be checked. The routes connect them; rendering a URL
through the router is `.claude/rules/web-routing.md`.

That split is partly structural and partly because **zustand serves
`getInitialState()` as the `useSyncExternalStore` *server* snapshot** — a static render
always shows the world the store was built with, whatever has been simulated since.
SSR-only and irrelevant to a client-rendered SPA, but it is why store updates are
asserted in the store's own tests.

`menu.test.tsx` counts rendered `disabled=""` attributes, **not** the word "disabled"
— several perfectly clickable buttons carry `disabled:opacity-50` in their class list.

**Nothing here asserts an authored number or what a seed produced** — the rule is in
`CLAUDE.md`, and `src/test-support.ts` is how it is kept. `seededWorld()` is a fixture
(a render has to be *of* something); `findWorld(predicate)` searches seeds for a season
of the shape a test needs — a title settled with rounds to spare, a place that changed
hands — instead of pinning the seed that happened to work. Counts come off the grid:
`world.field.length`, `teamCount`, `starterCount`, `SEED.calendar.length`. `YEAR` and
`SEED` are the earliest authored season rather than a year written down, and anything
that must hold for *every* season loops `seasons` instead. The suite is checked against
this by perturbing every rating in the seed data and by adding an entry to a season; it
stays green through both.

The grid editor is split the same way, and for the same reason. `SeasonGrid` and
`ReserveList` are **controlled** — the draft lives in `GridStage` above them — so every
state they can be in renders on its own, and the interaction itself is the pure
`pickUp(lineup, selected, driverId)` in `GridStage.tsx`, which is where the
select-then-swap rule is tested. The swap rules underneath it are unit-tested in
`@alt-hist/data`; where an applied grid ends up is tested in the store.

The **supplier picker is a native `select`** partly for that reason: it is the one
control in the editor whose state a DOM-less test can read back, since React renders
`selected=""` on the chosen option. `engines.test.tsx` reads the selected values in card
order rather than searching for a name — a works team is called the same thing as one of
the options in every other team's picker.

What this level cannot reach: the click handlers, the scroll-to-top effect, the
start-again confirming flag, the editor's open/closed toggle, and popover contents,
which Radix does not render while closed. All would need jsdom. Where a click *ends
up* is covered: it ends up in the store, or in `pickUp`.
