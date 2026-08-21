# Roadmap

Read this before starting new feature work. Ordered, with the reasoning — the order
matters more than the items, because two of these create work for each other if taken
out of sequence. Deviate deliberately, not by accident.

**1. Driver progression — ageing curves. — DONE.** A deterministic curve in
`packages/engine/src/progression/`, with the authored career fields it reads in
`drivers.json` and a `peak` / `aged` toggle on the web grid. `pnpm progression
<driver>` prints any driver's curve from age 18 to 50.

What it did *not* do, deliberately: no per-run scatter (the curve is identical in
every seed), and **no re-tune of the driver pool**. The re-tune this item was always
going to unblock is now possible and remains un-run — it needs the author to ask.

**2. Complete the 1980 grid — privateer entries.** Small and self-contained: a couple
of privateer entries are missing. Also useful as a test of the starting limit, since
more entries means more DNQs, which is period-accurate. Independent of everything
else; slot it into any session.

**3. Home advantage.** A small boost for a driver racing in their own country and a
team in its. The data is already there — `country` on each calendar round,
`nationality` on drivers, `base` on teams. The reason it earns a place this early is
architectural: it is the smallest change that forces `simulateSeason` to take the
*calendar* rather than a round count, and per-round context is the prerequisite for
every circuit feature that follows.

**4. Engine manufacturers.** Performance becomes a function of driver, car and engine
rather than driver and car. Deliberately before multi-season data: authoring several
seasons and *then* adding an entity to the model means re-authoring all of them. 1980
is a good test case, with the Cosworth DFV, the Renault turbo and the Ferrari flat-12
being genuinely different propositions.

**5. Multiple starting seasons.** Choose 1980 or another year, which means authoring
drivers, teams, cars and calendars for more seasons *and* decoupling the code from
this one. The couplings are known and few, and one is already gone: the store now asks
`apps/web/src/lib/seasons.ts` for a year's seed, so authoring a season is a line in
its `AUTHORED` map and the picker lights up on its own. What still imports
`season1980` directly is `SeasonView.tsx`, `SeasonCalendar.tsx` (both for round names)
and the calibration tools. Also settles the era questions already in
`docs/DECISIONS.md` — the starting limit and the reliability curve both stop being
constants once more than one year exists.

**6. Driver market.** Transfers between seasons. Needs ageing (who is declining, who
retires) and more than one season to move between, hence its place here. What forces
move the market is not yet decided — that is a design conversation, not a coding task,
and `adaptability` is authored and unused precisely for this.

**7. Career mode, with the two car-progression submodes.** Simulate one season, or
simulate a career with the market running between years. The submodes — cars stay true
to real history, or drift from wherever they were — are already sketched as the
`SeasonProgressionModel` seam in the glossary: `HistoricalProgression` and
`EvolutionaryProgression`. Building against that interface is the plan.

**8. Team management game mode.** Far future, and explicitly after a working
multi-season simulation: take charge of a team, hire and fire drivers, choose
development directions. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers (roadmap 6)
packages/engine/src/progression/  # ageing, car development (roadmap 1, 7)
```
