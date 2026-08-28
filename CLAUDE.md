# CLAUDE.md

## Project
**alt-hist-race-sim** (working name) — an alternate-history motor racing simulator.
Starts from a real season — 1950 to 2026, all authored — and simulates forward, year by
year, diverging from history as it goes. Drivers and teams have 1–100 attributes; races
are resolved probabilistically; drivers age, move between teams via a transfer market,
and retire; statistics accumulate over the run.

Hobby project for learning modern TypeScript/React. Will eventually be shared publicly
as a static site. ~90% of code is AI-generated, so the rules below are the guardrails
that keep the project coherent — follow them.

## Current phase
**Phase 1: browser-only. No backend, no database, no user accounts.** The engine runs
client-side; saves (a later phase) will go to IndexedDB. Do NOT introduce a server, an
HTTP API, or a database in this phase.

**Seasons are authored one file at a time** in `packages/data/src/seasons/<year>.json`,
and that folder's `index.ts` discovers them — there is no registry to update. Each
carries a calendar, a points scale, an **engine table**, a **retirement factor** and an
entry list. All 77 are written; only 1980 and 1981 have calibrated ratings, though every
year's retirement rate is now fitted. Nothing else keeps a list of seasons —
`.claude/rules/seed-data.md` has how discovery works.

**The foundation is complete**: seeded PRNG, score-and-sort race model, season loop,
derived championships, Monte Carlo calibration harness, and a React web app that
reveals a season session by session.

## Where the rest of the documentation lives
**Read `docs/ROADMAP.md` (what to build next, and why in that order) and
`docs/DECISIONS.md` (open decisions in full) before starting new feature work.**
Subsystem detail lives in `.claude/rules/*.md` and loads automatically when you open
files in the matching package — the models, the seed data, calibration, the web app. Each
stays under ~150 lines, splitting by narrower path scope past that.

## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # 1213 tests (250 engine, 108 data, 855 web)
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # simulate ONE race, print the classification
pnpm season [seed] # simulate a full season, print both championships
pnpm calibrate [n] # run a grid n times (default 5000), print distributions
pnpm calibrate-season [n]  # a whole SEASON n times: title%, win%, score%, avg points
pnpm retirements [n]  # retirement rate per year vs the real one; --sweep re-fits the
                   # factor. All five take --year <n> and --randomness <1-5>
pnpm progression <driver>  # one driver's ageing curve, age 18-50 (no arg lists the pool)
pnpm tune          # rating tuner (prints proposals, writes nothing)
```

## Architecture rules (invariants — do not violate)
- **The engine is pure.** `packages/engine` imports nothing outside itself and does no
  I/O — no `fetch`, no file reads, no `Date.now()`. Inputs in, results out; that is what
  makes it testable and portable (browser now, server later). It currently has **zero
  dependencies**, runtime or dev. Keep it that way.
- **No `Math.random()` anywhere in the engine.** All randomness comes from an injected
  seeded PRNG. Reproducibility is a hard requirement (bug reports, tests, calibration).
- **Identity is separate from state.** `Driver` and `Team` (ids, birth/founding years) are
  immutable; ratings and per-season facts live in per-season records. A team's **name,
  base and livery are eras**, read via `teamIdentityIn` / `teamLiveryIn`.
- **Results are the source of truth; statistics are derived.** Store a result row per
  (driver, race). Never keep running win/points counters as primary data — compute
  aggregates from results on read.
- **One serialisable world-state object.** All live simulation state is one plain-data
  object (no class instances, no embedded functions) held in a single store (Zustand on
  the UI side), which makes "save game" trivial later. Do not scatter simulation state
  across React component state. The `Rng` object holds a closure, so it must NOT go in
  the world state — store its numeric `getState()` snapshot, rebuild with
  `createRngFromState()`.
- **Realize-once-and-store for career rolls.** Nothing is rolled today — the ageing curve
  is deterministic — but if per-run scatter on a driver's debut or peak ever lands, roll
  it ONCE via the seeded PRNG, store it in that driver's per-sim state, and read the
  stored value thereafter. Never re-roll on read.
- **Tunable numbers live in one constants module per subsystem**, never inline in logic.
  `packages/engine/src/race/constants.ts` is the pattern to follow.
- **Never re-calibrate or re-tune unless explicitly asked.** Engine constants
  (`race/constants.ts`, `season/constants.ts`) and the authored driver/team/car ratings in
  `packages/data/src/*.json` are settled. Do not adjust them as a side effect of building
  something else — not to "absorb" a new feature, not because a figure drifted a point,
  not because a Monte Carlo run looks off — and do not run the harness to check. The
  failure mode is expensive and invisible: every feature invites a re-tune, each costing a
  long measurement loop. Two overrides, and only two: **(a)** the author asks; **(b)** a
  deep change to how performance is computed — a new term in the race score, a new entity
  between driver and result (the ageing curve, engine manufacturers), a different race
  model — which changes what a rating *means*. Even then, say the re-tune is needed and
  why, and get agreement first. If a change makes a calibration figure visibly wrong,
  report it and stop; do not fix it unprompted.

## Domain glossary
- **Entry**: one team's season — team + chassis + engine + drivers.
- **Chassis spec** (`ChassisSpec`): a team's per-season chassis — racing, qualifying,
  consistency, reliability. Authored, and **not** what is scored.
- **Engine spec**: a manufacturer's per-season unit — racing, qualifying, reliability;
  three not four, consistency being the chassis'. `engines.json` is identity.
- **Car spec** (`CarSpec`): the blend of the two, and what the model scores. Same
  shape as `ChassisSpec`; the name marks what has been through `powertrain()`.
- **Powertrain**: that blend, by **two ratios, not one**. Pace (racing, qualifying) is
  `0.7 · chassis + 0.3 · engine`; reliability an even `0.5 / 0.5`, consistency untouched.
  Lives in the engine package, and **the UI's overall calls it too**.
- **Peak vs aged**: the two rating modes — every driver at their authored peak, or at
  their ability that season via the ageing curve. The app defaults to peak; **every
  calibration harness runs `aged` and must never run on `peak`** (`calibrate/src/mode.ts`).
- **Score-and-sort**: v1 race model — one performance number per driver from attributes
  + car + home advantage + noise, sorted, then DNFs. No lap-by-lap, behind the
  `RaceModel` interface so a richer model can replace it.
- **Round context**: where a round is held — one field, `country`; the seam circuit
  features hang off.
- **Retirement factor**: 1–10 per season file, how hard the year is on its cars. Scales
  *both* DNF rolls; 5 is neutral. `.claude/rules/retirement-factor.md`.
- **Randomness level**: 1–5, how much the dice decide, fixed before a run. Scales the two
  noise sigmas, plus `teamFormBoost` at levels 4–5; `withRandomness(2)` — the default —
  returns the constants **unchanged**, so the calibration still describes them.
- **Team form**: the share of session noise belonging to the *team* not the car (0.75),
  crossed with **weekend form** (0.5), the share carrying Saturday into Sunday. Two axes,
  four draws. Team form cancels out of a teammate comparison — which is the point.
- **Progression model**: the swappable seam between the two planned modes. Interface
  `SeasonProgressionModel` with `nextSeasonEntries()` and `nextSeasonCars()`. Implement
  `EvolutionaryProgression` (random walk + mean reversion) first; `HistoricalProgression`
  (real cars/teams per year, drivers still freely allocated by the market) later.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- **No build step.** Packages export TypeScript source directly
  (`"exports": "./src/index.ts"`); Vite/Vitest/tsx transpile on the fly, and `tsc
  --noEmit` is the correctness check. Add one only if plain Node must consume these.
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
- **Statistical tests must be mutation-checked.** A distribution test that passes against
  a deliberately broken implementation is worthless. Break it on purpose, confirm it
  fails, revert. This has repeatedly caught tests that asserted nothing — a counter blind
  to `gaussian()`, a tie-break case that was not tied, an assertion read off the
  engine's data rather than the component's output.
- **Check `Test Files`, not just `Tests`, when reading a Vitest run.** A file that fails
  to *compile* is not counted in the `Tests` line, so a broken test file leaves a run
  looking green. `Test Files 11 passed (11)` proves everything was collected.
- **New dependencies are checked against a release-age policy.** pnpm rejects packages
  published within the last few days and offers to write a `minimumReleaseAgeExclude`
  entry into `pnpm-workspace.yaml`. Do not take it — pick the previous stable version
  instead: fresh versions are the window a compromised package lands in. Has happened
  once here, with a Vite release hours old.
- `tools/*` may use dev dependencies (tsx runs the TS directly); the engine may not, and
  takes no runtime dependency without a strong reason. Secrets live only in a gitignored `.env`.
- **This file stays under 200 lines.** When documenting a newly implemented subsystem,
  write it as a path-scoped rule in `.claude/rules/` (YAML `paths:` frontmatter), not
  into this file — only project-wide invariants, commands, glossary and conventions
  belong here, because this file is re-injected after `/compact` and path-scoped rules
  are not. When a rule file exceeds ~150 lines, split it by narrower path scope.

## Open decisions (confirm with the author before implementing — do not assume)
Full reasoning in `docs/DECISIONS.md`; these one-liners exist so a session knows a
question is open without carrying the argument.
- **Per-run scatter on the ageing curve** — settled as *no scatter for now*; the curve
  is deterministic. Peak shape matters again only if that reopens.
- **Driver ratings are still un-tuned**, but no longer un-tunable now the ageing curve
  landed. Not an authorisation — it waits for the author to ask.
- **Should the tuner see a season's retirement factor?** Every year now carries a fitted
  one, but `pnpm tune` fits cars at the neutral factor against `targets.ts`'s estimated
  42%, which 1980's measured 48.5% contradicts. Either change is a re-tune.
- **Starting limit per era** — `maxStarters` is pinned at 26; real 1981 took 24. Belongs
  in `SeasonSeed` beside the retirement factor; needs the author's word.
- **The model changed under the fitted ratings, and they have not caught up.** 1980 and
  1981 were fitted against the old `0.8 / 0.2` blend; the noise has since split into team
  and car form, and consistency's spread lever is open (1.3 / 0.75) — buying wildcards
  and handing the best pairing ~2 points more win share. So `.claude/rules/calibration.md`
  no longer describes the model, **a re-tune is needed and has not been run**, and it
  needs the author's word. Team form (0.75), the DNF correlation (0.3) and weekend-form
  share (0.5) are reasoned rather than fitted. Also: no measured race has a host country.
- **Circuits have no character** — `RoundContext` opened the door; what else a circuit
  *does* is undecided, as are the home-advantage numbers.
- **What moves the driver market** — a design conversation, not a coding task;
  `adaptability` is authored and unread precisely for this.
- **The overall rating weights adaptability at zero** — a display heuristic in
  `apps/web/src/lib/rating.ts`; revisit when the market gives it meaning.
