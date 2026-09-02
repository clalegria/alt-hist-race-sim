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
- **Driver ratings are still un-tuned — but no longer un-tunable.** 15 of the 28
  seated drivers peak *after* 1980 (Prost +7 years, Piquet +5, Arnoux +3), which is
  why tuning them against 1980 was refused while `peak` ratings were being fed in as
  current ratings. The `aged` mode removes that objection. The re-tune has **not**
  been run and must not be run unprompted — see the no-re-calibration invariant.
  Only Jones (peak 1980) and Reutemann (peak 1979) have ever been touched.
- **The authored careers are one pass of research**, accurate to the author's
  knowledge of the era but not verified record by record. Wrong by a season here and
  there is expected and fine to correct by hand.

## Era questions (multiple seasons)

- **Reliability era curve — settled, and it came from the era scale rather than the
  ratings.** Every season file now carries a 1-10 `retirementFactor`, fitted against the
  real classification of all 77 championships; see `.claude/rules/retirement-factor.md`.
  The question the fit answered was where the era should come from, and the answer was
  emphatic: the authored ratings alone move the simulated rate over a fifteen-point
  band (30%-45%) across the whole of history, while the sport ran 9.0% to 57.1%. So the
  dial carries it, and it scales driver error as well as mechanical failure — composure
  is a career attribute with no era term, and driver-error retirements alone are worth
  more than a modern season's entire rate.

  **Two things it opened rather than closed.** 1980 and 1981 fit best at factor 6, so
  the two calibrated seasons no longer race at the neutral setting: the model gives them
  ~47% where the fitted figure in `.claude/rules/calibration.md` is 41.3%. And the
  tuner's `retirementRate: 0.42` target for both years is an estimate the measurement
  contradicts — 1980 really retired 48.5% of its starters. Neither the target nor a
  rating was touched; changing either is a re-tune and needs the author's word.

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

- **Settled: both seasons were re-tuned, chassis and engines together.** The author
  asked, so the pass that the invariant requires permission for was run — see
  `.claude/rules/calibration.md` for the resulting fit and for the tuner bug it
  uncovered. Driver ratings were held fixed. What is still open is only what was open
  before: whether to fit the drivers at all, and whether the harness should ever
  measure a real calendar rather than neutral races.
- **The engine share is a judgement, not a measurement — and it has now been raised
  once on judgement alone.** The author moved it from 0.2 to **0.3 on pace**, and split
  reliability off into its own even **0.5 / 0.5** pair, on the argument that an engine
  ends as many races as the chassis around it: blowing up or dropping a valve owes
  nothing to the tub. The pace share stays the minority one for the original reasons —
  an authored chassis rating already contains part of what its engine contributed, and
  a larger share flattens a grid where one engine spans chassis rated 42 to 91.

  **Neither number has been searched over.** The 1980 and 1981 fits were run *given*
  0.2 on all three attributes, so those ratings are now stale — see the warning at the
  top of `.claude/rules/calibration.md`. **The re-tune this calls for has not been run
  and needs the author's word.** Expect the reliability change to move the retirement
  rates most, since that weight travelled furthest, and expect `MAX_DRIFT_CHASSIS` to
  need widening again (the old 8 → 12 move was the same argument at a 20% share).

  Splitting one ratio into two also reopens a question the single share hid: whether
  `consistency` should stay chassis-only. It is still the author's call that it should.
- **An engine has no consistency.** A modelling claim — repeatability is a chassis and
  setup property, while an engine either makes its power or breaks — and settled.
- **An engine now has home advantage** (`homeAdvantageEngine`, 0.25), stacking with the
  driver's 1.0 and the team's 0.5 for a ceiling of 1.75 points. The three numbers are
  still a first guess and still unfitted: the harness measures neutral races with no
  `RoundContext`, so **nothing in the calibration can see them**. Fitting them would
  mean first deciding whether `pnpm calibrate` should rotate through a real calendar,
  which is a change to what the harness measures. Note the ordering is doing the work
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
  wider spread hands a slow car more wins — an erratic backmarker now wins about a fifth
  more often, off a base near 2%, while still finishing worse on average. Two tests bound
  that. The larger cost is at the front: the strongest car gained roughly **two points of
  win share** across 1980, 2002 and 2011, because its steady pairing now has the tighter
  distribution. **Nothing has been re-fitted to absorb it.**

  Still open: how wide the gap should be, which is untested taste rather than a
  measurement. Closing it back toward 1.0 buys stricter dominance and fewer wildcards.
  A middle option remains untried: stretch the bad tail *and* compress the good one,
  keeping some asymmetry while capping the ceiling.
- **The driver's share of pace rose from 0.30 to 0.38 (2026-09-03), and the chassis
  ratings have not been re-fitted.** It was raised to cut teammate upsets: measured across
  all 77 seasons at the default level, a pairing 8-12 rating points apart went from 16.7%
  to 11.0% of seasons where the weaker driver outscored the stronger, and 12+ from 6.5% to
  3.8%. Everything else available had been exhausted first — the team-form share, the DNF
  correlation — and together they were worth only about a fifth of that.

  **The cost is real and measured.** On the 2026 grid, which is the only season fitted
  against a real table, the worst points-share error went from 0.9 to 1.7: Red Bull gains
  most (+1.7) because Verstappen's rating now carries more of the car, and Mercedes' win
  share drops from 55.9% to 49.5% against a real 66.7%. A chassis re-fit that recovers it
  exists and is measured (worst error 0.5) but has **not** been applied — it is the
  author's call, and it would only fix 2026; the other 76 seasons were never fitted
  against anything.
- **Wet racing landed un-calibrated (2026-09-02), and the drift it causes is measured
  but not absorbed.** Roughly 15% of rounds are now wet, and a wet one widens both noise
  sigmas (up to ×1.9), raises driver-error retirements (up to ×2.6) and mechanical ones
  (×1.25), shifts the score toward the driver and the chassis, and blends each driver
  toward their new `wetWeather` rating. Every one of those magnitudes is reasoned rather
  than fitted — see `.claude/rules/wet-weather.md`.

  **What it costs, measured over 2,000 seasons per year at the default settings, aged
  ratings, against the same seeds run with every round forced dry:**

  | year | retirement rate | favourite's titles | best driver's win share | distinct winners |
  | ---- | --------------- | ------------------ | ----------------------- | ---------------- |
  | 1980 | 48.1% → 49.5% | 65.7% → 63.4% | 32.0% → 31.0% | 6.08 → 6.28 |
  | 1988 | 45.1% → 46.7% | 60.3% → 62.1% | 50.8% → 50.9% | 3.74 → 3.92 |
  | 2002 | 43.1% → 44.6% | 97.9% → 97.5% | 73.3% → 71.5% | 3.79 → 3.98 |
  | 2010 | 23.4% → 24.4% | 47.5% → 47.6% | 33.4% → 32.9% | 4.81 → 5.00 |
  | 2023 | 9.7% → 10.2% | 100% → 100% | 86.8% → 84.5% | 3.19 → 3.55 |

  So the damage is smaller than the feature's description suggests: **+1.0 to +1.6 points
  of retirement rate**, **1-2 points off the best driver's win share**, and a fifth to a
  third of an extra distinct winner per season. Titles barely move, because a season
  averages two or three wet rounds away. **The retirement half has since been corrected
  at the source** (item 1 below); the rest stands unabsorbed, deliberately.

  **The proposal, cheapest first — item 1 is now DONE, the rest stand:**

  1. ~~**Retirement rate is the only figure that moved outside its own noise.**~~
     **Applied 2026-09-02 at the author's request**, and fitted rather than estimated.
     The proposal here was a blanket ≈0.97 on both risks; measurement rejected that in
     favour of a **per-roll pair — x0.985 mechanical, x0.90 driver error** — because the
     two rolls are inflated by very different amounts (~2% and ~12%) and eras differ in
     which of them retires more cars, so one number left about three times the residual
     at the high-attrition end. Re-authoring 77 `retirementFactor` values was never the
     option: one step of that dial is ~5 points of retirement rate and the drift was 1.3,
     a quarter of a step.

     Checked against the real record with `pnpm retirements 200` over all 77 years — mean
     absolute error **1.41** with no weather, **1.93** with weather uncorrected, **1.42**
     corrected. The fit the 77 factors represent is therefore intact. Details and the
     derivation are in `.claude/rules/race-constants.md`; the constants themselves are no
     longer the fitted values and say so.
  2. **Win share needs nothing.** The 1-2 point loss at the front is what "the field
     genuinely reorders" *means*, and it is the same order of magnitude as the two points
     the consistency lever already handed the best pairing in the other direction — the
     two roughly cancel. If it is to be recovered anyway, the lever is
     `noiseScaleAtFullWetness` (1.9 → ~1.5), not the chassis ratings.
  3. **The overall rating has already been re-weighted** (racing 0.5 → 0.6, qualifying
     0.25 → 0.18, composure 0.15 → 0.10, consistency 0.10 → 0.07, wetWeather 0.05) at the
     author's request. That is display only and touches no result.
  4. **Do not re-fit chassis or driver ratings for this.** The stale-blend problem below
     is larger and older, and a re-fit that absorbed the wet drift as well would make the
     two impossible to tell apart afterwards.
- **Team form and the teammate DNF correlation are reasoned, not fitted.** `teamFormShare`
  (0.85) and `mechanicalDnfTeamCorrelation` (0.5) were chosen from teammate head-to-head
  records — Schumacher/Barrichello, Vettel/Webber, Senna/Prost — not from `pnpm calibrate`.
  Both are constructed to leave the field-wide spread and the retirement rate alone, and
  measurement confirmed the retirement rate is unmoved, so neither *should* need the
  harness. That is an argument, not a measurement, and the argument has not been checked
  against the win-share tables. Whether 0.75 is the right number is taste: it says how
  much of a season's swing belongs to the garage rather than the driver.
- **`teamFormBoost` at levels 4-5 (1.2, 1.35) is the least examined of the set.** It was
  added because chaotic randomness produced more weaker-*teammate* titles than weaker-*car*
  titles, which is backwards. It works — a weaker car takes the title roughly twice as
  often at level 5 — but the two multipliers were picked from a single measurement over
  2002 and 2011, and the upper levels are not calibrated against anything by design.
- **Weekend-form share is a first guess.** 0.4, then 0.5, was picked for plausibility,
  not fitted — 1980 grid-to-finish correlation was never measured against the real
  season, and the raise to 0.5 pushed pole-to-win from 27.9% to 30.7% on that untested
  assumption. Season results now exist, so this is measurable whenever someone wants
  to: run the season harness, correlate grid against finish, compare to the real 14
  races.

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
- **The home-advantage numbers are a first guess.** `homeAdvantageDriver` 1.0 and
  `homeAdvantageTeam` 0.5, in rating points on both session scores, chosen for
  plausibility — a home race is worth a tenth or two, not a car upgrade — and never
  fitted against anything. The calibration figures predate the term and are measured
  with no host country at all, so nothing in the harness currently disagrees with them.
  Fitting these would mean deciding first whether `pnpm calibrate` should rotate
  through a real calendar, which is a change to what the harness measures.

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

