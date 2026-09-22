---
paths:
  - "apps/web/**"
---

# Web app

`apps/web` reveals a season a session at a time. React + Vite, Tailwind 4, Zustand.
shadcn/ui components are **copied in, not a dependency** — but the Radix primitives
they wrap *are* real dependencies (currently `@radix-ui/react-popover`).

## Screens and state

**One union of screens.** `Screen` in `store/season.ts` is
`menu → season-setup → season` for a single year and
`menu → era-setup → era ⇄ era-champions` for a run of them, and a `World` is a *member
of the variants that have one* rather than a nullable field beside them — so the menu
cannot read a season nobody started and no component has to guard against one. Nothing
is simulated until a mode is chosen: the app opens on the menu having run no races at
all. **The era half is `.claude/rules/web-era.md`**, which loads alongside this file on
the store and `App.tsx`; everything below describes both unless it says otherwise, since
an era is the same season screen with a run carried beside it.

Modes come from `lib/modes.ts` and years from `lib/seasons.ts`; both list what does
not exist yet — the unbuilt modes, and any year without seed data — as disabled entries
rather than omitting it. **`lib/seasons.ts` holds no list of its own** —
`PLAYABLE_SEASONS` and `isPlayable` come straight from `authoredSeasons` in
`@alt-hist/data`, so authoring a season is a file in `packages/data/src/seasons/` and
the UI follows. The split: which years *exist* is a data decision, the `FIRST_SEASON`–
`LAST_SEASON` *range the picker draws* is a display decision and lives here. Every year
in the range is authored today, so what still proves the rule is that a year *outside*
it is not playable. `playableSummary()` writes the picker's
subtitle from the same source, collapsing runs into ranges — it said "Only 1980 has
been authored" for a while after 1981 landed, and that is why the copy is derived.
`createWorld(seed, year)` goes through `seasonSeed`, which throws on an unauthored
year rather than quietly falling back.

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
