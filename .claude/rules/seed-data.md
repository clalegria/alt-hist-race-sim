---
paths:
  - "packages/data/**"
---

# Seed data

The JSON lives in `packages/data/src/`, is imported statically (so it is bundled and
available in the browser with no I/O) and re-exported under types derived from the
JSON itself. `packages/data/src/type-checks.ts` fails the typecheck if the types and
the JSON drift apart.

- `drivers.json` — 41 drivers. `{ id, name, nationality, birthYear, debutSeason,
  peak: { season, racing, qualifying, consistency, adaptability, composure },
  developmentSpeed, declineSpeed }`.
- `teams.json` — 15 teams. `{ id, name, base, foundedYear }`.
- `season-1980.json` — 14 rounds, 15 entries, 28 seats. `{ year, calendar: [{ round,
  name, circuit, country }], entries: [{ teamId, car: { racing, qualifying,
  consistency, reliability }, drivers: [driverId, ...] }] }`. `country` is an ISO
  3166-1 alpha-2 code, matching `nationality` on drivers and `base` on teams.

## Rules and gotchas

- **The seed JSON is exempt from Biome formatting** (`overrides` in `biome.json`) to
  keep its one-record-per-line layout. Do not reformat it.
- **Do not re-tune authored ratings.** See the invariant in `CLAUDE.md`. Seed ratings
  are tuned via the Monte Carlo harness, never guessed in code. Car ratings have had
  two calibration passes against 1980; driver ratings deliberately have not, and
  cannot be until the ageing curve exists (`docs/DECISIONS.md`).
- All five driver attributes share polarity: higher = better. `composure` replaced
  "mistakes" for this reason (low composure = crash-prone).
- 13 drivers hold no 1980 seat. They exist in the pool, available to the market.
  Intended, not a bug.
- `adaptability` is authored but unused so far — it is for the market and progression.
- **The calendar is cosmetic *for now*.** It exists so results can be labelled
  "Round 12, Italian Grand Prix at Imola" — circuits have no properties and the engine
  never sees it, so every round is the same race. `calendar.length` is the season's
  round count, and `validateSeedData` checks each `round` matches its position and
  that `country` is a real alpha-2 code, since a number out of step would mislabel
  every result printed against it. Roadmap 3 is where the engine starts reading this.
- `validateSeedData()` is called on demand, not as a module-load side effect, so
  importing the package stays pure. Drivers without a seat and single-car teams are
  legal; duplicate ids, unknown references and double-seated drivers are not.
- `buildField(season, pool)` is the seam between authored data and the engine's
  runtime model. It lives here rather than in either: the engine may not read data,
  and every consumer that wants to run a race needs exactly this mapping. Its
  dependency on `@alt-hist/engine` is **type-only** and erases at build time, so no
  runtime edge exists in either direction. It currently feeds `peak` ratings straight
  in as current ratings — a placeholder the ageing curve replaces.
- Adding a season means a new JSON file **and** a line in `apps/web/src/lib/seasons.ts`
  (`AUTHORED`); the picker lights up on its own from there.
