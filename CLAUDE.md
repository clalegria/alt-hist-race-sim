# CLAUDE.md

## Project
**alt-hist-race-sim** (working name) — an alternate-history motor racing simulator.
Starts from a real season — 1980 and 1981 today, others later — and simulates forward,
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

**Seasons are authored one file at a time** in `packages/data/src/seasons/<year>.json`,
registered in that folder's `index.ts`. Each carries a calendar, an **engine table** and
an entry list. 1980 and 1981 exist; the end state is 1950–2026 and beyond. Nothing
outside that folder keeps a list of seasons — see `.claude/rules/seed-data.md` for the
three edits an extra year takes.

**The foundation is complete**: seeded PRNG, score-and-sort race model, season loop,
derived championships, Monte Carlo calibration harness, and a React web app that
reveals a season session by session.

## Where the rest of the documentation lives
**Read `docs/ROADMAP.md` (what to build next, and why in that order) and
`docs/DECISIONS.md` (open decisions in full) before starting new feature work.**
Subsystem detail lives in `.claude/rules/*.md` and loads automatically when you open
files in the matching package — engine race, season and progression models, seed data,
calibration, and the web app split across architecture, display rules and styling.

## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # 571 tests (203 engine, 79 data, 289 web)
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # simulate ONE race, print the classification
pnpm season [seed] # simulate a full season, print both championships
pnpm calibrate [n] # run a grid n times (default 5000), print distributions
                   # all three take --year <n>; default is the earliest authored season
pnpm progression <driver>  # one driver's ageing curve, age 18-50 (no arg lists the pool)
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
- **Realize-once-and-store for career rolls.** Nothing is rolled today — the ageing
  curve is deterministic — but if per-run scatter on a driver's debut or peak ever
  lands, roll it ONCE via the seeded PRNG, store it in that driver's per-sim state,
  and read the stored value thereafter. Never re-roll on read.
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
  new term in the race score, a new entity between driver and result (the ageing
  curve, engine manufacturers), a different race model — which changes what a rating
  *means*. Even then, say the re-tune is needed and why, and get agreement before
  running the harness. If a change makes a calibration figure visibly wrong, report
  it and stop; do not fix it unprompted.

## Domain glossary
- **Entry**: one team's participation in one season — a team + a car spec + an engine
  + its drivers.
- **Car spec**: a team's per-season *chassis* attributes (racing, qualifying, consistency,
  reliability).
- **Engine spec**: a manufacturer's per-season unit — racing, qualifying, reliability.
  Three, not four: consistency belongs to the chassis. Identity (`engines.json`) is
  separate from the per-season ratings, as it is for drivers and teams.
- **Powertrain**: chassis and engine blended into the one car the model scores,
  `0.8 · chassis + 0.2 · engine`, consistency untouched. `powertrain()` lives in the
  engine package and **the UI's overall calls it too**, so there is one answer to "what
  is this car worth". No engine is the identity: `powertrain(car)` is `car`.
- **Peak vs aged**: the two rating modes a season can be built from — every driver at
  their authored peak (the default, and what the calibration describes), or at their
  ability in that season via the ageing curve.
- **Score-and-sort**: v1 race model — sample one performance number per driver from
  attributes + car + home advantage + noise, sort, apply DNFs. No lap-by-lap. Lives
  behind the `RaceModel` interface so a richer model can replace it.
- **Round context**: what the engine knows about *where* a round is held. Today one
  field, `country`; the seam every circuit feature hangs off.
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
  smoke-render level rather than component by component. Favour property-style checks:
  finish order is a valid permutation, nobody finishes twice, DNFs remove cars.
- **No test may depend on an authored number or on what a particular seed produced.**
  The driver, team and car ratings and the season seeds are tuned continuously, so a
  test that reads one fails for a reason that is not a bug. Concretely:
  - Never assert a rating, or a comparison between two authored ratings — "Williams is
    faster than Renault", "Piquet is above 80", "Prost peaks in 1987". Assert the
    *rule* against synthetic ratings instead; the local `driver()` / `car()` fixtures
    in `apps/web/src/lib/rating.test.ts` are the pattern.
  - Never assert what a seed produced — a champion, a points total, a winner, a tie.
    A fixed seed as a *fixture* is fine and necessary; what is banned is an assertion
    that only holds for that seed. When a test needs a season of a particular shape
    (a title settled early, a place that changed hands between rounds), **search seeds
    for one** — `findWorld` in `apps/web/src/test-support.ts` — rather than pinning
    the seed that happened to work.
  - Never hard-code a count that comes from the seed files: 28 seats, 15 teams, 41
    drivers, 14 rounds. Derive it — `field.length`, `season.calendar.length` — because
    the grid is going to grow.
  - Naming a driver or team as an **identity** is fine: who drove for whom is history,
    not a tuning knob. What they are *worth* is not. Where a test needs "a driver with
    a seat" or "one without", pick it out of the data rather than by name.
  - Same rule, same reason, for the calibration harness: **do not run it to check
    anything.** Its figures are the record of one measurement, not a test, and
    re-measuring on spec is a long loop that answers a question nobody asked.
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
- **Per-run scatter on the ageing curve** — settled as *no scatter for now*: the curve
  is deterministic and identical in every seed. Peak-scatter shape and the debut/peak
  gap only matter again if that reopens.
- **Driver ratings are still un-tuned**, but no longer un-tunable: the ageing curve
  landed, so the blocker is gone. This does **not** authorise a re-tune — see the
  no-re-calibration invariant. It is a job waiting for the author to ask for it.
- **Reliability era curve** — `mechanicalDnfEraScale` has no per-year curve, so 1981
  retires cars at 1980's rate. Live now that a second season is playable.
- **Starting limit per era** — `maxStarters` is one engine constant pinned at 26.
  Real 1981 took 24. Probably belongs in `SeasonSeed`; needs the author's word.
- **Engines are calibrated; the 0.2 share and the home-advantage numbers are not.**
  Both seasons were re-tuned chassis-and-engine together at the author's request, with
  driver ratings held fixed. The blend weight was not searched over, and no measured
  race has a host country. Nothing moves an engine deal between seasons, and a works
  team is inferred from the names matching.
- **Consistency's spread lever is parked, not gone** — reopening it buys wildcards and
  costs strict dominance.
- **Weekend-form share is a first guess** — 0.5, plausible but never fitted.
- **Circuits have no character** — home advantage opened the door (`RoundContext`);
  what else a circuit *does* is undecided, as are the two home-advantage numbers.
- **What moves the driver market** — gates the market, and a design conversation
  rather than a coding task. `adaptability` is authored and unread precisely for this.
- **The overall rating weights adaptability at zero** — display heuristic in
  `apps/web/src/lib/rating.ts`; revisit when the market gives the rating meaning.
