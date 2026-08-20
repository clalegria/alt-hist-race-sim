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
5. ✅ Full season loop + championship standings. Tests.
6. ✅ `apps/web` (React + Vite) rendering one season's results.

**The first milestone is complete.** What comes next is gated on the open decisions
at the bottom of this file — the ageing curve in particular, since driver ratings
cannot be tuned until it exists.



## Commands
```
pnpm dev           # the web app on http://localhost:5173
pnpm build         # production build of the web app
pnpm test          # 231 tests (137 engine, 13 data, 81 web)
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

## Tech stack (decided)
- Language: TypeScript 7, `strict: true` plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals`.
- Monorepo: pnpm workspaces (pnpm 11, Node 24). Build/dev: Vite.
- **No build step.** Packages export TypeScript source directly
  (`"exports": "./src/index.ts"`); Vite/Vitest/tsx transpile on the fly.
  `tsc --noEmit` is the correctness check. Add a real build only if something
  needs to consume these packages from plain Node.
- UI: React. Styling: Tailwind CSS + shadcn/ui (copied in, not a dependency; the
  Radix primitives those components wrap *are* dependencies — currently
  `@radix-ui/react-popover`). Flags: `country-flag-icons`. State: Zustand.
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
  src/season/              # season loop + derived championship standings
packages/data/src/         # the three seed JSON files, typed loader, buildField
apps/web/src/              # React + Vite season viewer
  store/season.ts          # the one Zustand world-state store + the reveal cursor
  components/SeasonView.tsx # props-driven; renders one stage of the reveal
  components/ui/           # shadcn-style primitives, copied in
tools/calibrate/src/       # race + season viewers, Monte Carlo harness, rating tuner
```
Planned, not yet written:
```
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

## Season model — implemented
`simulateSeason(field, rounds, rng, raceConstants?, model?)` runs the same field
`rounds` times and returns `{ races }` — nothing else. A race's index in that array
is its round number.

**One RNG threaded through the whole year**, not re-seeded per race, so a season is
a single continuous stream and round 7 depends on everything drawn before it.
Changing an early round changes the rest of the year. That is the honest behaviour,
and it means a bug report needs one seed rather than fourteen.

The race model goes in as a parameter (`RaceModel`, defaulting to score-and-sort),
so the season loop never reaches for `simulateRace` directly and a richer race model
drops in without touching it.

The field is fixed for the whole season. Mid-season seat changes belong to the
market; when it exists, this loop takes a field per round instead of one for the year.

**Standings are derived, never accumulated.** `championshipStandings(season,
constants?)` and `constructorStandings(season, constants?)` build their tables from
the stored results on read. Nothing anywhere keeps
a running points total — that would be a second source of truth waiting to disagree
with the first. Order is points, then countback (most wins, then most seconds, and so
on down, as 1980 did), then driver id so the order is total and never depends on the
sort implementation.

Both tables are the same tally keyed differently, so they cannot drift apart. A
constructor scores with **both** cars — the rule from 1979 onward, and the only one
this sim needs, since it starts in 1980 and runs forward. That makes a team's
`starts`, `wins` and `podiums` per car rather than per race (a two-car team that
finished all fourteen rounds with both cars has 28 starts), while `poles` stays per
race because only one car starts from pole.

Points come from `season/constants.ts` as a plain array, `pointsByPosition`, best
first. Its *length* is how many places score, so the late-2010s
25-18-15-12-10-8-6-4-2-1 drops in as a different array and nothing else changes.
Default is the 1980 scale, 9-6-4-3-2-1.

**The dropped-scores rule is deliberately not modelled** (author's call). 1980 counted
each driver's best five results from the first seven races and best five from the last
seven, so real totals are lower than every-race totals — Jones scored 71 gross against
67 counted. Here every race counts, and a simulated Jones season lands around 72.

## Data model
Seed files (in `packages/data/src/`):
- `drivers.json` — 41 drivers. `{ id, name, nationality, birthYear, debutSeason,
  peak: { season, racing, qualifying, consistency, adaptability, composure },
  developmentSpeed, declineSpeed }`.
- `teams.json` — 15 teams. `{ id, name, base, foundedYear }`.
- `season-1980.json` — 14 rounds, 15 entries, 28 seats. `{ year, calendar: [{ round,
  name, circuit, country }], entries: [{ teamId, car: { racing, qualifying,
  consistency, reliability }, drivers: [driverId, ...] }] }`. `country` is an ISO
  3166-1 alpha-2 code, matching `nationality` on drivers and `base` on teams.

Notes:
- All five driver attributes share polarity: higher = better. `composure` replaced
  "mistakes" for this reason (low composure = crash-prone).
- 13 drivers hold no 1980 seat. They exist in the pool, available to the market.
  Intended, not a bug.
- `adaptability` is authored but unused so far — it is for the market and progression.
- **The calendar is cosmetic and nothing else.** It exists so results can be labelled
  "Round 12, Italian Grand Prix at Imola" — circuits have no properties and the engine
  never sees it, so every round is the same race. `calendar.length` is the season's
  round count, and `validateSeedData` checks each `round` matches its position, since
  a number out of step would mislabel every result printed against it.
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

## Web app — implemented
`apps/web` reveals a season a session at a time. `pnpm dev` to run it, `pnpm build`
to produce a static bundle.

**The reveal is a view, not a schedule.** The whole year is simulated the instant a
seed is drawn — one continuous RNG stream through every round, which is what makes a
season reproducible. `View` in `store/season.ts` is a cursor over results that
already exist:

```
grid → qualifying 1 → race 1 → qualifying 2 → race 2 → … → summary
```

"Simulate next session" is a promise about what the reader sees next, not about when
the dice are rolled; the results are identical either way. `advance()` is a pure
function over that cursor, and `actionsFor()` in `App.tsx` is the whole of the
navigation — both are tested directly, because getting either wrong strands the
reader mid-season.

**The grid opens closed.** The first page is teams and drivers with a flag, an age
and one overall rating each. The five individual ratings live behind a popover on
each name; teams are listed alphabetically, not by pace, so the pecking order is not
given away before a wheel turns. A test asserts no individual rating label appears in
the closed markup.

`lib/rating.ts` computes the overall. It is a **display heuristic, not model truth** —
nothing in the engine reads it — but its weights approximate how much each rating
actually moves results, so the number describes the sim it sits on top of. Racing
leads for both. Reliability takes a quarter of the car number despite touching no
score in the race model, because ~42% of the 1980 field failed to finish and a
fragile car forfeits points it had the pace to take. Adaptability is weighted zero:
nothing reads it, and paying for it would claim a driver is better at something the
sim never asks of them. Revisit both when the transfer market lands.

**A race shows its result and the championship side by side**, the standings cut to
position, name and points and to the top eight, with a button for the rest. After a
single round the full table's wins, podiums, poles and retirement counts are almost
all zeroes; what a reader wants is who leads and by how much. The full breakdown
belongs to the summary, and lives there.

**Actions live in a sticky header, repeated at the foot of the page**, and every
stage change scrolls back to the top. Stepping on from a race otherwise meant
scrolling past two 28-row championship tables to find the button, then landing
mid-page in the next session.

Flags appear beside every driver and every team everywhere they are named — via one
shared `DriverName` / `TeamName` pair, so they cannot end up in some tables and not
others — plus on the two champion cards and beside each round in the calendar. They are SVGs from
`country-flag-icons`, imported **one country at a time** in `components/Flag.tsx`. Emoji flags were tried first and do not render on Windows at
all. `import * as Flags` reads better and costs 240 kB, since the namespace defeats
tree-shaking and pulls in all ~250 flags for the twenty this sim uses — so the map is
explicit, and `Flag.test.tsx` fails if the seed data grows a country it does not
cover.

Mid-season standings need no special support: the championship is derived from
results on read, so `{ races: races.slice(0, n) }` *is* the table after round n. That
is the results-are-the-source-of-truth rule paying rent.

A fresh random seed is drawn on every page load and by **Start again**. That is not a
violation of the no-`Math.random()` rule: the ban is on the *engine*, where every
outcome must come from the injected PRNG or nothing is reproducible. Choosing *which*
seed to run is a user action that happens before any generator exists, so it lives in
`lib/seed.ts` in the app and never in `packages/engine`. The seed is shown in the
footer, deliberately without prominence.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, rngState, field, season }`) and nothing else. `field` is the grid
exactly as raced — every driver and car rating that fed the simulation. It is stored
rather than re-read from the seed files because it will stop being derivable from
them: once the ageing curve lands, ratings are rolled per run and this becomes the
only record of what they were. No `Rng` — it holds a closure
and cannot be serialized, so what is stored is its numeric `getState()` snapshot,
which `createRngFromState` turns back into a generator positioned exactly where the
season ended. `JSON.stringify(world)` is therefore already a complete save file, and
tests assert both the round trip and that no function or class instance has crept in.

View state that says nothing about the simulation — which race row is expanded —
stays in component `useState`. The rule is that *simulation* state lives in the one
store, not that React may never hold anything.

**Standings are derived in the component, not stored.** `championshipStandings` and
`constructorStandings` run in a `useMemo` off `world.season`, the same
results-are-the-source-of-truth rule the engine follows.

`buildField` moved from `tools/calibrate` into `packages/data`, since the app needs
the same authored-seed-to-race-field mapping and duplicating a placeholder for the
ageing curve would mean two things to fix later. Its dependency on the engine is
type-only and erases at build time, so no runtime edge exists in either direction.

Tests are Vitest with no jsdom. `SeasonView` takes the world and the cursor as
**props** rather than reading the store, so every stage of the reveal renders through
`renderToStaticMarkup` without a DOM and without clicking through fourteen rounds;
`App` is the thin shell that connects it. That split exists partly for structure and
partly because zustand serves `getInitialState()` as the useSyncExternalStore *server*
snapshot — a static render always shows the world the store was built with, whatever
has been simulated since. That is SSR-only and irrelevant to a client-rendered SPA,
but it is why store updates are asserted in the store's own tests.

What this level cannot reach: the click handlers themselves, the scroll-to-top
effect, and popover contents, which Radix does not render while closed. All three
would need jsdom.

Biome needs `css.parser.tailwindDirectives` to parse Tailwind 4's `@theme`; it is on
in `biome.json`.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- Every engine module ships with Vitest tests. `apps/web` is tested at the store and
  smoke-render level rather than component by component. Favour property-style checks (finish
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
- **Circuits have no character.** The calendar in `season-1980.json` is names only,
  and `simulateSeason` still takes a round *count* rather than the calendar, so every
  round is the same race. Giving tracks real properties (a power circuit favouring the
  Renault turbo, a street circuit favouring grid position, a per-circuit lap time to
  anchor the cosmetic gaps) means passing the calendar into the engine and deciding
  what a circuit does to the score. Not started.
