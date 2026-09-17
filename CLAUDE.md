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
discovered by that folder's `index.ts` — no registry to update. Each carries a calendar,
a points scale, an **engine table**, a **retirement factor** and an entry list. All 77
are written. `.claude/rules/seed-data.md` has how discovery works.

**The foundation is complete**: seeded PRNG, score-and-sort race model, season loop,
derived championships, Monte Carlo harness, and a React web app revealing a season
session by session.

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
pnpm test          # 1412 tests (303 engine, 144 data, 965 web)
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # ONE race (--phase start|end; --wet 0-1 forces the weather)
pnpm season [seed] # simulate a full season, print both championships
pnpm calibrate [n] # run a grid n times (default 5000), print distributions
pnpm calibrate-season [n]  # a whole SEASON n times: title%, win%, score%, avg points
pnpm retirements [n]  # retirement rate per year vs real; --sweep re-fits the factor
pnpm progression <driver>  # one driver's ageing curve, age 18-50 (no arg lists the pool)
pnpm tune          # rating tuner (prints proposals, writes nothing)
pnpm fit <year>    # fit a season's chassis/engines to its real results; --write applies
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
  is deterministic — but if per-run scatter on a driver's debut or peak ever lands, roll it
  ONCE via the seeded PRNG, store it in that driver's per-sim state, never re-roll on read.
- **Tunable numbers live in one constants module per subsystem**, never inline in logic.
  `packages/engine/src/race/constants.ts` is the pattern to follow.
- **Never tune a number unless explicitly asked.** Engine constants
  (`race/constants.ts`, `season/constants.ts`) and the authored driver/team/car ratings in
  `packages/data/src/*.json` belong to the author, who moves them by hand and with the
  harness. Do not adjust them as a side effect of building something else — not to
  "absorb" a new feature, not because a figure drifted a point, not because a Monte Carlo
  run looks off — and do not run the harness to check. The failure mode is expensive and
  invisible: every feature invites a re-tune, each costing a long measurement loop. Two
  overrides, and only two: **(a)** the author asks; **(b)** a deep change to how
  performance is computed — a new term in the race score, a new entity between driver and
  result (the ageing curve, engine manufacturers), a different race model — which changes
  what a rating *means*. Even then, say so and get agreement first, rather than tuning.
  **Do not describe a number as fitted, calibrated, measured or stale**, here or anywhere
  else: the values move by hand between sessions, so any such claim is out of date the
  moment it is written, and a stale provenance note is worse than none.

## Domain glossary
- **Entry**: one team's season — team + chassis + engine + drivers.
- **Chassis spec** (`ChassisSpec`): a team's per-season chassis — racing, qualifying,
  consistency, reliability. Authored, and **not** what is scored.
- **Engine spec**: a manufacturer's per-season unit — racing, qualifying, reliability;
  three not four, consistency being the chassis'. `engines.json` is identity.
- **Car spec** (`CarSpec`): the blend of the two, and what the model scores. Same
  shape as `ChassisSpec`; the name marks what has been through `powertrain()`.
- **Powertrain**: that blend, by **two ratios, not one**. Pace is `0.7 · chassis +
  0.3 · engine`, reliability an even `0.5 / 0.5`; **the UI's overall calls it too**.
- **Peak vs aged**: the two rating modes — authored peak, or ability that season via the
  ageing curve. App defaults to peak; **harnesses run `aged`, never `peak`** (`mode.ts`).
- **Score-and-sort**: v1 race model — one number per driver from attributes + car + home
  advantage + noise, sorted, then DNFs. Behind `RaceModel`, so it can be replaced.
- **Round context**: where a round is held (`country`) and how far through the year it
  is (`seasonProgress`, 0→1); the seam circuit features hang off.
- **Development trend**: optional `-10..10` per car per season — `+n` starts the year n
  points slow and ends n quick, rotating about mid-season so the authored rating is
  unmoved on average. Pace only, out of the overall. `.claude/rules/car-development.md`.
- **Retirement factor**: 1–10 per season file, how hard the year is on its cars. Scales
  *both* DNF rolls; 5 is neutral. `.claude/rules/retirement-factor.md`.
- **Wetness**: ~15% of rounds are wet, and a wet one draws a `0.2–1` wetness — a range,
  not a switch. It scales the noise, both DNF rolls, the car/driver and engine/chassis
  splits, and a blend toward each driver's authored `wetWeather` rating; a dry round
  returns the dry constants *by identity*. `.claude/rules/wet-weather.md`.
- **Randomness level**: 1–5, how much the dice decide, fixed before a run. Scales both
  noise sigmas, plus `teamFormBoost` at 4–5. Only level 2 leaves them **unchanged**
  (`CALIBRATED_RANDOMNESS_LEVEL`); the **default is 1**, so a default run is 0.85 of it.
- **Team form**: the share of session noise belonging to the *team* not the car (0.85),
  crossed with **weekend form** (0.5), carrying Saturday into Sunday. Two axes, four
  draws; team form cancels out of a teammate comparison — which is the point.
- **Progression model**: the swappable seam between the two planned modes —
  `SeasonProgressionModel` with `nextSeasonEntries()` / `nextSeasonCars()`. Build
  `EvolutionaryProgression` (random walk + mean reversion) first, `Historical` later.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- **No build step.** Packages export TypeScript source directly
  (`"exports": "./src/index.ts"`); Vite/Vitest/tsx transpile on the fly, and `tsc
  --noEmit` is the correctness check. Add one only if plain Node must consume these.
- Every engine module ships with Vitest tests. `apps/web` is tested at the store and
  smoke-render level rather than component by component. Favour property-style checks:
  finish order is a valid permutation, nobody finishes twice, DNFs remove cars.
- **No test may depend on an authored number or on what a particular seed produced.**
  The driver, team and car ratings and the season seeds move continuously, so a
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
    anything.** Its figures are one measurement of a model that keeps moving, not a test,
    and re-measuring on spec is a long loop answering a question nobody asked.
- **Statistical tests must be mutation-checked.** A distribution test that passes against
  a deliberately broken implementation is worthless. Break it on purpose, confirm it fails,
  revert. This has repeatedly caught tests that asserted nothing — a counter blind to
  `gaussian()`, a tie-break case that was not tied, an assertion read off the engine.
- **Check `Test Files`, not just `Tests`, when reading a Vitest run.** A file that fails
  to *compile* is not counted in the `Tests` line, so a broken test file leaves a run
  looking green. `Test Files 11 passed (11)` proves everything was collected.
- **New dependencies are checked against a release-age policy.** pnpm rejects packages
  published within the last few days and offers a `minimumReleaseAgeExclude` entry in
  `pnpm-workspace.yaml`. Do not take it — pick the previous stable version instead: fresh
  versions are the window a compromised package lands in (once here, a hours-old Vite).
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
- **Per-run scatter on the ageing curve** — settled as *no scatter for now*; the curve is
  deterministic. Peak shape matters again only if that reopens.
- **Should the tuner see a season's retirement factor?** `pnpm tune` works at the neutral
  factor against `targets.ts`, while every season carries its own — so the tuner is
  answering a slightly different question from the one the season asks. Either change is a
  tuning decision, and the author's.
- **Consistency's spread lever is open** (1.3 / 0.75): it buys wildcards, and hands the
  best pairing a little more win share than a flat 1.0 would. Wet racing's retirement
  drift is corrected — the four DNF endpoints carry x0.985 / x0.90
  (`.claude/rules/race-constants.md`) — its win-share drift deliberately is not.
- **Circuits have no character** — `RoundContext` opened the door (`wetChance` is already
  there, unused); what a circuit *does* is undecided, as are the home-advantage numbers.
- **What moves the driver market** — a design conversation, not a coding task; and it is
  why `driverOverall` still weights `adaptability` at zero (a display heuristic in
  `packages/data/src/rating.ts`, re-weighted 2026-09-02 toward racing).
