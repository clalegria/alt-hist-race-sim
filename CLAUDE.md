# CLAUDE.md

## Project
**alt-hist-race-sim** (working name) — an alternate-history motor racing simulator.
Starts from a real season — 1950 to 2026, all authored — and simulates forward, year by
year, diverging from history as it goes. Drivers and teams have 1–100 attributes; races
are resolved probabilistically; drivers age, move between teams via a transfer market,
and retire; statistics accumulate over the run. Eventually this should also become a
videogame though the specifics are not yet planned.

Hobby project for learning modern TypeScript/React, and especially how to work with
Claude Code itself. Will eventually be shared publicly. ~98% of the code is
AI-generated, so the rules below are the guardrails that keep the project coherent —
follow them.

**The author is an experienced programmer in non-web legacy languages, but new to
TypeScript, React and web development.** When making a design decision, explain it with
that in mind: name the web-dev convention or framework idea involved and why it fits.

## Current phase
**Phase 1: browser-only. No backend, no database, no user accounts.** The engine runs
client-side. Do NOT introduce a server, an HTTP API, or a database in this phase.
Seasons are authored one JSON file per year in `packages/data/src/seasons/`
(`.claude/rules/seed-data.md`).

## Documentation, and keeping it current
- `docs/ROADMAP.md` is what to build next, in order; `docs/DECISIONS.md` is what is still
  open. **Read both before starting new feature work.**
- `docs/design/*.md` design a large subsystem before it is built, marking each point
  DECIDED, PROPOSED (confirm first) or OPEN, and own that subsystem's open questions.
  As parts are built they move to `.claude/rules/` and leave the design doc; when
  nothing is left, delete it.
- `.claude/rules/*.md` hold subsystem detail, path-scoped by YAML `paths:` so each loads
  when matching files are opened. Document a new subsystem there, not here: this file is
  re-injected after `/compact` and holds only project-wide invariants, commands, glossary
  and conventions.
- **Keeping every `.md` file current is Claude's job, not the author's.** When a change
  makes a doc wrong or incomplete, fix the doc in the same piece of work: delete finished
  roadmap items, take settled questions out of DECISIONS.md, make rule files follow the code.
- **Keep them short.** Say a thing once, in the file that owns it, and point to it
  elsewhere. No history, no anecdotes, no account of how a number got its value. This file
  stays ≤150 lines; a rule file ≤~150, split by narrower path scope past that.
- **When unsure whether a detail can go, ask the author.** Don't keep it by default and
  don't drop it silently.

## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # Vitest across all packages
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # ONE race (--phase start|end; --wet 0-1 forces the weather)
pnpm season [seed] # simulate a full season, print both championships
pnpm calibrate [n] # run a grid n times (default 5000), print distributions
pnpm calibrate-season [n]  # a whole SEASON n times: title%, win%, score%, avg points
pnpm retirements [n]  # retirement rate per year vs real; --sweep re-fits the factor
pnpm progression <driver>  # one driver's ageing curve, age 16-55 (no arg lists the pool)
pnpm tune          # rating tuner (prints proposals, writes nothing)
pnpm fit <year>    # fit a season's chassis/engines to its real results; --write applies
pnpm screenshots   # the main screens to PNGs in tools/screenshots/out (.claude/rules/screenshots.md)
```

## Architecture rules (invariants — do not violate)
- **The engine is pure.** `packages/engine` imports nothing outside itself, does no I/O
  (no `fetch`, no file reads, no `Date.now()`) and has **zero dependencies**, runtime or
  dev. That is what keeps it testable and portable.
- **No `Math.random()` in the engine.** All randomness comes from an injected seeded PRNG;
  reproducibility is a hard requirement.
- **Identity is separate from state.** `Driver` and `Team` are immutable; ratings and
  per-season facts live in per-season records. A team's name, base and livery are eras,
  read via `teamIdentityIn` / `teamLiveryIn`.
- **Results are the source of truth.** Store a result row per (driver, race) and derive
  every statistic on read; never keep running counters as primary data.
- **One serialisable world-state object**, plain data only, in one store (Zustand), never
  scattered across component state. The `Rng` holds a closure, so store its `getState()`
  snapshot and rebuild with `createRngFromState()`.
- **Tunable numbers live in one constants module per subsystem**, never inline in logic
  (pattern: `packages/engine/src/race/constants.ts`).
- **Never tune a number unless asked.** Engine constants and the authored ratings in
  `packages/data/src/*.json` are the author's. Do not move them as a side effect of other
  work, and do not run a harness to check a figure. The one other exception: a change to
  how performance is computed (a new score term, a new entity between driver and result,
  a new race model) changes what a rating means. Say so and agree before touching
  numbers. **Never describe a number as fitted, calibrated, measured or stale**: the
  values move by hand, and the note goes out of date.

## Domain glossary
- **Entry**: one team's season — team + chassis + engine + drivers.
- **Chassis spec / engine spec**: authored per season; an engine has no consistency. The
  **car spec** is their blend through `powertrain()`, what the model scores and what the
  UI's overall uses. `.claude/rules/race-powertrain.md`.
- **Peak vs aged**: authored peak, or that season's ability via the ageing curve. The app
  defaults to peak; **harnesses run `aged`** (`tools/calibrate/src/mode.ts`).
- **Ranking rule**: overall, then racing, then name or id (`compareByRating` in
  `packages/data/src/rating.ts`). One rule for every list on screen and every grid reseat.
- **Score-and-sort**: the v1 race model behind `RaceModel`: one noisy score per driver,
  sorted, then DNFs. `.claude/rules/race-engine.md`.
- **Round context**: where a round is held and how far through the year it is; the seam
  circuit features will hang off.
- **Development trend**: a car's pace drifting across a season about its authored rating.
  `car-development.md`.
- **Retirement factor**: a season's 1–10 dial for how hard the year is on its cars.
  `retirement-factor.md`.
- **Wetness**: how wet a wet round is, a range not a switch. `wet-weather.md`.
- **Randomness level**: 1–5, fixed before a run. `DEFAULT_RANDOMNESS_LEVEL` (1) is the
  reference every harness uses; only level 2 is unscaled; the app opens on 2.
  `race-randomness.md`.
- **Team form**: the share of session noise that belongs to the team rather than the car,
  so it cancels out of a teammate comparison. `race-engine.md`. To be renamed: *form*
  belongs to the planned driver market (`docs/design/era-advanced.md`).

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- **No build step.** Packages export TypeScript source (`"exports": "./src/index.ts"`);
  `tsc --noEmit` is the correctness check.
- Every engine module ships with Vitest tests; `apps/web` is tested at the store and
  smoke-render level. Favour property-style checks: finish order is a valid permutation,
  nobody finishes twice, DNFs remove cars.
- **No test may depend on an authored number or on what a seed produced**; both move.
  - Assert the *rule* against synthetic ratings (the `driver()` fixture in
    `apps/web/src/lib/rating.test.ts`), never an authored rating or a comparison of two.
  - A fixed seed is a fine fixture; asserting its outcome is not. When a test needs a
    season of a particular shape, search for one with `findWorld`
    (`apps/web/src/test-support.ts`).
  - Derive counts (`field.length`, `season.calendar.length`); never hard-code them.
  - Naming a driver or team as an identity is fine; what they are worth is not.
- **Mutation-check statistical tests**: break the implementation on purpose, confirm the
  test fails, revert.
- **Read `Test Files`, not just `Tests`**: a file that fails to compile is not counted in
  the `Tests` line.
- **Dependencies:** when pnpm's release-age policy rejects a fresh version, pick the
  previous stable one; never add a `minimumReleaseAgeExclude`. `tools/*` may use dev
  dependencies; the engine takes none. Secrets live only in a gitignored `.env`.

## Open decisions (confirm with the author — do not assume)
In full in `docs/DECISIONS.md`.
- **The advanced era and game mode**: open questions in `docs/design/era-advanced.md`.
- **Should the fitter and tuner ever move driver ratings?**
- **Which router** (TanStack Router is the leaning).
- **What a saved or shared run replays against**, when both the author and the reader
  can change the data under it.
