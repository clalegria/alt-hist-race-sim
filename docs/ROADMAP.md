# Roadmap

Read this before starting new feature work. Ordered, with the reasoning — the order
matters more than the items, because several of these create work for each other if
taken out of sequence. Deviate deliberately, not by accident.

**Finished items are deleted rather than kept as trophies**, so this file always reads
as what is left to do. What they turned into is documented where the code is — the
subsystem rules in `.claude/rules/` — and the open questions they left behind are in
`docs/DECISIONS.md`. Other documents therefore refer to items here by *name*, never by
number: the numbering is the order, and it shifts every time something lands.

The spine of the order: **the multi-season shell first**, then **the shape of the seed
data**, then **the alternate history**. The shell comes first because every season from
1950 to 2026 is already authored, which makes the basic era mode almost free — and
because it is the only instrument that shows seventy-seven seasons of first-draft
ratings behaving badly *at once*. The seed-data-shape items come next as a block: each
adds a field to all seventy-seven files, so they are settled together and paid for in
one authoring pass rather than four.

`apps/web/src/lib/modes.ts` lists the five modes the finished app is meant to offer —
`season` (shipped), `era-basic`, `era-advanced`, `game`, `edit-ratings`. That list is
the destination; this file is the route. Roughly: item 1 turns on `era-basic`, item 2
turns on `edit-ratings`, item 9 turns on `era-advanced`, and item 10 turns on `game`.

**1. Simulate an era (basic).** Turn on the `era-basic` card. The user picks a starting
year and the app runs the existing single-season flow year after year, for as long as
they keep going or until 2026. Between years comes one new screen: the champions crowned
so far, season by season.

**The grid advances to the real one for each year** — 1980's field, then 1981's, then
1982's — which is what the mode's own blurb promises. With every season authored, that
is a file read, not a model: advancing a year loads `<year+1>.json`. It needs no driver
market (that is the advanced card), no `SeasonProgressionModel`, and nothing new in the
engine at all. It is a store change plus a roll-up screen.

Two consequences worth stating, because they are why this is first. It is the shell that
`era-advanced` and `game` both fill — the multi-season loop, the year-to-year state, the
roll-up screen — so building it early is not throwaway. And it is the only way to *see*
the ageing curve and the era-blind constants misbehave across seventy years, which is
the instrument the next several items are judged by. The seam it must not fake: the grid
for year N+1 comes from that year's seed file, and a later mode will substitute a
simulated grid there instead. Keep that substitution point clean.

Deliberately dumb, by design and not as a first phase.

**2. The in-app ratings editor.** Turn on the `edit-ratings` card. **This is a player
feature first**, not an authoring tool: someone who disagrees that a driver was worth
what the data says should be able to change it and run their own what-if, in the
browser, without touching a JSON file. Editing drivers, teams/chassis, engines and
(once *circuit character* lands below) circuits.

- **Edits apply to the user's run and survive the sitting.** File-based export/import
  of a save is the phase-1 form of the local persistence decided in
  `docs/DECISIONS.md`; Dexie/IndexedDB remains the later phase. The world state and the
  seed are already plain serialisable objects specifically so this is a small job.
- **Export in the authored seed format — `drivers.json`, `teams.json`, `engines.json`,
  `seasons/<year>.json`, shaped exactly as the repo writes them.** This is the half that
  also serves the author: it makes the editor an alternative to hand-editing seed files,
  and it means a user's tuning can be sent in as data. Whether it is always on or behind
  a flag is open.
- **The hard part is that ratings are not authored per season.** A driver is a `peak`
  block plus a career shape (`peakSeasons`, `developmentSpeed`, `declineSpeed`,
  `steepDecline`), and what the app displays for a given year is *derived* from those by
  the ageing curve. So "make Piquet an 88 in 1982" has no direct representation in
  `drivers.json`. Either the editor edits peak-and-curve directly and shows the derived
  year (honest, but asks the user to think in careers), or it accepts a per-year edit
  and solves back to a curve that produces it (friendlier, sometimes impossible).
  **Decide this before writing the export**, and record it in `docs/DECISIONS.md` — it
  determines what the editor's main screen even is. Teams, engines and circuits have no
  equivalent problem: those ratings are authored per season already.
- **Show a driver's whole career progression while editing — table and graph.** The
  numbers already exist; this is `pnpm progression` brought into the UI, and it is the
  screen that makes peak-and-curve editing comprehensible. It is also the first thing in
  the project that needs a chart, so it is where the Recharts decision in
  `docs/DECISIONS.md` gets cashed in.

**3. Fine-tune the driver ageing curve.** The shape is right; the numbers are not. Away
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
progression constants only. Driver, chassis and engine ratings stay fixed.

The instrument is `pnpm progression`, which already exists, so this is **not** gated on
the editor's career graph — if item 2 slips, take this anyway. It comes after *simulate
an era* because an era run is what makes a wrong curve visible across every generation
at once, and it belongs before the seed-data authoring pass below, so that pass is
judged against a curve worth trusting.

**4. Team lineage.** A way to say that a team in one season *is* a team from the
previous one under another name — Tyrrell into whatever follows it, a constructor sold
and rebadged, a works partnership renamed around a new engine supplier. Today team
identity is per-season by name, so a rename is indistinguishable from a team folding
and a new one appearing.

The cheapest of the seed-data-shape items — a successor/predecessor link on the team
identity records, no model change, no re-tune. It heads the block for three reasons:
*simulate an era*'s champions roll-up should read as one continuous history rather than
a list of strangers; the links have to be added to every authored season, so it belongs
with the other file-shape items; and the *driver market* below cannot be designed
without it, which is the author's own reason for wanting it. Whether the link is a chain
of ids on the identity record or a separate lineage table is open.

**5. Seasonal factors.** Several numbers that are one global constant today are really
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

**6. Wet racing.** A realistic share of races are declared wet. In the wet: a new
**1–100 wet-weather rating** per driver carries a large part of the score,
driver-error retirements rise sharply, and the noise term widens considerably — a wet
race should be where the field genuinely reorders. The rating is a new authored field on
every driver — seventy-seven files to revisit, which is why it is grouped with the other
file-shape items rather than taken alone.

This is a deep change to how performance is computed — a new term in the race score — so
it is one of the two cases where the no-re-calibration invariant yields. Say the re-tune
is needed and why, and get agreement, before running the harness.

**7. Circuit character.** Today a round reaches the model as a `RoundContext` with one
field, `country`, read only by home advantage. Give circuits attributes and feed them in:

- **Engine-dependent versus downforce-dependent**, shifting the weight between the
  engine and chassis halves of the powertrain for that round — Monza is not Monaco.
- **How hard it is to overtake**, which raises how much the qualifying result carries
  into the race result. Somewhere like Monaco, the grid nearly is the classification.
- **How likely a wet race is here**, modulating the base rate from *wet racing* — which
  is why that lands first.

Also a deep change to the score, with the same re-tune caveat, and it adds a per-round
authored block to every round of every season file — the largest of the re-authoring
passes, and the reason items 4–8 should land together.

**8. Season fine-tuning.** The writing is done: **every season from 1950 to 2026 is
authored** — one JSON file each in `packages/data/src/seasons/`, discovered by that
folder's `index.ts`, carrying a calendar, an engine table and an entry list (see
`.claude/rules/seed-data.md`). What is left is judgement, not typing.

- **Items 4–7 each add a field to all seventy-seven files** — lineage links, per-season
  era numbers, wet ratings, per-round circuit blocks. This item is where that single
  authoring pass is made, which is why they are settled first and paid for once.
- **The ratings are first drafts.** Seventy-seven seasons were written far faster than
  they can be measured, and only 1980 and 1981 have ever been calibrated. Going back
  over them era by era — against `pnpm calibrate-season`, in the editor from item 2 — is
  the author's own job, and the no-re-calibration invariant means a session touches
  these numbers only when asked for that era by name.
- **The far ends are the least trustworthy**, because they are the least like what the
  model was built and calibrated against: tiny fields, wild attrition, privateers and
  shared drives in the 1950s and 1960s; and at the modern end, the reliability and
  overtaking assumptions baked into a model tuned on 1980.

**9. Driver market.** Transfers between seasons — what turns *simulate an era* from a
replay into an alternate history, and what turns on the `era-advanced` card. Needs
ageing (who is declining, who retires) and more than one season to move between, hence
its place here. What forces move the market is not yet decided — a design conversation,
not a coding task — and `adaptability` is authored and unused precisely for this. *Team
lineage* above is a prerequisite for that conversation: a market cannot reason about a
team's standing across years while a rename looks like a disappearance.

This is where the substitution point left clean in item 1 gets used: the grid for year
N+1 stops coming from that year's seed file and starts coming from the market.

**10. Game mode.** The `game` card: take charge of a team, hire and fire drivers, choose
development directions, negotiate engine deals. Far future, and explicitly after a
working multi-season simulation — it is *era-advanced* seen from inside one team, so it
needs everything the market needs and a decision loop besides.

Car progression lives here rather than as a mode of its own. The
`SeasonProgressionModel` seam in the glossary has two implementations:
`HistoricalProgression`, which after item 1 is just "read the next season file", and
`EvolutionaryProgression` (random walk + mean reversion), which is what makes cars drift
from real history. Only the second is real work, and it is a **submode inside this mode
and `era-advanced`**, not a card on the menu. Build the interface when that second
implementation lands, not before — item 1 does not need it.

Engines make this bigger than it was: a career needs engine *deals* to move as well as
cars to develop, and `SeasonProgressionModel` has no `nextSeasonEngines()`. Whether a
supplier relationship is something the market moves, something progression rolls, or
something this mode chooses is undecided. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (game mode)
packages/engine/src/weather/      # wet-race rolls, for wet racing
```
