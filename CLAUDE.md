# CLAUDE.md

## Project
**alt-hist-race-sim** (working name) — an alternate-history motor racing simulator. Starts from a fixed season (1980) and
simulates race results forward, year by year, diverging from real history.
Drivers and teams have 1–100 attributes; races are resolved probabilistically;
drivers age, move between teams via a transfer market, and retire; statistics
accumulate over the run.

Hobby project for learning modern TypeScript/React. Will eventually be shared
publicly as a static site. ~90% of code is AI-generated, so the rules below are
the guardrails that keep the project coherent — follow them.

## Current phase
**Phase 1: browser-only. No backend, no database, no user accounts.** The engine
runs client-side; saves (a later phase) will go to IndexedDB. Do NOT introduce a
server, an HTTP API, or a database in this phase.

First milestone:
1. ✅ pnpm workspace + `packages/engine` (pure TS, strict, Vitest, Biome).
2. ✅ Seeded PRNG (sfc32, injectable). Same seed → same sequence.
3. ✅ Single-race score-and-sort simulator.
4. ✅ Monte Carlo harness (`tools/calibrate`) + one calibration pass against 1980.
5. ⬜ **NEXT:** full season loop + championship standings. Tests.
6. ⬜ Only then: `apps/web` (React + Vite) rendering one season's results.

Nothing is committed yet — the whole project is still an uncommitted working tree.

## Commands
```
pnpm test          # 107 tests (98 engine, 9 data)
pnpm typecheck     # tsc --noEmit across all packages
pnpm lint          # biome check .
pnpm format        # biome check --write .
pnpm race [seed]   # simulate ONE race on the 1980 grid, print the classification
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

## Tech stack (decided)
- Language: TypeScript 7, `strict: true` plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals`.
- Monorepo: pnpm workspaces (pnpm 11, Node 24). Build/dev: Vite.
- **No build step.** Packages export TypeScript source directly
  (`"exports": "./src/index.ts"`); Vite/Vitest/tsx transpile on the fly.
  `tsc --noEmit` is the correctness check. Add a real build only if something
  needs to consume these packages from plain Node.
- UI: React. Styling: Tailwind CSS + shadcn/ui (copied in, not a dependency). State: Zustand.
- Charts: Recharts (when needed). Tests: Vitest 4. Lint/format: Biome 2.
- `tools/*` may use dev dependencies (tsx runs the TS directly). The engine may not.
- Local persistence (later): Dexie over IndexedDB + JSON export/import.
- Backend (only if/when needed, NOT now): Hono + SQLite/Postgres + Drizzle.

## Repo structure
Built so far:
```
packages/engine/           # pure sim, zero deps, heavily tested
  src/model/ratings.ts     # DriverRatings, CarSpec — types only
  src/rng/                 # sfc32 PRNG behind an Rng interface
  src/race/                # score-and-sort race model + its constants
  src/race/gaps.ts         # cosmetic score → seconds/laps, no effect on results
packages/data/src/         # the three seed JSON files + typed loader
tools/calibrate/src/       # race viewer, Monte Carlo harness, rating tuner
```
Planned, not yet written:
```
packages/engine/src/season/       # calendar, championship points  ← next
packages/engine/src/market/       # driver transfers
packages/engine/src/progression/  # ageing, car development
apps/web/                         # React + Vite
```
The seed JSON lives in `packages/data/src/`, imported statically and re-exported
under types derived from the JSON itself. `packages/data/src/type-checks.ts` fails
the typecheck if the types and the JSON drift apart.

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

## Race model (v1) — implemented
Four stages, all constants in `race/constants.ts`:
1. **Qualifying** — `0.72·car + 0.28·driver − consistencyPenalty + noise`, sorted → grid.
   The whole entry list runs, however big it is.
2. **The cut** — the fastest `maxStarters` (26, the 1980 limit) take the start.
   Anyone slower keeps their grid position but is a **DNQ**: `started: false`,
   `raceScore: null`, and *not* a retirement. `retirements` and `classifiedCount`
   count starters only; `nonQualifiers` counts the rest. A field at or under the
   limit is unaffected, so this is inert rather than something to switch off.
3. **Race** — `0.70·car + 0.30·driver + gridBonus − consistencyPenalty + noise`,
   sorted → finishing order. Grid bonus decays exponentially from 3.0 points at pole.
4. **DNFs** — two independent rolls per car: mechanical (from car reliability) and
   driver error (from composure). Both always rolled; mechanical takes precedence
   when recording the cause.

**Gaps are decoration.** `qualifyingGapToPole` and `raceGapToWinner` are pure
functions of the scores, computed in `race/gaps.ts` from four constants. The model
has no time dimension at all — no laps, no distance, no circuits — so a gap is a
monotone relabelling of the sort key and cannot disagree with the finishing order
or add information to it. Nothing in the sim reads them back; do not build
championship logic on them.

Qualifying is linear (`0.15 s` per rating point). The race is a power curve,
`0.9 · deficit^1.5` seconds, because one seconds-per-point factor cannot serve both
ends: winner-to-second runs ~3 rating points while winner-to-last runs ~45, so
linear either bunches the field into a few seconds or puts the runner-up a minute
back. The exponent keeps the lead battle tight while the tail stretches into whole
laps, converted at a nominal 90-second lap (`nominalLapSeconds`, one value for every
circuit, since there is no track data). Set `raceGapExponent` to 1 for a linear map.

These are eyeballed for plausibility against 1980, not fitted, and gaps shrank a lot
by the 2000s — expect to revisit the constants alongside the era work rather than
treating the current values as calibrated.

Non-qualifiers still draw their race noise and both DNF rolls, and the results are
thrown away. Skipping the draws would make every later car's position in the RNG
stream depend on who made the cut, which breaks append-independence — the invariant
that adding a car to the end of the field cannot change anyone else's weekend.

**Consistency is a pace stat, not a variance stat.** Combined consistency (50/50
car and driver) subtracts `consistencyPacePenalty`, interpolated 4.0 points at 0
down to 0 at 100, from *both* session scores. Across the 1980 grid (combined
consistency runs 46–90) that is a ~1.8 point spread, worth ~6 driver rating points.

This is deliberate and was arrived at by measurement. Consistency originally scaled
the *spread* of the noise (1.6× at 0 down to 0.5× at 100), which is mean-neutral and
therefore not a handicap at all — worse, it inverted win rates, because winning from
behind is an upper-tail event and a wider tail hands a slow car more victories. A
skewed-noise variant (stretching only the bad half) was built and measured too: it
fixes average finishing position but *cannot* fix wins, since it leaves the upper
tail untouched by construction. Only flattening the spread and moving the mean makes
a less consistent pairing worse on every measure at once — fewer wins, fewer poles,
worse average finish, no compensating upside.

`consistencyNoiseMultiplierAtZero/AtHundred` survive as a lever, both pinned at 1.0.
Reopening a gap between them trades strict dominance back for streakier racing.

**Weekend form ties the two sessions together.** `weekendFormShare` (0.4) splits each
session's noise into a shared per-car, per-weekend draw and an independent per-session
draw, weighted `sqrt(share)` and `sqrt(1 − share)` so each session's total sigma is
unchanged and the correlation between the two noise terms equals the share exactly. A
driver who has the car under him on Saturday tends to still have it on Sunday. 0
restores independent sessions; 1 makes the race a deterministic function of qualifying
(every race processional), so it is a bound, not a target.

The car is weighted far above the driver on purpose: a great driver in a poor car
should be a points-scorer, not a winner. `mechanicalDnfEraScale` (default 1.0 = 1980)
is the hook for reliability improving across decades — the per-year curve is not
defined yet and belongs to the progression model.

`simulateRace(field, rng, constants?)` takes constants as an optional override, which
is how the calibration tools sweep values without editing source.

## Data model
Seed files (in `packages/data/src/`):
- `drivers.json` — 41 drivers. `{ id, name, nationality, birthYear, debutSeason,
  peak: { season, racing, qualifying, consistency, adaptability, composure },
  developmentSpeed, declineSpeed }`.
- `teams.json` — 15 teams. `{ id, name, base, foundedYear }`.
- `season-1980.json` — 15 entries, 28 seats. `{ year, entries: [{ teamId,
  car: { racing, qualifying, consistency, reliability }, drivers: [driverId, ...] }] }`.

Notes:
- All five driver attributes share polarity: higher = better. `composure` replaced
  "mistakes" for this reason (low composure = crash-prone).
- 13 drivers hold no 1980 seat. They exist in the pool, available to the market.
  Intended, not a bug.
- `adaptability` is authored but unused so far — it is for the market and progression.
- Seed ratings are tuned via the Monte Carlo harness, never guessed in code.
  **Car ratings have had two calibration passes** against the 1980 season (see below).
  **Driver ratings have not**, deliberately — see Open decisions.
- The seed JSON is exempt from Biome formatting (`overrides` in `biome.json`) to keep
  its one-record-per-line layout. Do not reformat it.

## Calibration status
Against the real 1980 season (14 races), at 20,000 simulated races:

| Team | Model win% | Actual | Model pole% | Actual (approx) |
|---|---|---|---|---|
| Williams | 43.4% | 42.9% | 27.6% | ~21% |
| Renault | 21.3% | 21.4% | 44.1% | ~43% |
| Brabham | 19.9% | 21.4% | 8.6% | ~7% |
| Ligier | 15.1% | 14.3% | 19.8% | ~21% |

Retirements 41.1% of the 26 starters, matching the era. (This was 42.0% before the
starting limit landed; the two cars that now miss the cut are unreliable ones, so
dropping them out of the denominator moves the rate slightly. Win and pole
percentages did not shift at all — the cut only ever touches the back of the grid.)
Reference targets live in `tools/calibrate/src/targets.ts`.

The 28-entry 1980 grid means two DNQs a weekend. They fall where they should: Shadow
takes 58.2% and 99.6% (Kennedy failed to qualify for all seven races he entered in
reality), Osella 34.2%, ATS and Ensign under 3%, and nobody above them ever misses.

The consistency pace penalty is a systematic term that did not exist when the cars
were first tuned, and it cost Renault disproportionately (Arnoux and Jabouille are
both below-average consistency, and Renault's whole 1980 identity was qualifying
pace). Absorbed with a second car pass: **Renault qualifying 90 → 91, racing 93 → 95**.
That lands every headline number closer to target than the pre-penalty calibration did.

Known accepted gaps: Alfa Romeo takes 0% of poles (Giacomelli's real 1980 pole was a
freak; forcing it would distort the car). Williams still over-takes poles (27.6% vs
~21%). Reutemann over-wins at 16.6% against 1 real win (a one-event sample — not worth
fitting).

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- Every engine module ships with Vitest tests. Favour property-style checks (finish
  order is a valid permutation; nobody finishes twice; DNFs remove cars) alongside
  seeded-outcome assertions.
- **Statistical tests must be mutation-checked.** A distribution test that passes
  against a deliberately broken implementation is worthless. Break it on purpose,
  confirm it fails, revert.
- Secrets (none in phase 1) live only in gitignored `.env`.
- Do not add runtime dependencies to `packages/engine` without a strong reason.

## Open decisions (confirm with the author before implementing — do not assume)
- **Season vs age for curves.** Recommended: convert `debutSeason` / `peak.season`
  to ages on load via `birthYear`, so career arcs travel with the driver under
  divergence. Alternative: keep calendar-pinned. NOT finalised — ask before writing
  the ageing function.
- **Peak-scatter shape.** Symmetric vs slightly downward-skewed (busts more common
  than overachievers). Symmetric is acceptable for v1; flagged as a lever.
- **Debut/peak gap.** Roll realized peak as an offset from realized debut (min gap
  ~3–5 seasons) rather than independently, to avoid a driver peaking right after debut.
- **Driver ratings are un-tuned and cannot be tuned yet.** 15 of the 28 seated drivers
  peak *after* 1980 (Prost +7 years, Piquet +5, Arnoux +3), and the tools currently
  feed `peak` ratings in as current ratings because no ageing curve exists. Tuning
  them against 1980 results would bake in an error that inverts once ageing lands.
  Only Jones (peak 1980) and Reutemann (peak 1979) have been touched.
  **Re-tune the driver pool after the ageing curve exists, not before.**
- **Reliability era curve.** `mechanicalDnfEraScale` exists but no per-season curve is
  defined. 1980 needs ~42% retirements; a 2026 season needs closer to 10%. Decide
  whether that comes from rising reliability ratings, a falling era scale, or both.
- **Consistency's spread lever is parked, not gone.** Settled for now: consistency
  is a pure pace stat, so an erratic driver is strictly worse and never luckier.
  The cost is that consistency no longer changes the *shape* of a driver's results,
  only their level — it behaves like a second speed rating. If the sim later wants
  genuine wildcards (a backmarker who occasionally steals a podium), reopen the gap
  in `consistencyNoiseMultiplier*` and accept that it also hands them extra wins.
  A middle option exists and is untried: stretch the bad tail *and* compress the
  good one, which keeps some asymmetry while capping the ceiling.
- **Weekend-form share is a first guess.** 0.4 was picked for plausibility, not
  fitted — 1980 grid-to-finish correlation was never measured against the real
  season. Worth a pass once season results exist to compare against.
- **Starting limit per era.** `maxStarters` is a single constant pinned at 26 for
  1980. Real limits moved (and modern grids sit under any of them), so it probably
  belongs to the season/progression data rather than the race constants once more
  than one season exists. Related and unmodelled: real 1980 DNQs were decided by
  pre-qualifying and by teams entering different cars at different rounds, whereas
  here the same 28 entries contest every race.
- **Points system.** Not yet implemented. 1980 used 9-6-4-3-2-1 for the top six with
  best-N-scores dropped — confirm whether to model the dropped-scores rule.
