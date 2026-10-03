---
paths:
  - "apps/web/src/store/recipe.ts"
  - "apps/web/src/store/persist.ts"
  - "apps/web/src/main.tsx"
---

# Web app — a run survives a reload

A run lasts until the reader exits it: through a reload, and through a closed tab. The
store it lives in is `.claude/rules/web-store.md`, and the way out of it is
`.claude/rules/web-run-bar.md`.

## The recipe, not the worlds

`localStorage` holds the run's **recipe** (`store/recipe.ts`) under `alt-hist-run`. It
never holds the worlds themselves, because a long era as JSON would outgrow the few
megabytes `localStorage` allows. Simulation is deterministic, so the recipe rebuilds the
run exactly.

**The recipe is derived from the run, not kept beside it.** Every `World` already records
the inputs that built it: `seed`, `year`, `ratingMode`, `randomness`, `lineup`, `engines`,
`chassis` and `arrangement`, which are exactly `createWorld`'s arguments. `recipeOf(run)` is one
entry per world (an era's `run.seasons`, then `world`), plus the kind, the cursor and a
`version`. Because there is no second record of the reader's inputs, nothing can fall
out of step with the worlds.

- **A new player input is recorded on the world it shaped**, the way `lineup` is. The
  recipe then picks it up as one more field.
- **Seeds are stored per world, never re-derived with `nextSeed`.** A restart mid-era
  draws a fresh one that nothing earlier in the run could reproduce.

## The fingerprint is the build check

Each world's entry carries `check`, a 32-bit FNV-1a hash of the world's JSON, field
included. `fingerprint` memoises it per world, since worlds are never mutated.

`runFromRecipe` re-simulates every world and compares the checks. Any disagreement
refuses the whole run. That catches the one case that matters: a build whose data or
engine replays the same inputs to a different world, including a retuned rating that
changed no result. A build that changes nothing the simulation reads leaves the run
resumable, which a commit stamp would not.

## Untrusted input

The stored value comes from storage the reader controls, so `runFromRecipe` takes
`unknown` and checks it before anything reaches `createWorld`:

- the version and the kind;
- integer seeds, playable years, and a known mode and randomness level;
- one world for a season, and for an era, years chained by `nextEraYear`;
- the cursor, which must be a beat its last world has. A `review` is allowed in an era
  only.

The rebuild runs inside `try/catch`. Anything wrong, or anything that throws, returns
null, never a crash.

## Saving and restoring

`startRunPersistence()` in `store/persist.ts` is called once from `main.tsx`, before the
router is built, so a reload onto `/run/…` finds the run already there when the `/run`
guard looks. The store module never touches storage, which keeps its tests free of it.

- **Saved by subscription.** One `useSeasonStore.subscribe` listener writes the recipe
  whenever `run` changes, and removes the key when it goes null on Exit. Every action is
  covered without knowing about storage.
- **A run that will not rebuild** is removed, and `resumeFailed` is raised in the store.
  While no run exists, Home shows `RunNotResumed` in place of the Resume card, until the
  reader dismisses it or starts another run.
- Storage is guarded as `lib/preferences.ts` guards it. When it is absent or throwing,
  the run carries on and only the reload is lost.

This is one slot for the current run. Share links and save files are separate features
(`docs/design/app-shell.md` §8).

## Testing

`store/recipe.test.ts` builds runs through the store's own actions (an edited grid
mid-season, an era with a mid-era restart and a kept rule, a review) and asserts the
round trip through JSON gives back an equal run. A list of malformed, tampered and stale
recipes must each come back null without throwing. `store/persist.test.ts` stubs
`localStorage` and covers restore, refusal, save-on-change, removal on exit, and storage
that is absent or throws.
