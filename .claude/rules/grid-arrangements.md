---
paths:
  - "packages/data/src/arrange.ts"
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/store/season.ts"
---

# The grid's bulk rules

Three buttons in the grid editor that reseat the **whole** field in one press — fastest
drivers in fastest teams, fastest in slowest, or shuffled. The editor's careful end is
`.claude/rules/web-grid.md` and the world they land in is `.claude/rules/web-store.md`;
both load alongside this file. The rules live in `packages/data/src/arrange.ts`, beside
`carryOver.ts`, which is the same kind of thing and the precedent for most of what
follows.

## The rule

**Two orderings, paired index for index**: the seats ranked by the car in them, the
drivers by the overall the grid prints — or shuffled. Whoever the pairing runs out of
goes without, which is why it returns a `LineupDraft`; only a grid that *already* had a
hole in it can come back with one.

- **Both of a team's cars sit together in the ranking**, so the best pairing is the best
  *two* drivers rather than the best driver spread one per team. A team is one piece of
  machinery.
- **The car, not the chassis**: `carOverall` folds the engine in, so a team handed
  somebody else's engine is ranked on what it will actually race. That is why an engine
  change counts as a hand edit (below) and why the store re-applies the world's supply
  before re-running a rule.
- **Ties break on team id, and on driver name then id.** Ratings are integers on a
  1–100 scale, so ties are ordinary, and two presses returning different grids would be
  inexplicable.
- **The cast comes from the grid on screen**, not from the season, so pressing a rule
  twice means the same thing the second time and the two ranked rules are their own
  fixed point.

## Who is in the running

`includeUnemployed` is the reader's checkbox; `arrangeable` is the rule behind it. **It
deliberately does not read the reserve list's filters** — same reasoning as
`CARRY_OVER_AGES` next door: a bulk operation needs one documented rule of its own, or an
era re-applying it every year would depend on how a panel nobody was looking at happened
to be set, and a run would stop being reproducible from its seed.

It mirrors `defaultDriverFilters` instead: in **`aged`** mode the drivers whose real
careers covered the season, in **`peak`** mode everybody. Both halves matter. Aged mode
has nothing to say about a driver evaluated thirty years from their debut — the ageing
curve clamps them to the bottom of the scale — so without the window a shuffle would
seat twenty-eight unknowns rated 1; peak mode is already out of time, and the field of
all-time greats is what it exists for. Nothing here *bars* anyone from a seat: a driver
it leaves out can still be placed by hand.

## The dice

`random` takes an injected `Rng` and **throws without one**: a silent fallback to an
unshuffled grid would read as the button doing nothing, and `Math.random()` here would
cost reproducibility. Two sources, and the split is the established one:

- **in the editor**, a fresh `createRng(randomSeed())` per press, so *Randomize grid*
  twice gives two grids. Choosing which stream to draw from is a reader's action, like
  choosing a seed — `lib/seed.ts`, never the engine;
- **in the store**, `createRng(seed)` off the season's own seed, so a re-rolled grid is
  reproducible from the number the season is. A separate generator from the one the
  races run on, discarded once the grid is made.

## What the world keeps

`world.arrangement` is a `GridArrangement` — kind, `includeUnemployed`, `retain` — or
null: a record of **how `lineup` came to be**, never a second copy of it.

**`createWorld` records it and never obeys it.** The editor computes what the reader is
looking at *before* they apply it — over the draft they had already changed, with the
engines they had already chosen — and a world that re-derived the grid from the rule
would hand them a season they never agreed to. Re-running one is `arrangedLineup`, and
its three callers do so before calling `createWorld`:

- `restartSeason` — fresh seed, so `random` is another throw of the field and the ranked
  rules hand back the grid that was on screen;
- `setRatingMode` — because who counts as *fastest* is exactly what the mode decides;
- `nextEraGrid`, for the next year of an era that retained the rule.

**`arrangedLineup` always arranges over the season's own entry list**, never over the
grid the rule last produced. That makes it a function of the year, the seed, the mode and
the engine supply and nothing else, which is what keeps re-running it stable — flipping
the ability mode and back returns the grid the reader had, where a shuffle of a shuffle
would turn a toggle into a dice cup. Nothing is lost by it: a rule cannot survive a hand
edit, so the only grid a rule can be in force over is one the same rule made, and
arranging an arrangement draws on the same cast as arranging the entry list does.

`switchSeasonYear` drops the rule with the grid. It *could* be re-run on the new year,
but keeping a rule across years is the era's checkbox, and a shortcut that quietly did it
too would be a second answer to when a rule stops applying.

## Keeping it for an era

`retain` rides inside the `GridArrangement` rather than on the `EraRun`, because it is an
answer given on the same panel as the rule and about that rule. **The rule crosses a year
boundary and a grid does not** — the era's existing split: what the reader chose about
*how to play* carries, what they chose about one grid does not. The checkbox is drawn
only when `inEra`, a prop `SeasonView` takes separately from `canChooseAbility` because
one is a control an era takes *away* and the other one it adds.

## A hand edit ends it

Every manual change clears the chosen rule: a swap, filling an empty seat, picking an
engine, copying last season's grid, Restore. Not out of caution — the grid *says* which
rule it is arranged by, and one swap later that sentence is false; inside an era a rule
left in force would arrange next year off the back of a change made to this one.

Two cases that are deliberately **not** edits. Picking a name up and putting it down
again changes nothing, so `select` clears the rule only when `pickUp` hands back a
different draft. And the two checkboxes are settings on the rules rather than changes to
the grid: ticking *Include unemployed drivers* **re-runs** the rule in force at once,
because a checkbox that only affected the next press would leave the panel saying one
thing and the grid showing another.

The editor holds three pieces of state (`chosen`, `includeUnemployed`, `retain`) rather
than one `GridArrangement`, because the settings outlive the rule: clearing it after a
hand edit must not also forget that the reader asked for the pool. `untouched` — which
disables Restore — counts a rule in force as a change, so a shuffle that landed back on
the entry list can still be put down.

## Saying so afterwards

`ARRANGEMENT_LABELS` in `LineupChanges.tsx` is the one place a rule is named, read by both
the buttons and the notice, so the grid cannot report a rule under a different name from
the one that was pressed. `ArrangementNote` draws it, **its own line above the change
list rather than a row of it**: a rule is not a change to a team, it is the answer to why
the grid looks like that, and the swaps beneath it are the working. It also has to stand
alone — which is why the notice no longer hangs off `changes.length`, since a shuffle can
land on the entered grid with no swap to list and the reader is still owed the word. Said
in all three places an edited grid is already declared: the grid screen, the summary
banner, and the grid at the foot of the summary.

## Testing

The usual three-way split, each level the only one that can reach its part:

- **`arrange.test.ts`** — the rules, against synthetic teams, cars and drivers like
  `carryOver.test.ts`. Seat counts preserved, nobody twice, the ranked rules idempotent,
  eligibility per mode. The randomised cases are property-shaped and
  **mutation-checked**: replacing `rng.shuffle` with the list itself fails three, one of
  which exists purely to catch a shuffle that never touches the first seat.
- **the store tests** — where an applied rule ends up; a ranked rule surviving a fresh
  seed unchanged while a shuffle re-rolls; a mode flip re-arranging and a flip back not
  re-rolling; a retained rule reaching every following year by stepping *and* by jumping.
  `nextLineup` returning `world.lineup` unconditionally fails four, ignoring `retain`
  fails three.
- **`grid-arrangement.test.tsx`** — what the reader is *told*: which button carries
  `aria-pressed`, the era checkbox only in an era, the label map covering every kind, the
  notice drawn twice on a summary and not at all without a rule.

No level reaches the click that puts a rule *down*: clearing it is a handler over
component state, which `.claude/rules/web-app.md` already lists as out of reach without
jsdom. The consequence is covered — a world with no arrangement says nothing about one.
