# Roadmap

What is left, in order; the order matters because items create work for each other.
Finished items are deleted. Refer to items by name, not number. Each item's design lives in
the doc it links; the unbuilt modes in `lib/modes.ts` are turned on by the item named for them.

## The authoring pass

The author's own work and the top priority: re-checking all seventy-seven seasons
(`packages/data/src/seasons/`), every rating a first draft. Touch these numbers only when
asked for that era by name.

- Going backwards from 2026; down to 2005 is done. The far ends (the fifties and sixties,
  the most recent years) are the least trustworthy.
- Livery colours per team era (`teams.json`, `team-eras.md`) ride along with whichever era
  is being tuned; most teams still have one set for their whole life.
- *Historical career records*, *seasonal factors* and *circuit character* add fields to the
  same files: a second visit, settled together.

---

## 1. Sort the UI review

The author goes through `docs/design/ui-review.md` item by item: must-do before *publish
it*, later, or drop. Must-dos are then built one per chat. Comes before the next two.

## 2. Phone layout

Make every screen work on a phone held upright. `docs/design/publish.md`.

## 3. The share image

A portrait PNG of a season's or era's result, sent from a phone. `docs/design/publish.md`.

## 4. Publish it

The text pass, an About page, What's new, a bug report page, then going live. The author
decides when. `docs/design/publish.md`.

## 5. The in-app ratings editor

Turns on `edit-ratings`: a player changes a rating and runs their own what-if; export in
the seed format. After *publish it*. `docs/design/ratings-editor.md`.

## 6. Historical career records

Each season file carries every driver's and team's totals before it, so a run opens on
careers in progress. `docs/design/career-records.md`.

## 7. Seasonal factors

The cosmetic qualifying and race gaps, per season instead of one scale. Display only. This
item authorises setting that number per year, and no other.

## 8. Circuit character

Circuit attributes in `RoundContext`: engine vs downforce weighting, how hard it is to
overtake, the chance of rain (`wetChance` is the unused seam). Changes what a rating means;
adds a block to every round of every season.

## 9. Driver market

Transfers between seasons; turns on `era-advanced`. Leans on *historical career records*.
`docs/design/era-advanced.md`, which owns its open questions.

## 10. Game mode

Run one team (`game`): *era-advanced* from inside a team, so after it. Notes in
`docs/design/era-advanced.md`.

## Someday: the Share link

A link that rebuilds a run on another machine. Unscheduled. `docs/design/ratings-editor.md`.

## Someday: Graphic marks

Title stars, a livery barcode on the team page, a podium on the race page. Unscheduled; the
podium waits on *Phone layout*, the stars on *Historical career records*. `docs/design/graphic-marks.md`.
