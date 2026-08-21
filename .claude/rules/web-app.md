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
draws a **fresh seed for the same year and the same `ratingMode`**: another go, not a
replay, and everything the reader *chose* carries over — only the dice change. Both
copies of the action row — sticky bar and page foot — share one confirming flag so
they cannot disagree.

**Driver ability is a simulation input, not a display filter.** `world.ratingMode` is
`"peak"` (authored peaks, the default and the calibrated one) or `"aged"` (each
driver's ability in that season, via the engine's curve). `RatingModeToggle` renders
**only on the grid stage** — past it the reader has seen results the other field would
never have produced — and `setRatingMode` re-runs the year *from the same seed*, so
the two modes are the same dice thrown at different drivers.

The choice **sticks**, via `lib/preferences.ts` (localStorage, guarded exactly as
`theme.ts` guards it — storage is absent under Vitest and throws in private
browsing). Two levels, and the split is the point: the *world* owns the mode it was
built with, so a finished season keeps reporting the ratings it actually raced; the
*preference* only seeds the next one. `startSeason` reads it, `setRatingMode` writes
it, `restartSeason` carries the world's own. `simulate` deliberately ignores it — it
is the entry point whose output must depend only on its arguments, and tests would
otherwise be order-dependent on whatever was last remembered.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, ratingMode, rngState, field, season }`) — one per season screen, none
before one is started. `field` is the grid exactly as raced, and is no longer
derivable from the seed files: the ratings in it depend on `ratingMode`.

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
Start again. That is **not** a violation of the no-`Math.random()` rule: choosing
*which* seed to run happens before any generator exists, so it lives in `lib/seed.ts`
and never in `packages/engine`.

## The reveal

The whole year is simulated the instant a seed is drawn — one continuous RNG stream
through every round, which is what makes a season reproducible. `View` is a cursor
over results that already exist:

```
grid → qualifying 1 → race 1 → qualifying 2 → race 2 → … → summary
```

"Simulate next session" is a promise about what the reader sees next, not about when
the dice are rolled. `advance()` is a pure function over that cursor and
`actionsFor()` in `App.tsx` is the whole of the navigation — both tested directly,
because getting either wrong strands the reader mid-season.

## Display rules

Moved to `.claude/rules/web-display.md`, which loads alongside this file whenever you
open anything in `src/components/`.

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

What this level cannot reach: the click handlers, the scroll-to-top effect, the
start-again confirming flag, and popover contents, which Radix does not render while
closed. All would need jsdom. Where a click *ends up* is covered: it ends up in the store.
