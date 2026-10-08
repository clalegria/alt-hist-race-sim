# Design: run settings

What-if settings chosen on the setup screen before a run starts, beside Randomness: car
performance, career events, team names, teams and seats, breakdowns, reliability and
points. All are built and documented in `.claude/rules/` (`web-setup.md`, `web-store.md`,
`car-performance.md`, `data-layers.md`, `team-eras.md`, `teams-and-seats.md`,
`retirement-factor.md`) except **one answer of Teams and seats, *I fill them*** — §2, §4
and §6 are what is left. Where it sits in the build order is *run settings* in
`docs/ROADMAP.md`.

Three of these are settings `docs/design/era-advanced.md` §3 decided for the advanced
era — the frozen grid, historical careers, random car development. They are built here
first, in `era-basic`, and the advanced era inherits them.

- **DECIDED** — the author's decision.
- **PROPOSED** — a suggested design. Confirm with the author before building on it.
- **OPEN** — unresolved; needs the author before or during implementation.

---

## 1. Principles

- **DECIDED** — Career events, team names, and teams and seats are on the **era setup
  only** (§5). Car performance is on both setup screens.
- **PROPOSED** — Every setting's first option is the historical one, and it is the
  default. All-historical is today's run exactly: no draw is made and no field changes,
  so tests and harnesses are untouched until a reader picks something else.
- None of these change what a rating *means*. Car performance and career events change
  the ratings a run uses — per-run data, not the authored numbers — and breakdowns and
  reliability are scales over constants, like Randomness. No tuning, no harness run.

## 2. Presentation and naming

- **One segmented control per setting** (`SettingSegments`), so every row reads
  historical-versus-what-if the same way, and a third option is one more segment.
- **DECIDED** — *Teams and seats* gains one row under Keep, above the built ones:
  *Empty seats* `[ I fill them | Filled automatically ]`, *I fill them* first. Under
  *I fill them* the *Empty seats filled with* row and the active-only box go; *Driver
  ages* stays, since it still decides who is carried. The built rows are in
  `.claude/rules/teams-and-seats.md`.

## 3. Car performance from previous year's car

The walk is built (`.claude/rules/car-performance.md`), as a plain walk.

- **OPEN** — At ±20 or ±30 from previous year's car, ratings reach the clamp within a few
  seasons. Whether the walk pulls back towards the authored car (mean reversion,
  `era-advanced.md` §11). Recommendation: decide after watching a long run.

## 4. Teams and seats: *I fill them*

Keep the starting grid is built with its two automatic fills — read
`.claude/rules/teams-and-seats.md` first. What is left is the third fill, `"reader"`:
seats history leaves empty are filled by hand. The data layer already supports it —
`keptYear` carries last year's drivers under it, and `fillSeats` hands the seats back
with their holes — so the work is the setup row and a run that can wait for the reader.

**Setup** (`TeamsAndSeatsSetting.tsx`, `lib/run-settings.ts`)

- **DECIDED** — the *Empty seats* row (§2). `OFFERED_SEAT_FILLS` gains `"reader"`, so
  `parseRunSettings` accepts it; `SEAT_FILL_LABELS`, the note and `teamsAndSeatsLabel`
  (the settings line) get its words.
- **PROPOSED** — switching to Keep opens on *I fill them*, the first segment
  (`OPENING_SEAT_RULES.fill` becomes `"reader"`), following §1's first-is-default.

**The pending year** (`store/season.ts`, `lib/timeline.ts`, `lib/run-bar.ts`, the routes)

- **DECIDED** — carry-over still runs (inside the age band), and a year whose kept seats
  still have a hole after it becomes a **pending year**: the run stops at that year's
  grid and the reader fills the holes in the grid editor. `createWorld` needs a full
  lineup, so there is no world for the year until Apply. Nothing past the grid is
  reachable.
- **PROPOSED** — a third `Run` variant beside `season` and `era`: `{ kind: "pending",
  run: EraRun, pending: { year, seed, kept, draft } }`, the year before already in
  `run.seasons`. `nextEraWorld` (via `stepRun`) returns it instead of a world when
  `kept.seats` has an empty seat under `"reader"` (`emptySeats` in `lineup.ts`). The seed
  is drawn exactly as for a world (`nextSeed`), so the cars are rolled for the editor
  to show (`baselineSeason`). A new action — `fillPending(seats, engines, chassis)` —
  builds the world and opens the era on its grid.
- **PROPOSED** — the reader's fills are the year's **baseline, not edits**, as the
  automatic signings are: they become the world's `keptSeats`, passed to `createWorld`
  through `era`. That makes `keptSeats` a player input under `"reader"`, so the recipe
  stores it for those worlds (`.claude/rules/web-persistence.md`: an input is recorded on
  the world it shaped). Further swaps on the same grid stay ordinary `lineup` edits.
- **Guard** — `baselineSeason` under `"reader"` must never reach `seatedSeason` with a
  hole: it would race the team short without telling anyone. Throw instead.
- **DECIDED** — Continue is disabled on a pending grid, with the reason on the button
  ("Two seats need a driver"); `runBarFor` gains that state, tested as data.
- **DECIDED** — **Jump to… stops at the first pending grid** and says so ("Stopped at
  2010: two seats need a driver"), a deliberate exception to a jump target being refused
  rather than clamped (`.claude/rules/web-era.md`). `jumpRun` returns where it stopped;
  `JumpDialog` (`components/RunDialogs.tsx`) or the page says why.
- **PROPOSED** — a kept bulk rule (`arrangement.retain`) arranges the year after the
  reader applies, not before, so it ranks a full grid.
- Restart season on a pending year draws a new seed and stays pending; Restart era is
  unchanged.
- **DECIDED** — a driver placed by hand is never barred by the age band: the band
  filters the editor's pool list, as everywhere else.

**Reload** (`store/recipe.ts`)

- A pending year is the recipe's last entry, with no `check` (no world to hash), and
  `runFromRecipe` rebuilds it with `keptYearAfter` off the world before. Bump
  `RECIPE_VERSION`.

**Tests** — the store (an era under `"reader"` stops at a pending grid the year after a
team folds — `FOLDING_YEAR` in `test-support.ts`; Continue does nothing there; filling
and applying builds the year with the reader's drivers as baseline; stepping and jumping
agree, the jump stopping at the pending grid), `runBarFor`, the recipe round trip of a
pending run, the parse accepting `"reader"`, the setup row's states, and a
`pnpm screenshots` shot of a pending grid. Mutation-check the guard and the jump stop.

## 5. Which screen

- **DECIDED** — Era setup only: career events, team names, teams and seats, and Car
  performance's walk from *previous year's car*. The rest of Car performance is on both.
- **PROPOSED** — Eight rows on the era screen. If it reads long, *Teams over the years*
  goes behind a *More settings* disclosure that summarises any non-historical choice in
  one line when closed.

## 6. Build order

One session; it ends green, with §4's design moved into `.claude/rules/teams-and-seats.md`
(and `web-era.md`, `web-run-bar.md`, `web-persistence.md` where it touches them). Then:

1. **I fill them** (§2, §4).
2. **Close the item.** Teams and seats is the last run setting, so delete *Run settings*
   from `docs/ROADMAP.md`, move §3's open question (and §5's PROPOSED *More settings*
   disclosure, if still wanted) to `docs/DECISIONS.md`, and delete this file.
