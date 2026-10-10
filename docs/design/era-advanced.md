# Design: the advanced era

The driver and engine market, in-season events, and the run settings behind the
`era-advanced` mode (`apps/web/src/lib/modes.ts`), plus notes for game mode, which sits on
top of it. Design intent, not a description of code: none of it is built. Where it sits in
the build order is *driver market* in `docs/ROADMAP.md`.

- **DECIDED** — the author's decision.
- **PROPOSED** — a suggested design. Confirm with the author before building on it.
- **OPEN** — unresolved; needs the author before or during implementation.

---

## 1. Scope and modes

- **DECIDED** — Two modes share one market:
  - **Simulate an era (advanced)**, an observer mode and built first. No player; the goal
    is a market that produces plausible, legible, interesting narratives.
  - **Game mode**, far future. The player runs one team; it needs mini-games beyond
    contract signing (§10).
- **PROPOSED** — Narrative *emerges* from agents with sane preferences and is never
  scripted (no forced parity, no scripted comebacks). Scripted behaviour becomes
  exploitable or immersion-breaking once a human is inside the market.

## 2. Architecture

The engine invariants in `CLAUDE.md` apply unchanged: market logic is pure engine code, its
tunable numbers live in `packages/engine/src/market/constants.ts` and are the author's.

- **PROPOSED** — **Separate PRNG substreams.** Market draws (scouting noise, rumours,
  holdouts, poaching, "new challenge" moves, retirements) come from their own streams,
  derived from the run's seed plus a stream key, apart from race noise and DNF rolls.
  Otherwise adding one market roll shifts every race after it. The engine's
  `deriveSeed(seed, key)` is the facility, already used by *Chassis performance*
  (`.claude/rules/car-performance.md`); an era still chains each year's seed off the race stream
  (`nextSeed` in `apps/web/src/lib/seed.ts`), so this changes what every era seed
  produces — cheapest before a save file or a Share link exists.
- **PROPOSED** — **Deterministic event ordering**: pending events and signing turns are
  processed in a fixed, seeded order, or one seed stops reproducing one grid.
- **PROPOSED** — **What is stored and what is derived.** *Stored*, as the record of what
  happened: contracts, signings, sackings, retirements, and values rolled once (contract
  lengths, random retirement ages), never re-rolled on read. *Derived* from result rows
  plus the authored career records, per "results are the source of truth": form,
  prestige, reservation value.
- **OPEN** — **Reputation: stored or derived?** It integrates a whole career, and the
  author leans towards storing it. Middle way: a per-season checkpoint, each season's
  reputation computed from the previous checkpoint plus that season's results, kept as a
  cache that can always be rebuilt from results and is never edited in place.
- **PROPOSED** — **One decision function per team** ("whom do I pursue, accept, sack,
  renew?"), reading only *visible* information. Game mode replaces the player team's
  function with UI input. Protect this seam; it is the bridge between the two modes.
- **Timing differs between the modes.** Drivers never change mid-season (§4), so in the
  observer mode the market cannot affect the season it runs in: the whole year, market
  events included, can still be simulated up front, each event stamped with its round and
  revealed as *Continue* passes it. Game mode breaks that — a player's round-5 choice
  changes round 6 — so its seasons simulate round by round and a save becomes the seed
  plus the player's decision log.

## 3. Run settings

Chosen before the run starts, like the randomness level, and part of the run's recipe
(`.claude/rules/web-persistence.md`). The *historical* options read season files after the run has diverged, so they
depend on *what a saved or shared run replays against* (`docs/DECISIONS.md`).

**The frozen grid, career events on or off, and random car development are built first
in `era-basic`** as run settings (`.claude/rules/web-setup.md`); this mode inherits them.
What follows is only what stays advanced.

- **DECIDED** — **Randomness** keeps its meaning: how chaotic the *races* are. It does not
  touch the market.
- **DECIDED** — **Careers**: *historical* — every driver ages on the authored curve,
  career events (a step down authored for 1986) happen in the season they were authored
  for, and `adaptability` plays no part; or *random* — careers vary run to run, and
  `adaptability` decides how well a driver settles into a new team. The random path needs
  a PRNG in `ratingsForSeason`, which is deterministic today
  (`.claude/rules/progression.md`); the historical path stays deterministic.
- **OPEN** — How random careers vary (the curve's speeds, the peak, events travelling with
  age rather than year?), and how `adaptability` turns into a first-season penalty.
- **DECIDED** — **Retirement**: *random* — a random retirement age; or *historical* —
  each driver retires in their real retirement year.
- **PROPOSED** — The random retirement age depends on the era: fifties drivers raced into
  their forties, modern ones mostly stop in their late thirties.
- **DECIDED** — **Grid evolution**: *historical*, *frozen* (both built as
  *Keep the first season's teams*, `.claude/rules/teams-and-seats.md`), or an *intermediate* hybrid. Built on team lineage
  (`.claude/rules/team-eras.md`): a team's id is permanent across its names.
- **DECIDED** — **Car development**: *historical* or *random* — each year's car a random
  change from the last, built as *Chassis performance* from *previous season's chassis*
  (`.claude/rules/car-performance.md`). Game mode goes much deeper (§10).
- **OPEN** — The intermediate grid mode; which of a season file's data (car and engine
  ratings, calendar, points) still applies once a team or engine pairing no longer
  matches history; whether the careers and retirement settings should be one setting.

## 4. Information model

- **DECIDED** — Teams never see a driver's true ratings, only:
  - **Reputation** — slow, career-integrated.
  - **Form** — fast over- or under-performance, mainly against the team-mate: points,
    race head-to-head, qualifying head-to-head.
- **DECIDED** — The market owns the word *form*. The engine's *team form* and *car form*
  (`teamFormShare`, `weekendFormShare`, `teamFormBoost`; `.claude/rules/race-engine.md`)
  get a new name before any market code lands. **OPEN** — the new name.
- **DECIDED** — Form is deliberately car-confounded: a great driver in a bad car beating a
  weak team-mate looks like a mediocre one beating a worse one. The misjudgment is a
  feature.
- **DECIDED** — Drivers start with their real career records (*historical career
  records* in `docs/ROADMAP.md`), which seed their reputation.
- **PROPOSED** — Reputation, integrated across teams and years, is the slow correction
  that lets real talent surface over a career.
- **PROPOSED** — **Team prestige** mirrors reputation: what drivers rank teams by, and what
  orders the signing cascade.
- **OPEN** — The reputation, form and prestige formulas (weights, windows, update rates,
  decay, any car adjustment); form for three-car teams and single-car entries.

## 5. Contracts

- **DECIDED** — At the start, each driver holds a contract of 1–3 seasons, assigned at
  random.
- **DECIDED** — No mid-season driver changes: a driver runs the whole season for the team
  they started it with.
- **DECIDED** — At expiry the team renews or hires someone else.
- **DECIDED** — Contracts can be broken. Observer mode: rarely, and only a clearly bigger
  team poaching from a clearly smaller one. Game mode: a buyout, a budget decision rather
  than a dice roll.
- **PROPOSED** — Renewal is not a special case: the team's own expiring driver gets an
  incumbency bonus in its ranking, so re-signings come out of the same logic.
- **OPEN** — Contract lengths for new signings and renewals; the poaching thresholds and
  frequency.

## 6. The season timeline: the market runs during the season

- **DECIDED** — Next season's grid forms *during* this one. The UI always shows it, with
  open seats for expiring contracts, and events fire as signings happen.

| Phase | What happens (DECIDED) |
|---|---|
| **Early season** | Rumours: teams may enter or fold, drivers may retire. Nothing binding. |
| **Mid-season** | Some rumours come true, some fizzle. First renewals, sackings and retirements. |
| **Mid-late season** | The frenzy. Dominant teams pick first; freed seats cascade down the grid. Power sits with teams; drivers rarely accept less than the best available (long-tenured drivers wanting a new challenge are the exception). |
| **End of season** | Late twists — surprise sackings, retirements, folds — then **everything resolves**. Game mode: several negotiation turns; a player still short of a driver when everyone else is done signs from the unemployed pool. |

- **PROPOSED** — Two mechanisms drive the timeline rather than a script per phase:
  1. **Pecking order.** Whenever seats are filled, teams act in prestige order. That *is*
     the domino effect.
  2. **Reservation value.** Each driver's running estimate of the best seat they can
     expect; they accept only offers that clear it. It **decays** as the season goes on
     and seats fill — early, drivers gamble; late, they cave. The decay curve is the main
     dial on silly-season chaos.

  Early, the bars are high and nobody signs; rumours show *candidate* open seats. Mid,
  only the tails move: clear keepers renew, clear underperformers go. Mid-late, holdouts
  collapse and the cascade runs. At the end a **forced-resolution backstop** drops every
  bar to the floor and fills each remaining seat, the unemployed pool last, so no seat is
  empty at the start of a season. A great driver can occasionally be buried — signed
  early by a mid team, then locked in while top seats open later; reputation corrects it
  over seasons, and a slower decay makes it rarer.
- **OPEN** — The decay curve's shape and inputs: **prototype and eyeball this first**,
  everything else keys off it. How market ticks map to rounds, with calendars from about
  seven rounds to twenty-four. Rumour generation and resolution, and how many late shocks.
  The odds of a "new challenge" move.

## 7. Unemployment and talent supply

- **PROPOSED** — Involuntary retirement: a driver unsigned for N seasons, or unsigned past
  some age, retires, which keeps the unemployed pool bounded.
- **PROPOSED** — **Rookie supply is its own subsystem**; the market only consumes a list of
  available drivers. Heavy divergence, or a run past 2026, drains the real pool, so
  generated rookies with hidden potential will be needed.
- **OPEN** — Where rookies come from (real debutants at their real debut season,
  generated drivers, or both) and how generated ones get ratings and career shapes.
  Historical retirement's edge cases: a driver at peak or under contract in their real
  retirement year, or whose real team no longer exists. Whether form, reputation or
  unemployment shift a random retirement.

## 8. Teams and engines

- **DECIDED** — Teams sign contracts with engine manufacturers and can switch, like
  drivers.
- **DECIDED** — A works team is tied to its own engine and never enters the engine market.
- **PROPOSED** — The engine market uses the same pecking order and cascade; a works team is
  a permanently contracted seat.
- **OPEN** — Supply capacity (customer teams per engine), manufacturer preferences
  (prestige, payment), manufacturers entering and leaving across eras. Whether a works team
  stays inferred from matching names, as today, or gets an authored field.
- **OPEN** — Seats when the grid changes size: surplus drivers go to the unemployed pool or
  retire; surplus seats go to the pool and to rookies.

## 9. Pre-season testing

- **DECIDED** — A short test before round 1 gives clues about who is fast. Advanced mode
  only; a new step in the reveal, before the first qualifying.
- **OPEN** — How noisy or misleading the clues are; whether they feed market decisions
  (reservation values, sackings) or are only for the reader.

## 10. Game mode (far future, notes only)

- **DECIDED** — It comes after the observer market produces compelling narratives.
- **PROPOSED** — Mini-games are knobs on numbers the engine already reads, not side
  activities: R&D points across chassis racing, qualifying and reliability (and engine,
  for a works team), this season against next; an engine-mode gamble, pace up and
  reliability down; a setup gamble widening or narrowing performance noise; driver pairing,
  rivals or a clear number one; finances as the spine, prize money into R&D into results,
  which also gives smaller teams a lane in the market.
- **OPEN** — Whether the player sees their drivers' true ratings. Truth against the AI's
  reputation and form is a permanent scouting edge; suggested instead: a sharper estimate,
  with better scouting costing money.

## 11. Runaway dominance

- **PROPOSED** — The core failure of decades-long sports sims: best car, best results,
  best drivers, better car, forever. The pecking order amplifies the top on purpose, so
  the dampers are chosen, not discovered: contract locks and ageing (decided), regression
  to the mean in random car development, budget and salary limits (later), divergence
  noise.
- **OPEN** — Which dampers, and how to check them: a multi-season harness in
  `tools/calibrate` reporting dynasty length and how concentrated titles are across teams
  and drivers over thirty-plus seasons.

## 12. UI

- **DECIDED** — A "next season grid" with open seats, updated as signings happen, and an
  event feed as signings, sackings, retirements and team changes occur. Both are pages
  of the run and, like every page, go through the gate (`revealed()`), showing nothing
  past the reveal cursor.
- **PROPOSED** — A market event stamped with its round (§2) is a new kind of beat
  (`.claude/rules/web-app.md`); in game mode a **decision** beat blocks Continue until
  answered, the button turning into "Respond to …". Their entries in the top nav (Inbox,
  Market, *Next season's grid*, My team) are rows in `lib/areas.ts`, each with an
  optional unread count.
- **OPEN** — Whether an event *stops* Continue (an interstitial the reader must pass, FM's
  news pop-up) or only lands in the feed with an unread badge. Probably both, per event
  importance.
- **PROPOSED** — Rumoured seats drawn apart from confirmed ones (dotted, question-marked),
  so the grid visibly firms up through the season.

## 13. Build order

0. Prerequisites: the engine's form terms renamed; PRNG substreams, with each era year's
   seed derived from the run's seed rather than chained off the race stream.
1. Market state: contracts, the unemployed pool, stored events; the market substream.
2. Contracts assigned at the start; career records into initial reputation.
3. An end-of-season-only market: pecking order plus forced resolution, the simplest loop
   that proves the cascade.
4. Form from season results.
5. Reservation value and its decay; signings spread across the season's phases.
6. The retirement setting and involuntary retirement.
7. The careers setting and `adaptability`.
8. Rumours and late-season shocks.
9. The next-season grid and the event feed.
10. Pre-season testing.
11. The engine market and works-team locks.
12. The intermediate grid mode.
13. Rookie supply.
14. The multi-season dominance harness.
