# CLAUDE.md

**alt-hist-race-sim**: an alternate-history motor racing simulator. It starts from a real
season (1950–2026, all authored) and simulates forward year by year: 1–100 ratings,
probabilistic races, ageing, transfers, retirements, accumulated statistics. A hobby
project, ~98% AI-generated; these rules keep it coherent.

- **The author** is an experienced programmer new to TypeScript, React and web dev. When
  making a design choice, name the web convention behind it and why it fits.
- **Phase 1 is browser-only**: no server, HTTP API, database or user accounts.

## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # Vitest across all packages
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm screenshots   # screens to PNGs; pass step names, --phone/--desktop, --light/--dark
pnpm tunnel        # the dev server on a public https URL, for any device (.claude/rules/tunnel.md)
```
Calibration harnesses (`pnpm race`, `season`, `tune`, `fit`, …): `.claude/rules/calibration.md`.

## Invariants
- **The engine is pure**: `packages/engine` imports nothing outside itself, does no I/O
  (no `fetch`, file reads, `Date.now()`) and has zero dependencies, runtime or dev.
- **No `Math.random()` in the engine**: randomness comes from the injected seeded PRNG.
  Runs must reproduce.
- **Identity is separate from state**: `Driver` and `Team` are immutable; ratings and
  per-season facts live in per-season records.
- **Results are the source of truth**: one row per (driver, race); every statistic is
  derived on read, never kept as a counter.
- **One serialisable world state**, plain data, in the Zustand store (`web-store.md`).
- **Tunable numbers live in the subsystem's constants module**, never inline.
- **Never change a number unless asked**: engine constants and the authored ratings in
  `packages/data/src/*.json` are the author's, and a harness is not run to check a figure.
  A change to how performance is computed (a new score term, a new race model) changes
  what a rating means: say so and agree before touching numbers. Never call a number
  fitted, calibrated, measured or stale.

## Glossary
- **Entry**: one team's season: team, chassis, engine, drivers.
- **Car spec**: chassis and engine blended by `powertrain()`; what the model races and
  what the UI's overall shows.
- **Aged / peak**: a driver's ability that season via the ageing curve (the default
  everywhere) / their authored peak (a what-if).
- **Ranking rule**: overall, then racing, then name or id (`compareByRating`). Every list
  on screen and every reseat.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- No build step: packages export TypeScript source; `pnpm typecheck` is the check.
- Every engine module ships Vitest tests; `apps/web` is tested at store and smoke-render
  level. **No test asserts an authored number or what a seed produced** (`testing.md`).
  Read `Test Files`, not just `Tests`: a file that fails to compile isn't counted.
- Screenshots only for a visible change: the changed steps, one variant
  (`pnpm screenshots era-setup --phone --light`, `screenshots.md`).
- Dependencies: if pnpm's release-age policy rejects a version, take the previous stable
  one; never add `minimumReleaseAgeExclude`. Secrets only in the gitignored `.env`.

## Docs
- `docs/ROADMAP.md` is what to build next; `docs/DECISIONS.md` is what to ask the author
  about, not assume. Read both when picking up a roadmap item.
- `.claude/rules/*.md` hold subsystem rules, loaded by path. How to write any doc:
  `.claude/rules/docs.md`.
- A change that makes a doc wrong fixes it in the same commit.
- Which model does what, and when to use subagents (`.claude/agents/`): @AGENTS.md
