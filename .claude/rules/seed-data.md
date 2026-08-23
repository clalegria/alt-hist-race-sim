---
paths:
  - "packages/data/**"
---

# Seed data

The JSON lives in `packages/data/src/`, is imported statically (so it is bundled and
available in the browser with no I/O) and re-exported under types derived from the
JSON itself. `packages/data/src/type-checks.ts` fails the typecheck if the types and
the JSON drift apart.

- `drivers.json` — every driver across every authored season (51 today). `{ id, name,
  nationality, birthYear, debutSeason,
  finalSeason, peak: { season, racing, qualifying, consistency, adaptability,
  composure }, peakSeasons, developmentSpeed, declineSpeed, steepDecline?,
  offSeasons? }`. The career fields feed the ageing curve — see
  `.claude/rules/progression.md` for what each one does to it:
  - `debutSeason` is the rookie season; `finalSeason` is the last season raced in
    real life and is **informational only** — nothing withdraws a driver because
    of it.
  - `peakSeasons` is how many seasons the plateau spans, centred on `peak.season`.
    Prost's 7 runs 1984-1990.
  - `steepDecline: { season, severity }` is an optional persistent step down
    (Rosberg 1986, Mansell 1995, Scheckter 1980). `offSeasons: [{ season,
    severity }]` are optional one-season dips (Prost 1989). Severities are 0-1.
- `teams.json` — every team across every season, so Shadow (1980, not 1981) and
  Toleman (1981, not 1980) both live here. `{ id, name, base, foundedYear }`.
- `engines.json` — every engine manufacturer, across every season. `{ id, name, base }`
  — **identity only**. What a unit is *worth* is a per-season fact and lives in the
  season file, because Ferrari's 1980 flat-12 and its 1981 turbo V6 are the same
  manufacturer and not remotely the same engine. `base` is where it was built, which is
  why Ford is `GB`: the DFV was a Cosworth design assembled in Northampton and badged
  for its backer, and the flag beside it should be the one that built it.
- `seasons/<year>.json` — **one file per season**, currently 1980 (14 rounds, 4
  engines, 15 entries, 28 seats) and 1981 (15 rounds, 6 engines, 17 entries, 32 seats).
  `{ year, calendar: [{ round, name, circuit, country }], engines: [{ engineId, racing,
  qualifying, reliability }], entries: [{ teamId, engineId, car: { racing, qualifying,
  consistency, reliability }, drivers: [driverId, ...] }] }`. `country` is an ISO
  3166-1 alpha-2 code, matching `nationality` on drivers and `base` on teams.
  - **`engines` is the season's menu, not a record of what was used.** An engine
    nobody entered is legal, and is exactly what the grid editor offers as an
    alternative. What is *not* legal is an entry naming a unit the season does not
    rate, which `validateSeedData` rejects.
  - An engine has **three ratings, not four**: consistency belongs to the chassis. The
    engine package blends the two in `powertrain()` at 0.2 against the chassis's 0.8 —
    see `.claude/rules/race-engine.md`.

## Adding a season

Three edits, and the app and the tools light up on their own:

1. `seasons/<year>.json` — calendar, engine table and entries, in the shape above.
2. A line in `seasons/index.ts`: the static import, and the year in `AUTHORED`.
3. A line in `type-checks.ts`, adding the file to the `SeasonJson` union.

Then whatever the new season needs: drivers it introduces in `drivers.json`, teams in
`teams.json`, engine manufacturers in `engines.json`, and any new country in
`apps/web/src/components/Flag.tsx` — `Flag.test.tsx` fails by name if you forget, as do
`validateSeedData` and the typecheck.

**Why a written-out registry and not a glob.** `import.meta.glob` would discover the
folder automatically under Vite and break every CLI tool the moment `tsx` ran it; a
filesystem read would break the browser. A static import per season is the one form
that works in both, keeps the JSON bundled with no I/O, and lets `tsc` check each file
against `SeasonSeed`. The end state is 1950–2026 and beyond, so one line per season is
the cost of that.

Nothing else has a list of seasons in it. `apps/web/src/lib/seasons.ts` derives
`PLAYABLE_SEASONS` and the picker's subtitle from `authoredSeasons`; the calibrate
tools take `--year`, defaulting to `FIRST_AUTHORED_SEASON`.

## Rules and gotchas

- **The seed JSON is exempt from Biome formatting** (`overrides` in `biome.json`, which
  covers `src/*.json` **and** `src/seasons/*.json`) to keep its one-record-per-line
  layout. Do not reformat it.
- **Do not re-tune authored ratings.** See the invariant in `CLAUDE.md`. Seed ratings
  are tuned via the Monte Carlo harness, never guessed in code. Car ratings have had
  two calibration passes against 1980; driver ratings deliberately have not, and
  cannot be until the ageing curve exists (`docs/DECISIONS.md`).
- **No test reads a value out of this JSON and asserts on it** — not a rating, not a
  peak season, not a count of drivers or entries. The tests here derive what they need
  (`drivers[0]`, `season1980.entries.flatMap(...)`, "a driver with a steep decline")
  so the author can retune freely and add entries without going red. Tuning these files
  must never be a reason to edit a test.
- All five driver attributes share polarity: higher = better. `composure` replaced
  "mistakes" for this reason (low composure = crash-prone).
- The driver pool spans every season, so plenty of drivers hold no seat in the year
  being run — they are available to the grid editor and, later, the market. Intended,
  not a bug. The one-seat rule is **per season**: a driver holding a seat in 1980 and
  1981 is the normal case, and `validateSeedData` only rejects two seats in the *same*
  year.
- `adaptability` is authored but unused so far — it is for the market and progression.
- **The engine reads the calendar's `country`, and nothing else about it.**
  `simulateSeason` takes the calendar itself rather than a round count, and each
  round's country is what gives that country's drivers and teams their home advantage.
  Everything else — name, circuit — is still labelling, and circuits still have no
  properties, so two rounds in the same country are the same race. `validateSeedData`
  checks each `round` matches its position and that `country` is a real alpha-2 code;
  the second of those now changes results as well as labels.
- `validateSeedData()` is called on demand, not as a module-load side effect, so
  importing the package stays pure. Drivers without a seat and single-car teams are
  legal; duplicate ids, unknown references and double-seated drivers are not.
- `buildField(season, pool, mode, teams)` is the seam between authored data and the
  engine's runtime model. **`season` is required** — a field built from whichever year
  happened to be the default is the bug this seam exists to prevent. It lives here
  rather than in either package: the engine may not read data, and every consumer that
  wants to run a race needs exactly this mapping.
  - It stamps each entrant with `driverCountry` (the driver's `nationality`) and
    `teamCountry` (the team's `base`), which is how home advantage reaches the engine
    without the engine ever reading this package. A team missing from the pool gets no
    `teamCountry` and races everywhere as a visitor.
  - It stamps `engineId` and the season's `engine` ratings the same way. **It does not
    blend them** — `powertrain()` in the engine package owns that, so the number the
    race is run on and the number the grid page shows come from one place.
  - `mode` is `"peak"` (default) or `"aged"`. **Peak is the default and must stay
    that way** — it feeds authored peaks straight in, which is what the 1980
    calibration was measured against. `"aged"` calls the engine's ageing curve for
    the season's year.
  - This package now calls **into** the engine at runtime (`ratingsForSeason`), so
    the dependency is no longer type-only. Still one-directional: the engine imports
    nothing from here, and that is the invariant that matters.
- `engines.ts` is the supply layer over a season seed, and mirrors `lineup.ts`
  deliberately: a `SeasonEngines` is `Record<teamId, engineId>` with the same keys as
  the season it overrides, and `applyEngines(season, engines)` hands back a
  `SeasonSeed` that `buildField` consumes unchanged.
  - `authoredEngines`, `isAuthoredEngines`, `engineChanges` and `availableEngines`
    round it out. `availableEngines` orders the season's table by `engines.json` so a
    picker does not reshuffle itself between years; `engineSpecOf` is the lookup.
  - **A team can only be given an engine the season has.** `applyEngines` re-validates
    rather than trusting, because an override can arrive from a save file — the same
    reason `applyLineup` does.
  - An `EngineChange` is `{ teamId, from, to }`, always both halves: a car has exactly
    one engine, so fitting one always removes another.
- `rating.ts` holds the display-only overall rating (`driverOverall`, `carOverall`).
  It sits here, not in the web app, because the progression tool needs the same
  number and two copies of those weights would be two answers to "how good is this
  driver". `apps/web/src/lib/rating.ts` re-exports it.
- `lineup.ts` is the seat-allocation layer over a season seed: a `SeasonLineup` is
  `Record<teamId, driverIds>` with the same keys and the same seat counts as the
  season it overrides, and `applyLineup(season, lineup)` hands back a `SeasonSeed`
  that `buildField` consumes unchanged. It lives here because it is a transformation
  of seed data, and because the driver market will want the same shape.
  - **Only swaps are representable.** `swapDrivers(lineup, a, b)` preserves every
    team's seat count and therefore the size of the field — which is what the
    starting limit and the DNQ arithmetic are calibrated against. It requires at
    least one of the two to hold a seat and throws otherwise; a driver swapped with
    themselves is a no-op. `applyLineup` re-validates rather than trusting, because a
    lineup can arrive from a save file.
  - `authoredLineup`, `isAuthoredLineup`, `reserveDrivers` (alphabetical, everyone in
    the pool without a seat) and `lineupChanges` round it out. A `SeatChange` always
    has `in.length === out.length` — seats are preserved, so every arrival displaced
    someone — and the UI relies on it to print "X for Y".
- **The engine ratings have never been through the harness either.** They were written
  to the 1980 scale by hand: the Renault turbo as the quickest and most fragile thing on
  the grid, the Cosworth DFV near the mean of the cars that use it (which is what keeps
  the blend from dragging the whole field toward one number), the Ferrari flat-12 strong
  on power in a chassis that was not. Blending them in moved the calibrated 1980
  distributions and the harness was **not** re-run — see `docs/DECISIONS.md`.
- **1981 car and driver ratings are a first authored pass, not a calibration.** They
  were written to the 1980 scale by hand and have never been through the harness. The
  no-re-calibration invariant still holds: do not tune them unless the author asks.
