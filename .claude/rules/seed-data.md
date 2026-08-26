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

- `drivers.json` — every driver across every authored season (450 today). `{ id, name,
  nationality, birthYear, debutSeason,
  finalSeason, peak: { season, racing, qualifying, consistency, adaptability,
  composure }, peakSeasons, developmentSpeed, declineSpeed, stepDown?,
  offSeasons? }`. The career fields feed the ageing curve — see
  `.claude/rules/progression.md` for what each one does to it:
  - `debutSeason` is the rookie season; `finalSeason` is the last season raced in
    real life and is **informational only** — nothing withdraws a driver because
    of it.
  - `peakSeasons` is how many seasons the plateau spans, centred on `peak.season`.
    Prost's 7 runs 1984-1990.
  - `stepDown: { season, severity }` is an optional persistent step down
    (Rosberg 1986, Mansell 1995, Scheckter 1980). `offSeasons: [{ season,
    severity }]` are optional one-season dips (Prost 1989). Severities are 0-1.
- `teams.json` — every team across every season (113 today), so Shadow (1980, not 1981)
  and Toleman (1981, not 1980) both live here. `{ id, name, base, foundedYear }`.
- `engines.json` — every engine manufacturer, across every season. `{ id, name, base }`
  — **identity only**. What a unit is *worth* is a per-season fact and lives in the
  season file, because Ferrari's 1980 flat-12 and its 1981 turbo V6 are the same
  manufacturer and not remotely the same engine. `base` is where it was built, which is
  why Ford is `GB`: the DFV was a Cosworth design assembled in Northampton and badged
  for its backer, and the flag beside it should be the one that built it.
- `seasons/<year>.json` — **one file per season**, and all 77 of 1950–2026 are written.
  They vary widely: 1950 is 6 rounds and 8 entries, 1980 is 14 rounds and 15, 2026 is 23
  rounds and 11. Derive a count, never assume one.
  `{ year, points: [9, 6, 4, ...], calendar: [{ round, name, circuit, country }],
  engines: [{ engineId, racing, qualifying, reliability }], entries: [{ teamId,
  engineId, chassis: { racing, qualifying, consistency, reliability },
  drivers: [driverId, ...] }] }`. The entry key is `chassis`, not `car`: it is the tub
  as authored, and the *car* is what `powertrain()` makes of it and the engine.
  `country` is an ISO 3166-1 alpha-2 code, matching `nationality` on drivers and `base`
  on teams.
  - `points` is the year's **championship scale**, best first, and its length is how
    many places score. Period-accurate and authored per year, because the scale is the
    part of the sport that changed most: 8-6-4-3-2 through the fifties, 8-6-4-3-2-1 in
    1960, 9-6-4-3-2-1 from 1961, 10 for a win from 1991, eight scorers from 2003, ten
    places from 2010. The array is the whole rule — no dropped scores, no fastest-lap
    point, no sprint. `validateSeedData` rejects an empty scale, a negative entry, or
    one that pays a lower place more than a higher one.
  - **`engines` is the season's menu, not a record of what was used.** An engine
    nobody entered is legal, and is exactly what the grid editor offers as an
    alternative. What is *not* legal is an entry naming a unit the season does not
    rate, which `validateSeedData` rejects.
  - An engine has **three ratings, not four**: consistency belongs to the chassis. The
    engine package blends the two in `powertrain()` by two ratios — 0.3 of a car's pace
    against the chassis's 0.7, and an even half of its reliability — see
    `.claude/rules/race-engine.md`.

## Adding a season

One file, and the app and the tools light up on their own: drop
`seasons/<year>.json` in the folder, in the shape above. There is no registry to
update — `seasons/index.ts` discovers whatever `<year>.json` files are there.

Then whatever the new season needs: drivers it introduces in `drivers.json`, teams in
`teams.json` and engine manufacturers in `engines.json`. Countries need nothing —
`Flag.tsx` imports every flag there is — and `validateSeedData` fails loudly if the
new file contradicts itself or names something that does not exist.

**How discovery works in both environments.** Node — `tsx` for the CLI tools, Vitest
for the suites — reads the directory with `fs`, reached through
`process.getBuiltinModule` so no `node:` import exists for a bundler to trip over. The
browser has no filesystem, so Vite's `import.meta.glob` inlines the same files at
build time; `process.getBuiltinModule` is the discriminator between the two. The cost
is that `tsc` no longer checks each season file against `SeasonSeed` — a glob has no
per-file type. **`type-checks.ts` does not paper over that with a sample**: naming two
season files there would rebuild the registry this folder exists to avoid, and the next
year authored would be the one nobody checked. It covers the pools only, and
`validateSeedData()` does the seasons — over every year on disk, in both directions:
every declared field present and in range, and no field present that the type does not
declare.

Nothing else has a list of seasons in it. `apps/web/src/lib/seasons.ts` derives
`PLAYABLE_SEASONS` and the picker's subtitle from `authoredSeasons`; the calibrate
tools take `--year`, defaulting to `FIRST_AUTHORED_SEASON`.

## Rules and gotchas

- **The seed JSON is exempt from Biome formatting** (`overrides` in `biome.json`, which
  covers `src/*.json` **and** `src/seasons/*.json`), so its layout is authored rather
  than tool-imposed and differs by file. `drivers.json` is fully indented, one field per
  line, because a driver record is long and is read and edited by hand; the season files
  and the other pools keep their compact one-record-per-line layout. Match whichever
  file you are in — do not reformat either way.
- **Do not re-tune authored ratings.** See the invariant in `CLAUDE.md`. Seed ratings
  are tuned via the Monte Carlo harness, never guessed in code. **Chassis and engine
  ratings for both 1980 and 1981 were fitted** in the engine pass that tuned the two
  together (`.claude/rules/calibration.md`) — but against the old `0.8 / 0.2` blend,
  which has since moved to `0.7 / 0.3` on pace and `0.5 / 0.5` on reliability. They
  are therefore **fitted-but-stale**, and re-fitting them needs the author's word.
  Driver ratings deliberately are not fitted at all (`docs/DECISIONS.md`).
- **No test reads a value out of this JSON and asserts on it** — not a rating, not a
  peak season, not a count of drivers or entries. The tests here derive what they need
  (`drivers[0]`, `season1980.entries.flatMap(...)`, "a driver with a step down")
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
- **Engine ratings are fitted (at the old weights), and were fitted jointly with the
  chassis.** They were authored by hand first — the Renault turbo quickest and most fragile, the Cosworth DFV
  near the mean of the cars using it, the Ferrari flat-12 strong on power in a chassis
  that was not — and then tuned against both seasons' win, pole and retirement records.
  The shape survived the fit; the numbers moved. The tuner is allowed to move a car
  ±12 and an engine ±15 from its authored value, which is what keeps a fitted rating
  recognisable as the judgement it started from. The tuner's knobs are labelled
  `chassis <team>.<field>` and its targets key is `tunedChassis`.
- **1981 driver ratings are still a first authored pass**, as are 1980's. The chassis
  and engine ratings for the year went through the harness in the engine pass, and are
  now stale against the current blend weights. The no-re-calibration invariant still
  holds for all of it: do not tune anything here unless the author asks.

## The layer over the seed

`buildField`, `lineup.ts`, `engines.ts` and `rating.ts` turn authored JSON into
something the engine or the UI can use. They have their own rule file,
`.claude/rules/data-layers.md`, which loads when you open one of them.
