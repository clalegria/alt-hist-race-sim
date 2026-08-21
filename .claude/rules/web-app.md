---
paths:
  - "apps/web/**"
---

# Web app

`apps/web` reveals a season a session at a time. React + Vite, Tailwind 4, Zustand.
shadcn/ui components are **copied in, not a dependency** — but the Radix primitives
they wrap *are* real dependencies (currently `@radix-ui/react-popover`).

## Screens and state

**Three screens, one union.** `Screen` in `store/season.ts` is
`menu → season-setup → season`, and a `World` is a *member of the season variant*
rather than a nullable field beside it — so the menu cannot read a season nobody
started and no component has to guard against one. Nothing is simulated until a mode
is chosen: the app opens on the menu having run no races at all.

Modes come from `lib/modes.ts` and years from `lib/seasons.ts`; both list what does
not exist yet (the career mode, the 46 unauthored seasons) as disabled entries rather
than omitting it. `AUTHORED` in `lib/seasons.ts` is the single map deciding which
years are playable — `PLAYABLE_SEASONS`, `isPlayable` and `seasonSeed` all derive from
it, so authoring a season is one line there plus the JSON, not a UI change.
`createWorld(seed, year)` goes through `seasonSeed`, which throws on an unauthored
year rather than quietly falling back to 1980.

**"Start again" asks where to** — *Main menu* or *Beginning of the season*, inline on
the same button row rather than in a modal (no dialog primitive here, and one is not
worth a dependency plus a focus trap for three buttons). *Beginning of the season*
draws a **fresh seed for the same year**: another go, not a replay. Both copies of the
action row — sticky bar and page foot — share one confirming flag so they cannot
disagree.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, rngState, field, season }`) — one per season screen, none before one
is started. `field` is the grid exactly as raced, stored rather than re-read from the
seed files because it will stop being derivable from them: once the ageing curve
lands, ratings are rolled per run and this is the only record of what they were.

**No `Rng` in the world** — it holds a closure and cannot be serialized. What is
stored is its numeric `getState()` snapshot, which `createRngFromState` turns back
into a generator positioned exactly where the season ended. `JSON.stringify(world)` is
therefore already a complete save file, and tests assert both the round trip and that
no function or class instance has crept in.

View state that says nothing about the simulation — which race row is expanded, the
start-again confirming flag — stays in component `useState`. The rule is that
*simulation* state lives in the one store, not that React may never hold anything.

**Standings are derived in the component, not stored:** `championshipStandings` and
`constructorStandings` run in a `useMemo` off `world.season`. Mid-season standings
need no special support — `{ races: races.slice(0, n) }` *is* the table after round n.

A fresh random seed is drawn each time a season is started, from the picker and by
Start again. That is **not** a violation of the no-`Math.random()` rule: the ban is on
the *engine*, where every outcome must come from the injected PRNG or nothing is
reproducible. Choosing *which* seed to run happens before any generator exists, so it
lives in `lib/seed.ts` and never in `packages/engine`.

## The reveal

The whole year is simulated the instant a seed is drawn — one continuous RNG stream
through every round, which is what makes a season reproducible. `View` is a cursor
over results that already exist:

```
grid → qualifying 1 → race 1 → qualifying 2 → race 2 → … → summary
```

"Simulate next session" is a promise about what the reader sees next, not about when
the dice are rolled; the results are identical either way. `advance()` is a pure
function over that cursor and `actionsFor()` in `App.tsx` is the whole of the
navigation — both are tested directly, because getting either wrong strands the
reader mid-season.

## Display rules

- **The grid opens closed.** Teams and drivers with a flag, an age and one overall
  rating; the five individual ratings live behind a popover, and teams are listed
  alphabetically rather than by pace so the pecking order is not given away before a
  wheel turns. A test asserts no individual rating label appears in the closed markup.
- `lib/rating.ts` computes the overall: a **display heuristic, not model truth** —
  nothing in the engine reads it — whose weights approximate how much each rating
  actually moves results. Reliability takes a quarter of the car number despite
  touching no race score, because ~42% of the 1980 field failed to finish and a
  fragile car forfeits points it had the pace to take. Adaptability is weighted zero:
  paying for it would claim a driver is better at something the sim never asks of.
- **One accent, defined once in `lib/highlight.ts`**: pole on the grid, the winner of
  a race, each champion on the summary, and the champion's row in the race sidebar
  from the round the arithmetic settles it. The banner announcing a title appears on
  that round *only* — repeating it turns the beat the season built to into a standing
  notice, and the row accent already carries the fact. A test asserts exactly one row
  or card carries the accent per view, since "make it look coherent" is the sort of
  thing that quietly stops being true.
- **Qualifying is drawn as a starting grid**, not a table: two columns, odd left, even
  right, the right column set back half a row. Rows are a fixed height and even slots
  shift by exactly half of it via `translate-y`, which moves them visually without
  changing layout height — so car N sits at `(N − 1) × step / 2` and P1→P2 spacing
  equals P2→P3. **A margin would grow the row it sits in and bunch each pair
  together.** Two numbers control this and must stay in that 2:1 ratio; a test parses
  both out of the markup and fails if they drift. Below `sm` the stagger drops to one
  column. Cars outside the cut are listed apart — they never form up, and slotting
  them in would put the wrong drivers on the wrong side.
- **A race shows its result and the championship side by side**, standings cut to
  position/name/points and the top eight. Movement arrows come from running
  `championshipStandings` over one fewer race and comparing, which costs nothing
  because standings are derived. Round one shows none. Direction rides the glyph as
  well as the colour, with the count in a `title`, so it is not colour-only. The full
  breakdown (wins, podiums, poles) belongs to the summary — after one round it is all
  zeroes.
- **Actions live in a sticky header, repeated at the foot**, and every stage change
  scrolls to the top — otherwise stepping on from a race means scrolling past two
  28-row tables, then landing mid-page in the next session.
- **Flags** go beside every driver and team everywhere they are named, via the shared
  `DriverName` / `TeamName` pair so they cannot end up in some tables and not others.
  They are SVGs from `country-flag-icons`, imported **one country at a time** in
  `components/Flag.tsx`. Emoji flags were tried first and **do not render on Windows
  at all**. `import * as Flags` reads better and costs 240 kB, since the namespace
  defeats tree-shaking and pulls in all ~250 flags for the twenty this sim uses — so
  the map is explicit, and `Flag.test.tsx` fails if the seed data grows a country it
  does not cover.

## Type, palette and theme

In `.claude/rules/web-styling.md`, which loads when you touch the stylesheet,
`index.html` or the theme module. **Read it before editing `src/index.css`** — the
nested-`@theme` trap it documents has broken this app once already.

## Testing

Vitest with **no jsdom**. `SeasonView` takes the world and the cursor as **props**
rather than reading the store, so every stage renders through `renderToStaticMarkup`
without a DOM and without clicking through fourteen rounds; `MainMenu` and
`SeasonPicker` take their callbacks the same way — the only level at which the
greyed-out mode and 46 unauthored years can be checked. `App` connects all three.

That split is partly structural and partly because **zustand serves
`getInitialState()` as the `useSyncExternalStore` *server* snapshot** — a static render
always shows the world the store was built with, whatever has been simulated since.
SSR-only and irrelevant to a client-rendered SPA, but it is why store updates are
asserted in the store's own tests.

`menu.test.tsx` counts rendered `disabled=""` attributes, **not** the word "disabled"
— several perfectly clickable buttons carry `disabled:opacity-50` in their class list.

What this level cannot reach: the click handlers themselves, the scroll-to-top effect,
the start-again confirming flag, and popover contents, which Radix does not render
while closed. All would need jsdom. Where a click *ends up* is covered, because it
ends up in the store.
