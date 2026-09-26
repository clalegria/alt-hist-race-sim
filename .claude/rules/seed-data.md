---
paths:
  - "packages/data/**"
---

# Seed data

The JSON lives in `packages/data/src/`, is imported statically (so it is bundled and
available in the browser with no I/O) and re-exported under types derived from the
JSON itself. `type-checks.ts` fails the typecheck if the **pool** files and their types
drift apart; the **seasons** are checked the same two ways at runtime by
`validateSeedData()` instead — see "Adding a season" for why.

- `drivers.json` — every driver across every authored season. `{ id, name,
  nationality, birthYear, debutSeason,
  finalSeason, peak: { season, racing, qualifying, consistency, adaptability,
  composure, wetWeather }, peakSeasons, developmentSpeed, declineSpeed, stepDown?,
  offSeasons? }`. `wetWeather` is read only on a wet round, in proportion to how wet;
  `.claude/rules/wet-weather.md` has how it was authored. The career fields feed the
  ageing curve — see `.claude/rules/progression.md` for what each one does to it:
  - `debutSeason` is the rookie season; `finalSeason` is the last season raced in
    real life and is **informational only** — nothing withdraws a driver because
    of it.
  - `peakSeasons` is how many seasons the plateau spans, centred on `peak.season`.
    Prost's 7 runs 1984-1990.
  - `peak.season` **may precede `debutSeason`**, and is only checked against
    `birthYear`: a driver who was at his best elsewhere and arrived here past it
    (Bourdais) is a career shape, not a typo.
  - `stepDown: { season, severity }` is an optional persistent step down
    (Rosberg 1986, Mansell 1995, Scheckter 1980), severity 0-1. `offSeasons: [{ season,
    severity }]` are optional one-season dips (Prost 1989), severity 0 or more and
    deliberately uncapped.
- `teams.json` — every team across every season, so Shadow (1980, not 1981)
  and Toleman (1981, not 1980) both live here.
  `{ id, foundedYear, identity: [{ from, name, base }], liveries: [{ from, ...livery }] }`.
  **A team is a lineage, not a name**: one `id` is Toleman in 1983 and Alpine in 2024,
  and its name, base and livery are **era lists**. The resolution rule, the lineage
  table, what a season entry may still override, and why a name is never a key are in
  `.claude/rules/team-eras.md`.
- `engines.json` — every engine manufacturer, across every season. `{ id, name, base }`
  — **identity only**; what a unit is *worth* is per season and lives in the season
  file. `base` is where it was built, which is why Ford is `GB`.
- `seasons/<year>.json` — **one file per season**, and all 77 of 1950–2026 are written.
  Rounds and entries vary widely by year: derive a count, never assume one.
  `{ year, points: [9, 6, 4, ...], retirementFactor: 5, calendar: [{ round, name, circuit, country }],
  engines: [{ engineId, racing, qualifying, reliability }], entries: [{ teamId,
  engineId, chassis: { racing, qualifying, consistency, reliability },
  drivers: [driverId, ...] }] }`. The entry key is `chassis`, not `car` (see
  `.claude/rules/race-powertrain.md`). `country` is an ISO 3166-1 alpha-2 code, matching
  `nationality` on drivers and `base` on teams.
  - `points` is the year's **championship scale**, best first, and its length is how
    many places score. The array is the whole rule — no dropped scores, no fastest-lap
    point, no sprint. `validateSeedData` rejects an empty scale,
    a negative entry, or one that pays a lower place more than a higher one.
  - `developmentTrend` is an **optional** whole number from `-10` to `+10` on an entry,
    sitting between `chassis` and `drivers`: which way that car's year ran, as a pace-only
    rotation about mid-season. Most entries omit it. See `.claude/rules/car-development.md`.
  - `retirementFactor` is a **1-10 whole number**, 5 being the constants untouched: how
    hard the year was on its cars, scaling both DNF rolls. A new season starts at 5 and is
    swept with `pnpm retirements --sweep --year <n>`; see
    `.claude/rules/retirement-factor.md`. It is **not** the place to express one *car*'s
    fragility — that is the chassis and engine `reliability` ratings.
  - **`engines` is the season's menu, not a record of what was used.** An engine
    nobody entered is legal; an entry naming a unit the season does not rate is not.

## Adding a season

One file, and the app and the tools light up on their own: drop
`seasons/<year>.json` in the folder, in the shape above. There is no registry to
update — `seasons/index.ts` discovers whatever `<year>.json` files are there.

Then whatever the new season needs: drivers it introduces in `drivers.json`, teams in
`teams.json` and engine manufacturers in `engines.json`, and its `retirementFactor`.
Countries need nothing — `Flag.tsx` imports every flag there is — and
`validateSeedData` fails loudly if the new file contradicts itself or names something
that does not exist.

How discovery works in Node and the browser is in the header of `seasons/index.ts`. **`tsc`
never checks a season file** — `validateSeedData()` does, at runtime, over every year on
disk: every declared field present and in range, no undeclared field. Do not add season
files to `type-checks.ts`; its header says why.

Nothing else has a list of seasons in it. `apps/web/src/lib/seasons.ts` derives
`PLAYABLE_SEASONS` and the picker's subtitle from `authoredSeasons`; the calibrate
tools take `--year`, defaulting to `FIRST_AUTHORED_SEASON`.

## Rules and gotchas

- **The seed JSON is exempt from Biome formatting** (`overrides` in `biome.json`, which
  covers `src/*.json` **and** `src/seasons/*.json`), so its layout is authored rather
  than tool-imposed and differs by file. `drivers.json` is fully indented, one field per
  line, because a driver record is long and edited by hand; `teams.json` is indented by
  team with one era per line; `engines.json` and the season files keep one record per
  line. Match whichever file you are in — do not reformat either way.
- **Do not tune authored ratings, and do not annotate one with where it came from** —
  the invariant in `CLAUDE.md`.
- **No test reads a value out of this JSON and asserts on it** — not a rating, not a
  peak season, not a count (the rule in `CLAUDE.md`). The tests here derive what they
  need (`drivers[0]`, `season1980.entries.flatMap(...)`, "a driver with a step down"),
  so tuning these files must never be a reason to edit a test.
- All six driver attributes share polarity: higher = better — low `composure` is
  crash-prone.
- The driver pool spans every season, so plenty of drivers hold no seat in the year
  being run — they are available to the grid editor and, later, the market. Intended,
  not a bug. The one-seat rule is **per season**: `validateSeedData` only rejects two
  seats in the *same* year.
- `adaptability` is authored but nothing scores it yet — it is for the market and
  progression.
- **The engine reads the calendar's `country`, and nothing else about it.**
  `simulateSeason` takes the calendar itself, and each round's country is what gives
  that country's drivers and teams their home advantage. Name and circuit are labelling,
  and circuits have no properties, so two rounds in the same country are the same race.
  `validateSeedData` checks each `round` matches its position and that `country` is two
  capital letters — only the shape, not membership of ISO 3166, though it changes results.
- `validateSeedData()` is called on demand, never on import. Drivers without a seat and
  single-car teams are legal; duplicate ids, unknown references and double-seated
  drivers are not.
- **An engine rating and its customers' chassis ratings are one judgement.** Neither is
  separately observable — what a season records is the package — so the two are authored
  and moved together, which is why `pnpm fit` proposes them as a pair. The character is
  written by hand first (a turbo quick and fragile, a long-serving V8 near the mean of the
  cars using it), and `pnpm tune` only moves the numbers within a band around it
  (`MAX_DRIFT_CHASSIS` / `MAX_DRIFT_ENGINE`), so a proposal stays recognisable as the
  judgement it started from. Its knobs are labelled `chassis <team>.<field>` and its
  targets key is `tunedChassis`.

## The layer over the seed

`buildField`, `lineup.ts`, `engines.ts`, `rating.ts` and the rest turn authored JSON into
something the engine or the UI can use; `.claude/rules/data-layers.md` loads with them.
