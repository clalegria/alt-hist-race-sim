---
paths:
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/store/season.ts"
---

# The grid's bulk rules — the app around them

The three rearrange-everything buttons in the grid editor, as the app holds them: what a
world keeps about one, what an era does with one, what ends one, and how the grid says so
afterwards. **The rules themselves** — the pairing, the cast, the dice — are
`.claude/rules/grid-arrangements.md`, in the data package. The editor's careful end is
`.claude/rules/web-grid.md` and the world they land in is `.claude/rules/web-store.md`;
both load alongside this file.

## What the world keeps

`world.arrangement` is a `GridArrangement` — kind, `includeUnemployed`, the pool
`filters` it was allowed to draw on, `retain` — or null: a record of **how `lineup` came
to be**, never a second copy of it.

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
grid the rule last produced. That makes it a function of the year, the seed, the mode,
the engine supply and the arrangement's own filters and nothing else, which is what keeps re-running it stable — flipping
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
the one pressed. `arrangementNote` beside it spells out the **cast**, age band included,
since the filters travel inside the arrangement and a rule kept across an era draws on a
set no longer on screen anywhere. It takes the rating mode for one word — "peak age 18 to
42" under `peak`, "aged" under the other, the distinction the filter panel's own label
makes. `ArrangementNote` draws it, **its own line above the change list rather than a row
of it**: a rule is not a change to a team, it is the answer to why the grid looks like
that, and the swaps beneath it are the working. It has to stand alone too — which is why
the notice no longer hangs off `changes.length`, since a shuffle can land on the entered
grid with no swap to list. Said in all three places an edited grid is already declared:
the grid screen, the summary banner, and the grid at the foot of the summary.

## Testing

Two levels, and each is the only one that can reach its part. **The store tests**: where
an applied rule ends up; a ranked rule surviving a fresh seed unchanged while a shuffle
re-rolls; a mode flip re-arranging and a flip back not re-rolling; a retained rule
reaching every following year by stepping *and* by jumping. `nextLineup` returning
`world.lineup` unconditionally fails four of them, ignoring `retain` fails three.
**`grid-arrangement.test.tsx`**: what the reader is *told* — which button carries
`aria-pressed`, the era checkbox only in an era, the label map covering every kind, the
note naming the pool it drew on, the notice drawn twice on a summary and not at all
without a rule.

Neither reaches the click that puts a rule *down*: clearing it is a handler over
component state, which `.claude/rules/web-app.md` already lists as out of reach without
jsdom. The consequence is covered — a world with no arrangement says nothing about one.

The rules underneath are unit-tested in the data package —
`.claude/rules/grid-arrangements.md`.
