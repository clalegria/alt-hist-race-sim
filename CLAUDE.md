# CLAUDE.md

## Project
**alt-hist-race-sim** (working name) — an alternate-history motor racing simulator.
Starts from a real season — 1980 today, others later — and simulates results forward,
year by year, diverging from history as it goes. Drivers and teams have 1–100
attributes; races are resolved probabilistically; drivers age, move between teams via
a transfer market, and retire; statistics accumulate over the run.

Hobby project for learning modern TypeScript/React. Will eventually be shared publicly
as a static site. ~90% of code is AI-generated, so the rules below are the guardrails
that keep the project coherent — follow them.

## Current phase
**Phase 1: browser-only. No backend, no database, no user accounts.** The engine runs
client-side; saves (a later phase) will go to IndexedDB. Do NOT introduce a server, an
HTTP API, or a database in this phase.

**The foundation is complete**: seeded PRNG, score-and-sort race model, season loop,
derived championships, Monte Carlo calibration harness, and a React web app that
reveals a season session by session.

## Where the rest of the documentation lives
**Read `docs/ROADMAP.md` (what to build next, and why in that order) and
`docs/DECISIONS.md` (open decisions in full) before starting new feature work.**
Subsystem detail lives in `.claude/rules/*.md` and loads automatically when you open
files in the matching package — engine race and season models, seed data, calibration,
the web app and its styling.

## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # 309 tests (158 engine, 13 data, 138 web)
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # simulate ONE race on the 1980 grid, print the classification
pnpm season [seed] # simulate the full 14-race 1980 season, print both championships
pnpm calibrate [n] # run the 1980 grid n times (default 5000), print distributions
pnpm --filter @alt-hist/calibrate tune   # rating tuner (prints proposals, writes nothing)
```

## Architecture rules (invariants — do not violate)
- **The engine is pure.** `packages/engine` imports nothing outside itself and does
  no I/O — no `fetch`, no file reads, no `Date.now()`. Inputs in, results out.
  This is what makes it testable and portable (browser now, server later).
  It currently has **zero dependencies**, runtime or dev. Keep it that way.
- **No `Math.random()` anywhere in the engine.** All randomness comes from an
  injected seeded PRNG. Reproducibility is a hard requirement (bug reports, tests,
  Monte Carlo calibration).
- **Identity is separate from state.** `Driver` / `Team` (id, name, nationality,
  birthYear / foundedYear) are immutable. Ratings and per-season facts live in
  separate per-season records.
- **Results are the source of truth; statistics are derived.** Store a result row
  per (driver, race). Never keep running win/points counters as primary data —
  compute aggregates from results on read.
- **One serialisable world-state object.** All live simulation state is one
  plain-data object (no class instances, no embedded functions) held in a single
  store (Zustand on the UI side). This makes "save game" trivial later. Do not
  scatter simulation state across React component state.
  The `Rng` object holds a closure, so it must NOT go in the world state — store
  its numeric `getState()` snapshot and rebuild with `createRngFromState()`.
- **Realize-once-and-store for career rolls.** Authored `debutSeason` and
  `peak.season` are *nominal targets*. When a driver enters the sim, roll their
  realized debut and realized peak ONCE via the seeded PRNG, store them in that
  driver's per-sim state, and read the stored values thereafter. Never re-roll on read.
- **Tunable numbers live in one constants module per subsystem**, never inline in
  logic. `packages/engine/src/race/constants.ts` is the pattern to follow.
- **Never re-calibrate or re-tune unless explicitly asked.** Engine constants
  (`race/constants.ts`, `season/constants.ts`) and the authored driver/team/car
  ratings in `packages/data/src/*.json` are settled. Do not adjust them as a side
  effect of building something else — not to "absorb" a new feature, not because a
  figure drifted a point, not because a Monte Carlo run looks off — and do not run
  the harness to check. The failure mode is expensive and invisible: every feature
  invites a re-tune, each costs a long measurement loop, and the ratings end up
  chasing whatever was built last rather than 1980. Two overrides, and only two:
  **(a)** the author asks; **(b)** a deep change to how performance is computed — a
  new term in the race score, a new entity between driver and result (roadmap 1
  ageing, roadmap 4 engines), a different race model — which changes what a rating
  *means*. Even then, say the re-tune is needed and why, and get agreement before
  running the harness. If a change makes a calibration figure visibly wrong, report
  it and stop; do not fix it unprompted.

## Domain glossary
- **Entry**: one team's participation in one season — a team + a car spec + its drivers.
- **Car spec**: a team's per-season car attributes (racing, qualifying, consistency, reliability).
- **Nominal vs realized**: authored `debutSeason` / `peak.season` are nominal; the
  sim rolls realized values per driver per run.
- **Score-and-sort**: v1 race model — sample one performance number per driver from
  attributes + car + noise, sort, apply DNFs. No lap-by-lap. Lives behind the
  `RaceModel` interface so a richer model can replace it.
- **Progression model**: the swappable seam between the two planned modes.
  Interface `SeasonProgressionModel` with `nextSeasonEntries()` and `nextSeasonCars()`.
  Implement `EvolutionaryProgression` (random walk + mean reversion) first;
  `HistoricalProgression` (real cars/teams per year, drivers still freely allocated
  by the market) later.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- **No build step.** Packages export TypeScript source directly
  (`"exports": "./src/index.ts"`); Vite/Vitest/tsx transpile on the fly, and
  `tsc --noEmit` is the correctness check. Add a real build only if something needs to
  consume these packages from plain Node.
- Every engine module ships with Vitest tests. `apps/web` is tested at the store and
  smoke-render level rather than component by component. Favour property-style checks
  (finish order is a valid permutation; nobody finishes twice; DNFs remove cars)
  alongside seeded-outcome assertions.
- **Statistical tests must be mutation-checked.** A distribution test that passes
  against a deliberately broken implementation is worthless. Break it on purpose,
  confirm it fails, revert. This has repeatedly caught tests that asserted nothing —
  a counter blind to `gaussian()`, a tie-break case that was not tied, an assertion
  read off the engine's data instead of the component's output.
- **Check `Test Files`, not just `Tests`, when reading a Vitest run.** A file that
  fails to *compile* is not counted in the `Tests` line, so a broken test file can
  leave a run looking green. `Test Files 11 passed (11)` is the line that proves
  everything was collected.
- **New dependencies are checked against a release-age policy.** pnpm rejects packages
  published within the last few days and will offer to write a `minimumReleaseAgeExclude`
  entry into `pnpm-workspace.yaml`. Do not take it — pick the previous stable version
  instead. Freshly published versions are exactly the window a compromised package
  lands in. This has already happened once, with a Vite release hours old.
- `tools/*` may use dev dependencies (tsx runs the TS directly). The engine may not,
  and do not add runtime dependencies to `packages/engine` without a strong reason.
- Secrets (none in phase 1) live only in gitignored `.env`.
- **This file stays under 200 lines.** When documenting a newly implemented subsystem,
  write it as a path-scoped rule in `.claude/rules/` (YAML `paths:` frontmatter), not
  into this file — only project-wide invariants, commands, glossary and conventions
  belong here, because this file is re-injected after `/compact` and path-scoped rules
  are not. When a rule file exceeds ~150 lines, split it by narrower path scope.

## Open decisions (confirm with the author before implementing — do not assume)
Full reasoning in `docs/DECISIONS.md`; these one-liners exist so a session knows a
question is open without carrying the argument.
- **Season vs age for curves** — gates roadmap 1. Ask before writing the ageing function.
- **Peak-scatter shape** — gates roadmap 1. Symmetric is acceptable for v1.
- **Debut/peak gap** — gates roadmap 1. Offset from realized debut, not independent.
- **Driver ratings are un-tuned and cannot be tuned yet** — gates roadmap 1, and the
  reason it is first. Re-tune the pool *after* the ageing curve exists, never before.
- **Reliability era curve** — roadmap 5. `mechanicalDnfEraScale` has no per-year curve.
- **Starting limit per era** — roadmap 5. `maxStarters` is pinned at 26 for 1980.
- **Consistency's spread lever is parked, not gone** — reopening it buys wildcards and
  costs strict dominance.
- **Weekend-form share is a first guess** — 0.5, plausible but never fitted.
- **Circuits have no character** — roadmap 3 opens the door; what a circuit *does* is
  undecided.
- **What moves the driver market** — gates roadmap 6, and a design conversation rather
  than a coding task. `adaptability` is authored and unread precisely for this.
- **The overall rating weights adaptability at zero** — display heuristic in
  `apps/web/src/lib/rating.ts`; revisit when roadmap 6 gives the rating meaning.
