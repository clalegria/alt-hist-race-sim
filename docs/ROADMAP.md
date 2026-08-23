# Roadmap

Read this before starting new feature work. Ordered, with the reasoning — the order
matters more than the items, because two of these create work for each other if taken
out of sequence. Deviate deliberately, not by accident.

**Finished items are deleted rather than kept as trophies**, so this file always reads
as what is left to do. What they turned into is documented where the code is — the
subsystem rules in `.claude/rules/` — and the open questions they left behind are in
`docs/DECISIONS.md`. Other documents therefore refer to items here by *name*, never by
number: the numbering is the order, and it shifts every time something lands.

**1. Multiple starting seasons. — DONE for the machinery; the authoring continues.**
Seasons are one JSON file each in `packages/data/src/seasons/`, registered in that
folder's `index.ts`, and **1980 and 1981 both run**. Every coupling to a single season
is gone: `season1980` no longer exists as an export, `buildField` requires the season,
`validateSeedData` checks all of them, `SeasonView` and `SeasonCalendar` take round
names from the world's own year, `lib/seasons.ts` derives the picker from
`authoredSeasons`, and the calibrate tools take `--year`.

What is left is authoring — 1982 onward, and eventually back to 1950 — plus the era
questions this was meant to settle, which are **still open**:

- **The starting limit is still a single engine constant.** `maxStarters` is 26,
  which was right for 1980. Real 1981 took 24. The 1981 grid of 32 entries therefore
  produces 6 DNQs a weekend, which happens to match reality by luck rather than by
  modelling. Making it per-season is a change to `SeasonSeed` and the race model, and
  it needs the author's word (see `docs/DECISIONS.md`).
- **`mechanicalDnfEraScale` still has no per-year curve**, so 1981 retires cars at the
  1980 rate.

Note that a season file now carries an **engine table** as well as a calendar and an
entry list, so authoring a year is three lists rather than two — see
`.claude/rules/seed-data.md`.

**2. Driver market.** Transfers between seasons. Needs ageing (who is declining, who
retires) and more than one season to move between, hence its place here. What forces
move the market is not yet decided — that is a design conversation, not a coding task,
and `adaptability` is authored and unused precisely for this.

**3. Career mode, with the two car-progression submodes.** Simulate one season, or
simulate a career with the market running between years. The submodes — cars stay true
to real history, or drift from wherever they were — are already sketched as the
`SeasonProgressionModel` seam in the glossary: `HistoricalProgression` and
`EvolutionaryProgression`. Building against that interface is the plan.

Engines make this bigger than it was: a career needs engine *deals* to move as well as
cars to develop, and `SeasonProgressionModel` has no `nextSeasonEngines()` yet. Whether
a supplier relationship is something the market moves, something progression rolls, or
something a team-management mode chooses is undecided.

**4. Team management game mode.** Far future, and explicitly after a working
multi-season simulation: take charge of a team, hire and fire drivers, choose
development directions. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (career mode)
```
