# Open decisions

Confirm with the author before implementing — do not assume. `CLAUDE.md` carries a
one-line index of these so a session knows a decision is open; the reasoning lives
here. Read this before starting new feature work.

## Gating roadmap 1 (ageing curves)

- **Season vs age for curves.** Recommended: convert `debutSeason` / `peak.season`
  to ages on load via `birthYear`, so career arcs travel with the driver under
  divergence. Alternative: keep calendar-pinned. NOT finalised — ask before writing
  the ageing function.
- **Peak-scatter shape.** Symmetric vs slightly downward-skewed (busts more common
  than overachievers). Symmetric is acceptable for v1; flagged as a lever.
- **Debut/peak gap.** Roll realized peak as an offset from realized debut (min gap
  ~3–5 seasons) rather than independently, to avoid a driver peaking right after debut.
- **Driver ratings are un-tuned and cannot be tuned yet.** *(This is why roadmap 1 is
  first.)* 15 of the 28 seated drivers peak *after* 1980 (Prost +7 years, Piquet +5,
  Arnoux +3), and the tools currently feed `peak` ratings in as current ratings
  because no ageing curve exists. Tuning them against 1980 results would bake in an
  error that inverts once ageing lands. Only Jones (peak 1980) and Reutemann (peak
  1979) have been touched.
  **Re-tune the driver pool after the ageing curve exists, not before.**

## Era questions (roadmap 5, multiple seasons)

- **Reliability era curve.** `mechanicalDnfEraScale` exists but no per-season curve is
  defined. 1980 needs ~42% retirements; a 2026 season needs closer to 10%. Decide
  whether that comes from rising reliability ratings, a falling era scale, or both.
- **Starting limit per era.** `maxStarters` is a single constant pinned at 26 for
  1980. Real limits moved (and modern grids sit under any of them), so it probably
  belongs to the season/progression data rather than the race constants once more
  than one season exists. Related and unmodelled: real 1980 DNQs were decided by
  pre-qualifying and by teams entering different cars at different rounds, whereas
  here the same 28 entries contest every race.

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
  `apps/web/src/lib/rating.ts`, deliberately paying nothing for a rating the sim never
  reads. Revisit when roadmap 6 gives it meaning.

## Decided, not yet built

Stack choices already made for later phases. Not current state — do not install these
until the phase that needs them arrives, and see the phase rule in `CLAUDE.md` first.

- **Local persistence:** Dexie over IndexedDB, plus JSON export/import. The world
  state is already a plain serialisable object specifically so this is a small job.
- **Backend, only if/when needed (NOT in phase 1):** Hono + SQLite/Postgres + Drizzle.
- **Charts:** Recharts, when something needs one.
