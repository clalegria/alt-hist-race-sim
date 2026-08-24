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
judgeable**, then **the shape of the seed data**, then **the multi-season game**. Every
season from 1950 to 2026 is now authored, so the seed-data-shape items no longer gate a
writing job — they gate a *re-authoring pass across seventy-seven files*, which is the
same argument for settling them together and early. And the data cannot be fine-tuned
without a measuring instrument, which is why the harness and the editor come first.

**1. UI quality of life.** Small, independent, no engine or seed-data change, and the
edit-grid half pays for itself immediately because it is the screen used while
authoring a season. Ship in any order:

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

**4. Fine-tune the driver ageing curve.** The shape is right; the numbers are not. Away
from the peak the curve falls off far too steeply, so a driver two or three years either
side of their peak season is worth much less than the drivers who actually raced those
years were. It suits the short, sharp careers and badly misdescribes everyone with a long
plateau or a slow fade — and with 1950–2026 authored, that mis-shape is now visible in
every era at once.

The levers are all in the progression constants and the authored career fields:
`plateauEdgeDeficit` and `peakSeasons` set how wide "near enough to peak" is,
`declineExponent` and `declineSpeed` set how fast the fall accelerates, and
`deficitPerDevelopmentSeason` does the same job on the way up. See
`.claude/rules/progression.md` for what each one means. Whatever moves, the anchor holds:
`ratingsForSeason(career, peakSeason)` must still return the authored ratings exactly.

This is a re-tune of engine constants, so the no-re-calibration invariant applies — and
**this item is the author asking, which is the authorisation it requires**, for the
progression constants only. Driver, chassis and engine ratings stay fixed. It comes after
the in-app career graph because that graph is the instrument this is judged by, and
before *simulate an era*, because an era run is the thing that makes a wrong curve
expensive.

**5. Simulate an era.** The `career` mode in `apps/web/src/lib/modes.ts` is already
renamed to **Simulate an era**; it is still `available: false`. Turn it on. The first
phase is deliberately dumb: **no driver market, no car progression**. The user picks a
starting year and the app runs the existing single-season flow year after year, with the
same grid, for as long as they keep going or until 2026. Between years comes one new
screen: the champions crowned so far, season by season.

Worth doing before the market and before career mode because it is the shell both of
those fill — the multi-season loop, the year-to-year state, the roll-up screen — and it
is buildable today with nothing new in the engine.

**6. Team lineage.** A way to say that a team in one season *is* a team from the
previous one under another name — Tyrrell into whatever follows it, a constructor sold
and rebadged, a works partnership renamed around a new engine supplier. Today team
identity is per-season by name, so a rename is indistinguishable from a team folding
and a new one appearing.

This is the cheapest of the seed-data-shape items — a successor/predecessor link on the
team identity records, no model change, no re-tune — and it earns its place here for
three reasons: *simulate an era*'s champions roll-up should read as one continuous
history rather than a list of strangers; the links have to be added to every authored
season, so it belongs with the other file-shape items; and the driver and team market
below cannot be designed without it, which is the author's own reason for wanting it.
Whether the link is a chain of ids on the identity record or a separate lineage table is
open.

**7. Seasonal factors.** Several numbers that are one global constant today are really
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

**8. Wet racing.** A realistic share of races are declared wet. In the wet: a new
**1–100 wet-weather rating** per driver carries a large part of the score,
driver-error retirements rise sharply, and the noise term widens considerably — a wet
race should be where the field genuinely reorders. The rating is a new authored field on
every driver — seventy-seven files to revisit, which is why it is grouped with the other
file-shape items rather than taken alone.

This is a deep change to how performance is computed — a new term in the race score — so
it is one of the two cases where the no-re-calibration invariant yields. Say the re-tune
is needed and why, and get agreement, before running the harness.

**9. Circuit character.** Today a round reaches the model as a `RoundContext` with one
field, `country`, read only by home advantage. Give circuits attributes and feed them in:

- **Engine-dependent versus downforce-dependent**, shifting the weight between the
  engine and chassis halves of the powertrain for that round — Monza is not Monaco.
- **How hard it is to overtake**, which raises how much the qualifying result carries
  into the race result. Somewhere like Monaco, the grid nearly is the classification.
- **How likely a wet race is here**, modulating the base rate from *wet racing* — which
  is why that lands first.

Also a deep change to the score, with the same re-tune caveat, and it adds a per-round
authored block to every round of every season file — the largest of the re-authoring
passes, and the reason items 6–9 should land together.

**10. Season fine-tuning.** The writing is done: **every season from 1950 to 2026 is
authored** — one JSON file each in `packages/data/src/seasons/`, discovered by that
folder's `index.ts`, carrying a calendar, an engine table and an entry list (see
`.claude/rules/seed-data.md`). What is left is judgement, not typing.

- **The ratings are first drafts.** Seventy-seven seasons were written far faster than
  they can be measured, and only 1980 and 1981 have ever been calibrated. Going back
  over them era by era — against the season harness from item 2, in the editor from
  item 3 — is the author's own job, and the no-re-calibration invariant means a session
  touches these numbers only when asked for that era by name.
- **Items 6–9 each add a field to all seventy-seven files** — lineage links, per-season
  era numbers, wet ratings, per-round circuit blocks. Settle them together and make one
  authoring pass rather than four.
- **The far ends are the least trustworthy**, because they are the least like what the
  model was built and calibrated against: tiny fields, wild attrition, privateers and
  shared drives in the 1950s and 1960s; and at the modern end, the reliability and
  overtaking assumptions baked into a model tuned on 1980.

**11. Driver market.** Transfers between seasons — what turns *simulate an era* from a
replay into an alternate history. Needs ageing (who is declining, who retires) and more
than one season to move between, hence its place here. What forces move the market is
not yet decided — a design conversation, not a coding task — and `adaptability` is
authored and unused precisely for this. *Team lineage* above is a prerequisite for that
conversation: a market cannot reason about a team's standing across years while a
rename looks like a disappearance.

**12. Career mode, with the two car-progression submodes.** Cars stay true to real
history, or drift from wherever they were: already sketched as the
`SeasonProgressionModel` seam in the glossary — `HistoricalProgression` and
`EvolutionaryProgression`. Building against that interface is the plan.

Engines make this bigger than it was: a career needs engine *deals* to move as well as
cars to develop, and `SeasonProgressionModel` has no `nextSeasonEngines()` yet. Whether
a supplier relationship is something the market moves, something progression rolls, or
something a team-management mode chooses is undecided.

**13. Team management game mode.** Far future, and explicitly after a working
multi-season simulation: take charge of a team, hire and fire drivers, choose
development directions. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (career mode)
packages/engine/src/weather/      # wet-race rolls, for wet racing
```
