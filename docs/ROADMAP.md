# Roadmap

Read this before starting new feature work. Ordered, with the reasoning — the order
matters more than the items, because several of these create work for each other if
taken out of sequence. Deviate deliberately, not by accident.

**Finished items are deleted rather than kept as trophies**, so this file always reads
as what is left to do. What they turned into is documented where the code is — the
subsystem rules in `.claude/rules/` — and the open questions they left behind are in
`docs/DECISIONS.md`. Other documents therefore refer to items here by *name*, never by
number: the numbering is the order, and it shifts every time something lands.

The spine of the order: **cheap UI first**, then **the tools that make authored data
judgeable**, then **the shape of the seed data**, then **bulk authoring against that
settled shape**, then **the multi-season game**. Authoring seventy seasons before wet
ratings and circuit attributes exist means authoring them twice, and authoring them
without a measuring instrument means authoring them blind.

**1. UI quality of life.** Small, independent, no engine or seed-data change, and the
edit-grid half pays for itself immediately because it is the screen used while
authoring a season. Ship in any order:

- **Filter out drivers who had already retired** in real life before the season being
  edited, on the edit-grid screen.
- **Filter out drivers who were not yet rookies** in that season, likewise. Both
  filters need a real-life debut/retirement year per driver, which the identity records
  do not carry yet — that is the one piece of data work in this item.
- **Filter the drivers without a seat by age.** Default to 18–42, widenable to 16–56 at
  the extremes. Age comes from `birthYear` against the season's year, so unlike the two
  filters above this one needs no new data.
- **Sort teams alphabetically or by overall rating**, as a toggle, on both the
  edit-grid screen and the opening "show the grid" screen.
- **Sort the drivers without a drive** the same two ways, on the edit-grid screen.

**2. The season Monte Carlo harness.** `pnpm calibrate` runs a *grid* — one race, N
times. This is the season-level counterpart: **run a whole season N times (20,000, or
whatever is passed) and print the distribution.** Per driver and per team: how often
they take the title, how often they win a race, how often they score at all, and the
average points they end the year on.

This is the instrument the author calibrates authored ratings by hand against, so it
comes before everything that produces or adjusts data. It also subsumes the
team-level points question the race-level harness cannot answer: wins, poles and
podiums describe the front of the grid, and average points per season is the number
that says whether the midfield is right. Tool work in `tools/calibrate` — no engine
change, and the same no-re-calibration rules in `.claude/rules/calibration.md` apply to
what is done with its output.

**3. The in-app data editor.** The other half of the manual calibration loop: the
harness measures, this adjusts. Browser-side, phase-1 legal, and it turns authoring a
season from hand-editing JSON into using the app.

- **Edit ratings** — driver, team/chassis, engine, and (once *circuit character* lands
  below) circuit.
- **Edit names** — teams and drivers.
- **Save every edit to a text file, and load it back.** Without this the editor is
  worthless across two sittings. This is the JSON export/import half of the local
  persistence already decided in `docs/DECISIONS.md`, arriving early and file-based;
  Dexie/IndexedDB remains the later phase. The world state and the seed are already
  plain serialisable objects specifically so this is a small job.
- **In the driver editor, show that driver's whole career progression** — how their
  rating moves year by year, **as a table and as a graph**, so peak and decline are
  visible while editing. The numbers already exist: this is `pnpm progression` brought
  into the UI. It is also the first thing in the project that needs a chart, so it is
  where the Recharts decision in `docs/DECISIONS.md` gets cashed in.

**4. Simulate an era.** Rename the parked `career` mode — "Simulate 1980–2026" in
`apps/web/src/lib/modes.ts` — to **Simulate an era**, and turn it on. The first phase is
deliberately dumb: **no driver market, no car progression**. The user picks a starting
year and the app runs the existing single-season flow year after year, with the same
grid, for as long as they keep going or until the last authored season. Between years
comes one new screen: the champions crowned so far, season by season.

Worth doing before the market and before career mode because it is the shell both of
those fill — the multi-season loop, the year-to-year state, the roll-up screen — and it
is buildable today with nothing new in the engine.

**5. Team lineage.** A way to say that a team in one season *is* a team from the
previous one under another name — Tyrrell into whatever follows it, a constructor sold
and rebadged, a works partnership renamed around a new engine supplier. Today team
identity is per-season by name, so a rename is indistinguishable from a team folding
and a new one appearing.

This is the cheapest of the seed-data-shape items — a successor/predecessor link on the
team identity records, no model change, no re-tune — and it earns its place here for
three reasons: *simulate an era*'s champions roll-up should read as one continuous
history rather than a list of strangers; every authoring batch has to carry the links,
so it must land before the bulk writing; and the driver and team market below cannot be
designed without it, which is the author's own reason for wanting it. Whether the link
is a chain of ids on the identity record or a separate lineage table is open.

**6. Seasonal factors.** Several numbers that are one global constant today are really
per-era, and the season file is where they belong. One item, because it is one change to
`SeasonSeed` and one authoring pass per year:

- **Retirement rate per season.** `mechanicalDnfEraScale` has no per-year curve, so
  1981 retires cars at 1980's rate. Turbo-era attrition and 2010s attrition are not the
  same sport.
- **The cosmetic qualifying and race gaps** shown in the UI, per season. A 1955 field, a
  1994 field and a 2015 field spread out very differently, and today one scale serves
  all of them. Display-only — nothing in the model reads it.
- **The starting limit.** `maxStarters` is pinned at 26; real 1981 took 24, and the
  number moves across eras. Folding it in here means one decision about where era
  numbers live rather than three.

Calibrating the first two per year is a measurement job, and the author asking for it
here is the authorisation the no-re-calibration invariant requires — for *these*
numbers, not for driver or car ratings, which stay fixed.

**7. Wet racing.** A realistic share of races are declared wet. In the wet: a new
**1–100 wet-weather rating** per driver carries a large part of the score,
driver-error retirements rise sharply, and the noise term widens considerably — a wet
race should be where the field genuinely reorders. The rating is a new authored field on
every driver, which is why this comes before the bulk authoring batches.

This is a deep change to how performance is computed — a new term in the race score — so
it is one of the two cases where the no-re-calibration invariant yields. Say the re-tune
is needed and why, and get agreement, before running the harness.

**8. Circuit character.** Today a round reaches the model as a `RoundContext` with one
field, `country`, read only by home advantage. Give circuits attributes and feed them in:

- **Engine-dependent versus downforce-dependent**, shifting the weight between the
  engine and chassis halves of the powertrain for that round — Monza is not Monaco.
- **How hard it is to overtake**, which raises how much the qualifying result carries
  into the race result. Somewhere like Monaco, the grid nearly is the classification.
- **How likely a wet race is here**, modulating the base rate from *wet racing* — which
  is why that lands first.

Also a deep change to the score, with the same re-tune caveat, and it adds a per-round
authored block to every season file — the second reason the batches wait.

**9. Season authoring, in batches.** The machinery is done: a season is one JSON file in
`packages/data/src/seasons/`, registered in that folder's `index.ts`, carrying a
calendar, an engine table and an entry list — three lists, see
`.claude/rules/seed-data.md`. 1980 and 1981 run. What is left is the writing:

1. **1982–1985**
2. **1986–1990**
3. **1991–2000**
4. **2001–2015**
5. **2016–2026**
6. **1950–1979**

Forward first, because each batch is adjacent to one already authored and most of the
grid carries over; the 1950s and 1960s go last because they are the least like what the
model was built and calibrated against — tiny fields, wild attrition, privateers, shared
drives. **Batch 1 can go at any time** and is worth doing early, because "simulate an
era" over two seasons is thin. Hold batches 2–6 until items 5–8 have settled what a
season file contains, or they get authored twice.

**10. Driver market.** Transfers between seasons — what turns *simulate an era* from a
replay into an alternate history. Needs ageing (who is declining, who retires) and more
than one season to move between, hence its place here. What forces move the market is
not yet decided — a design conversation, not a coding task — and `adaptability` is
authored and unused precisely for this. *Team lineage* above is a prerequisite for that
conversation: a market cannot reason about a team's standing across years while a
rename looks like a disappearance.

**11. Career mode, with the two car-progression submodes.** Cars stay true to real
history, or drift from wherever they were: already sketched as the
`SeasonProgressionModel` seam in the glossary — `HistoricalProgression` and
`EvolutionaryProgression`. Building against that interface is the plan.

Engines make this bigger than it was: a career needs engine *deals* to move as well as
cars to develop, and `SeasonProgressionModel` has no `nextSeasonEngines()` yet. Whether
a supplier relationship is something the market moves, something progression rolls, or
something a team-management mode chooses is undecided.

**12. Team management game mode.** Far future, and explicitly after a working
multi-season simulation: take charge of a team, hire and fire drivers, choose
development directions. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (career mode)
packages/engine/src/weather/      # wet-race rolls, for wet racing
```
