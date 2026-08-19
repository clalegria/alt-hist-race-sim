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

First milestone, in order:
1. pnpm workspace + `packages/engine` (pure TS, strict, Vitest, Biome). Prove one trivial test runs.
2. Seeded PRNG (injectable). Tests prove same seed → same sequence.
3. Single-race score-and-sort simulator. Tests.
4. Monte Carlo harness (`tools/calibrate`): run one fixed grid N times, print win/pole/DNF distributions.
5. Full season loop + championship standings. Tests.
6. Only then: `apps/web` (React + Vite) rendering one season's results.

## Architecture rules (invariants — do not violate)
- **The engine is pure.** `packages/engine` imports nothing outside itself and does
  no I/O — no `fetch`, no file reads, no `Date.now()`. Inputs in, results out.
  This is what makes it testable and portable (browser now, server later).
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
- **Realize-once-and-store for career rolls.** Authored `debutSeason` and
  `peak.season` are *nominal targets*. When a driver enters the sim, roll their
  realized debut and realized peak ONCE via the seeded PRNG, store them in that
  driver's per-sim state, and read the stored values thereafter. Never re-roll on read.

## Tech stack (decided)
- Language: TypeScript, `strict: true`, top to bottom.
- Monorepo: pnpm workspaces. Build/dev: Vite.
- UI: React. Styling: Tailwind CSS + shadcn/ui (copied in, not a dependency). State: Zustand.
- Charts: Recharts (when needed). Tests: Vitest. Lint/format: Biome.
- Local persistence (later): Dexie over IndexedDB + JSON export/import.
- Backend (only if/when needed, NOT now): Hono + SQLite/Postgres + Drizzle.

## Repo structure
```
packages/engine/     # pure sim, zero runtime deps, heavily tested
  src/model/         # types only
  src/rng/           # seeded PRNG
  src/race/          # qualifying, race, DNF
  src/season/        # calendar, championship
  src/market/        # driver transfers
  src/progression/   # ageing, car development
packages/data/       # authored seed data (JSON) + typed loaders
apps/web/            # React + Vite (phase 1: read-only view of a running sim)
tools/calibrate/     # headless Monte Carlo harness
```
(The three seed JSON files currently sit in a top-level `data/` folder; move them
into `packages/data/` during scaffolding.)

## Domain glossary
- **Entry**: one team's participation in one season — a team + a car spec + its drivers.
- **Car spec**: a team's per-season car attributes (racing, qualifying, consistency, reliability).
- **Nominal vs realized**: authored `debutSeason` / `peak.season` are nominal; the
  sim rolls realized values per driver per run.
- **Score-and-sort**: v1 race model — sample one performance number per driver from
  attributes + car + noise, sort, apply DNFs. No lap-by-lap. Keep it behind a
  swappable interface so a richer model can replace it later.
- **Progression model**: the swappable seam between the two planned modes.
  Interface `SeasonProgressionModel` with `nextSeasonEntries()` and `nextSeasonCars()`.
  Implement `EvolutionaryProgression` (random walk + mean reversion) first;
  `HistoricalProgression` (real cars/teams per year, drivers still freely allocated
  by the market) later.

## Data model
Seed files (currently in `data/`, destined for `packages/data/`):
- `drivers.json` — `{ id, name, nationality, birthYear, debutSeason,
  peak: { season, racing, qualifying, consistency, adaptability, composure },
  developmentSpeed, declineSpeed }`.
- `teams.json` — `{ id, name, base, foundedYear }`.
- `season-1980.json` — `{ year, entries: [{ teamId, car: { racing, qualifying,
  consistency, reliability }, drivers: [driverId, ...] }] }`.

Notes:
- All five driver attributes share polarity: higher = better. `composure` replaced
  "mistakes" for this reason (low composure = crash-prone).
- Drivers not in any 1980 entry exist in the pool but are seatless, available to the
  market. Intended, not a bug.
- Seed ratings are rough hand-authored placeholders; they get tuned via the Monte
  Carlo harness, never guessed in code.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`), imperative, small.
- Every engine module ships with Vitest tests. Favour property-style checks (finish
  order is a valid permutation; nobody finishes twice; DNFs remove cars) alongside
  seeded-outcome assertions.
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
