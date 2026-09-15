# Open decisions

Confirm with the author before implementing — do not assume. `CLAUDE.md` carries a
one-line index of these so a session knows a decision is open; the reasoning lives
here. Read this before starting new feature work.

## Settled by the ageing curve

- **Season vs age for curves — settled as season.** Every authored career field is a
  season (`debutSeason`, `peak.season`, `finalSeason`, and both career events), and
  the curve computes in season space. Age is derived where it is wanted — the
  progression tool sweeps ages 18–50 and maps each to `birthYear + age`. The
  conversion is lossless, so this is a coordinate choice rather than a model one.
  **Revisit under multi-season divergence:** a step down authored for 1986 is a
  *historical* event, and once a run diverges far from history it may want to travel
  with the driver's age instead.
- **Per-run scatter — settled as none, for now.** The curve is deterministic: same
  career in, same ratings out, in every seed (author's call). That moots the two
  decisions below unless it reopens.
  - *Peak-scatter shape.* Symmetric vs slightly downward-skewed. Unresolved, unneeded.
  - *Debut/peak gap.* Roll realized peak as an offset from realized debut (min gap
    ~3–5 seasons) rather than independently, to avoid peaking right after debut.
    Unresolved, unneeded.
- **Driver ratings are tunable, and are the author's.** They were long held back from
  the harness for a real reason: over half of a 1980 grid peaks *after* 1980 (Prost +7
  years, Piquet +5, Arnoux +3), so scoring them against that season while feeding in
  `peak` ratings would have fitted the wrong quantity. The `aged` mode removes that
  objection. Nothing else about the position has changed: a session does not run this
  unprompted — see the tuning invariant.
- **The authored careers are one pass of research**, accurate to the author's
  knowledge of the era but not verified record by record. Wrong by a season here and
  there is expected and fine to correct by hand.

## Era questions (multiple seasons)

- **Reliability era curve — settled, and it came from the era scale rather than the
  ratings.** Every season file carries a 1-10 `retirementFactor` answering the real
  classification of that championship; see `.claude/rules/retirement-factor.md`.
  The question was where the era should come from, and the answer was emphatic: the
  authored ratings alone move the simulated rate over a fifteen-point band across the
  whole of history, while the sport ran 9.0% to 57.1%. So the dial carries it, and it
  scales driver error as well as mechanical failure — composure is a career attribute
  with no era term, and driver-error retirements alone are worth more than a modern
  season's entire rate.

  **What it opened rather than closed:** `retirementRate: 0.42` in the tuner's targets is
  an estimate, and the real rate of a high-attrition season is well above it. Nothing was
  changed on the strength of that; whether the tuner should see a season's own factor is
  the author's call.

**The rest of this section is now live rather than hypothetical: 1981 is authored and
playable, and the constant is still 1980's.**
- **Starting limit per era.** `maxStarters` is a single constant pinned at 26 for
  1980. Real limits moved (and modern grids sit under any of them), so it probably
  belongs to the season data rather than the race constants. 1981's real limit was
  24; the authored 32-car grid against a limit of 26 gives 6 DNQs a weekend, which
  matches the real 1981 count by coincidence — 30 entries for 24 places — rather than
  by modelling. Moving the limit into `SeasonSeed` is a change to the race model's
  inputs, so it needs the author's word. Related and unmodelled: real DNQs were
  decided by pre-qualifying and by teams entering different cars at different rounds,
  whereas here the same entry list contests every race.

## Engine manufacturers

Landed. What they left open:

- **Settled: a chassis and its engine are tuned together, never one alone.** Neither is
  separately observable — a season records the package — so `pnpm fit` proposes them as a
  pair and the author moves them as a pair. What is still open is what was open before:
  whether to fit the drivers at all, and whether the harness should ever run a real
  calendar rather than neutral races.
- **The engine share is a judgement, not a measurement — and it has now been raised
  once on judgement alone.** The author moved it from 0.2 to **0.3 on pace**, and split
  reliability off into its own even **0.5 / 0.5** pair, on the argument that an engine
  ends as many races as the chassis around it: blowing up or dropping a valve owes
  nothing to the tub. The pace share stays the minority one for the original reasons —
  an authored chassis rating already contains part of what its engine contributed, and
  a larger share flattens a grid where one engine spans chassis rated 42 to 91.

  **Neither number has been searched over**, and moving either changes what a chassis
  rating means, since the two halves trade against each other. Expect `MAX_DRIFT_CHASSIS`
  to need room whenever the pace share moves: holding a car's effective pace steady while
  the engine takes 30% asks the chassis to move about 1.43x whatever the engine took out.

  Splitting one ratio into two also reopens a question the single share hid: whether
  `consistency` should stay chassis-only. It is still the author's call that it should.
- **An engine has no consistency.** A modelling claim — repeatability is a chassis and
  setup property, while an engine either makes its power or breaks — and settled.
- **An engine now has home advantage** (`homeAdvantageEngine`, 0.25), stacking with the
  driver's 1.0 and the team's 0.5 for a ceiling of 1.75 points. All three are judgements:
  the harnesses run neutral races with no `RoundContext`, so **none of them can see these
  numbers at all**. Putting a real figure on them would mean first deciding whether
  `pnpm calibrate` should rotate through a real calendar, which is a change to what the
  instrument does. Note the ordering is doing the work
  here, not the absolute sizes — and that a share most of the field collects (ten of
  fifteen 1980 entries ran a Cosworth) is close to invisible by construction.
- **Nothing changes a supplier between seasons.** `SeasonProgressionModel` has
  `nextSeasonEntries()` and `nextSeasonCars()` and no `nextSeasonEngines()`. Whether an
  engine deal is something the driver market moves, something progression rolls, or
  something only a team-management mode chooses is a design question for career mode.
- **Engines have no ownership relationship to teams.** A works team is inferred from
  the names matching — that is how the UI decides Renault is not "Renault-Renault" —
  and nothing models a factory deal, a customer deal, or the difference between them.
  Fine for display; probably not fine once a market can move deals.

## Race model levers

- **Consistency's spread lever is now open — 1.3 / 0.75 — and that reverses the entry
  that used to sit here.** It was parked flat at 1.0 so that an erratic driver was
  strictly worse and never luckier. The cost of parking it was that consistency changed
  only the *level* of a driver's results and never their shape, which made it a second
  speed rating: a 96-consistency driver and a 60-consistency one in the same car had
  identically shaped weekends. Reopened as part of the teammate-upset work (2026-08-28),
  because how repeatable a driver is has to be part of what separates a first driver from
  a second.

  **What was accepted in reopening it.** Winning from behind is an upper-tail event, so a
  wider spread hands a slow car more wins — an erratic backmarker wins a little more
  often while still finishing worse on average. Two tests bound that. The larger effect is
  at the front: the strongest car gains some win share, because its steady pairing has the
  tighter distribution.

  Still open: how wide the gap should be, which is taste rather than an answer. Closing it back toward 1.0 buys stricter dominance and fewer wildcards.
  A middle option remains untried: stretch the bad tail *and* compress the good one,
  keeping some asymmetry while capping the ceiling.
- **The driver's share of pace is 0.38 in the race and 0.36 in qualifying.** It was
  raised from 0.30 and 0.28 to cut teammate upsets, which were the model's most visible
  wrongness: a clearly weaker teammate outscoring a clearly stronger one over a whole
  season, far more often than the sport does it. Everything else available had been
  exhausted first — the team-form share, the DNF correlation — and together they were
  worth about a fifth of what the weights were.

  **The trade is real.** Raising the driver's share moves a rating point of driver
  against a rating point of car, so a season's cars and its drivers no longer say quite
  the same thing they did before it. That is the "changes what a rating means" case, and
  it is the author's to resolve — by hand, or with the harness, or not at all.
- **Wet racing's constants are judgements, and its side effects were deliberately only
  half absorbed (2026-09-02).** Roughly 15% of rounds are wet, and a wet one widens both
  noise sigmas (up to ×1.9), raises driver-error retirements (up to ×2.6) and mechanical
  ones (×1.25), shifts the score toward the driver and the chassis, and blends each driver
  toward their `wetWeather` rating. Every one of those magnitudes was reasoned rather than
  searched for — see `.claude/rules/wet-weather.md`.

  Wet racing pulls two things with it, and they were treated differently on purpose:

  1. **Retirements — corrected at the source.** More wet rounds means more retirements
     across the board, which would have shifted every season's rate away from the record
     its `retirementFactor` answers. The four DNF endpoints therefore carry a **x0.985
     mechanical / x0.90 driver-error** correction, a pair rather than one number because
     the two rolls are inflated by very different amounts (~2% and ~12%) and eras differ
     in which of them retires more cars. Re-authoring 77 `retirementFactor` values was
     never the option: the drift is a fraction of one step of that dial. Derivation in
     `.claude/rules/race-constants.md`.
  2. **Win share — not corrected, deliberately.** The best driver losing a point or two of
     win share to the rain is what "the field genuinely reorders" *means*, and it runs
     opposite to what the consistency lever hands the best pairing, so the two work
     against each other. If it is ever to be recovered, the lever is
     `noiseScaleAtFullWetness` (1.9 → ~1.5), not the ratings.
- **Team form and the teammate DNF correlation are judgements.** `teamFormShare` (0.85)
  and `mechanicalDnfTeamCorrelation` (0.5) were chosen from teammate head-to-head records
  — Schumacher/Barrichello, Vettel/Webber, Senna/Prost — rather than from a harness. Both
  are *constructed* to leave the field-wide spread and the retirement rate alone, which is
  the argument for why neither should need one. Whether the number is right is taste: it
  says how much of a season's swing belongs to the garage rather than to the driver.
- **`teamFormBoost` at levels 4-5 (1.2, 1.35) is the least examined of the set.** It was
  added because chaotic randomness produced more weaker-*teammate* titles than weaker-*car*
  titles, which is backwards. It does that job, but the two multipliers came from one
  quick look, and the upper levels are meant to be taste rather than a claim about the
  sport.
- **Weekend-form share is a judgement.** 0.4, then 0.5, picked for plausibility: how much
  of a car's level carries from Saturday to Sunday. The question it answers is checkable
  against real grid-to-finish correlation whenever someone wants to — run the season
  harness, correlate grid against finish, compare with a real season.

## Circuits and the calendar

- **Circuits have no character.** *(Home advantage opened the door; the rest is
  undecided.)* `simulateSeason` now takes the calendar rather than a round count, and
  each round arrives at the race model as a `RoundContext`. So far that context is one
  field, `country`, and the only thing reading it is home advantage — two rounds in the
  same country are still the same race. What a circuit *is* remains undecided: a power
  track favouring the Renault turbo, a street circuit favouring grid position, a
  per-circuit lap time to anchor the cosmetic gaps — each is a separate call about what
  a circuit does to the score, and each is now a field on `RoundContext` rather than a
  new parameter.
- **The home-advantage numbers are a judgement.** `homeAdvantageDriver` 1.0 and
  `homeAdvantageTeam` 0.5, in rating points on both session scores, chosen for
  plausibility — a home race is worth a tenth or two, not a car upgrade. No harness can
  currently see them: they all run with no host country. Putting a real number on them
  would mean deciding first whether `pnpm calibrate` should rotate through a real
  calendar, which is a change to what the instrument does.

## The driver market

- **What moves the driver market.** Undecided by the author, and a design conversation
  rather than a coding task. `adaptability` is authored and read by nothing precisely
  because it is reserved for this.
- **The overall rating weights adaptability at zero.** A display heuristic in
  `packages/data/src/rating.ts`, deliberately paying nothing for a rating the sim never
  reads. Revisit when the market gives it meaning.

## Decided, not yet built

Stack choices already made for later phases. Not current state — do not install these
until the phase that needs them arrives, and see the phase rule in `CLAUDE.md` first.

- **Local persistence:** Dexie over IndexedDB, plus JSON export/import. The world
  state is already a plain serialisable object specifically so this is a small job.
- **Backend, only if/when needed (NOT in phase 1):** Hono + SQLite/Postgres + Drizzle.

