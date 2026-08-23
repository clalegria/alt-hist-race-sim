# Open decisions

Confirm with the author before implementing — do not assume. `CLAUDE.md` carries a
one-line index of these so a session knows a decision is open; the reasoning lives
here. Read this before starting new feature work.

## Settled by the ageing curve (roadmap 1)

- **Season vs age for curves — settled as season.** Every authored career field is a
  season (`debutSeason`, `peak.season`, `finalSeason`, and both career events), and
  the curve computes in season space. Age is derived where it is wanted — the
  progression tool sweeps ages 18–50 and maps each to `birthYear + age`. The
  conversion is lossless, so this is a coordinate choice rather than a model one.
  **Revisit under multi-season divergence:** a steep decline authored for 1986 is a
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

## Era questions (roadmap 5, multiple seasons)

**Both of these are now live rather than hypothetical: 1981 is authored and playable,
and both constants are still 1980's.**

- **Reliability era curve.** `mechanicalDnfEraScale` exists but no per-season curve is
  defined. 1980 needs ~42% retirements; a 2026 season needs closer to 10%. Decide
  whether that comes from rising reliability ratings, a falling era scale, or both.
  1981 currently retires cars at the 1980 rate, which is roughly right for 1981 and
  will be badly wrong long before 2026.
- **Starting limit per era.** `maxStarters` is a single constant pinned at 26 for
  1980. Real limits moved (and modern grids sit under any of them), so it probably
  belongs to the season data rather than the race constants. 1981's real limit was
  24; the authored 32-car grid against a limit of 26 gives 6 DNQs a weekend, which
  matches the real 1981 count by coincidence — 30 entries for 24 places — rather than
  by modelling. Moving the limit into `SeasonSeed` is a change to the race model's
  inputs, so it needs the author's word. Related and unmodelled: real DNQs were
  decided by pre-qualifying and by teams entering different cars at different rounds,
  whereas here the same entry list contests every race.

## Race model levers

- **Consistency's spread lever is parked, not gone.** Settled for now: consistency
  is a pure pace stat, so an erratic driver is strictly worse and never luckier.
  The cost is that consistency no longer changes the *shape* of a driver's results,
  only their level — it behaves like a second speed rating. If the sim later wants
  genuine wildcards (a backmarker who occasionally steals a podium), reopen the gap
  in `consistencyNoiseMultiplier*` and accept that it also hands them extra wins.
  A middle option exists and is untried: stretch the bad tail *and* compress the
  good one, which keeps some asymmetry while capping the ceiling.
- **Weekend-form share is a first guess.** 0.4, then 0.5, was picked for plausibility,
  not fitted — 1980 grid-to-finish correlation was never measured against the real
  season, and the raise to 0.5 pushed pole-to-win from 27.9% to 30.7% on that untested
  assumption. Season results now exist, so this is measurable whenever someone wants
  to: run the season harness, correlate grid against finish, compare to the real 14
  races.

## Circuits and the calendar

- **Circuits have no character.** *(Roadmap 3 opens this door; the rest is undecided.)*
  The calendar is names and a country, and `simulateSeason` takes a round *count*
  rather than the calendar, so every round is the same race. Home advantage is the
  first thing that will need per-round context. Beyond it, what a circuit *is* remains
  undecided: a power track favouring the Renault turbo, a street circuit favouring
  grid position, a per-circuit lap time to anchor the cosmetic gaps — each is a
  separate call about what a circuit does to the score.

## The market (roadmap 6)

- **What moves the driver market.** Undecided by the author, and a design conversation
  rather than a coding task. `adaptability` is authored and read by nothing precisely
  because it is reserved for this.
- **The overall rating weights adaptability at zero.** A display heuristic in
  `packages/data/src/rating.ts`, deliberately paying nothing for a rating the sim never
  reads. Revisit when roadmap 6 gives it meaning.

## Decided, not yet built

Stack choices already made for later phases. Not current state — do not install these
until the phase that needs them arrives, and see the phase rule in `CLAUDE.md` first.

- **Local persistence:** Dexie over IndexedDB, plus JSON export/import. The world
  state is already a plain serialisable object specifically so this is a small job.
- **Backend, only if/when needed (NOT in phase 1):** Hono + SQLite/Postgres + Drizzle.
- **Charts:** Recharts, when something needs one.
