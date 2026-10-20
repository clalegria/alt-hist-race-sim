---
paths:
  - "apps/web/**/*.test.ts"
  - "apps/web/**/*.test.tsx"
  - "apps/web/src/test-support.ts"
---

# Web app — testing

Vitest with **no jsdom**: components are rendered with `renderToStaticMarkup`.

- **A static render shows the store's initial world, whatever has run since**: zustand
  serves `getInitialState()` as the server snapshot. Assert store updates in the store's
  own tests, and render a page by passing its world as props
  (`shownAt(world, view)` from `src/test-support.ts`). Rendering a URL is `web-routing.md`.
- **Keep components testable without a DOM**: state as props (controlled, like
  `SeasonGrid` and `ReserveList` under `useGridDraft`; an `ExpandableRow` by `defaultOpen`),
  and interaction as a pure function (`pickUp`) tested on its own. A click handler cannot be reached here.
- **Fixtures come from `src/test-support.ts`**: a fixed seed is a fixture; when a test
  needs a season of some shape, `findWorld` searches for one. Counts come off the grid,
  and a rule for every season loops `seasons`.
- **Find a driver's name in `textOf(html)`**, or as a row draws it with `rowName`: a
  split name spans several tags, so a `not.toContain(name)` on raw markup always passes.
- **Read the rendered attribute, not the word**: count `disabled=""` (many enabled
  buttons carry `disabled:` classes) and read a native `select` by its `selected=""`
  option, in card order, never by searching for a team name, which every picker lists.
- **Out of reach here**: click handlers, effects, media-query layouts, and anything Radix
  renders into a portal (popovers, the run bar's ⋯ menu, dialogs). Test what they offer
  as data (`runBarFor`, `runActionsFor`) and where a click ends up in the store; the
  blocker and the dialogs are exercised in a real browser by `pnpm screenshots`.
