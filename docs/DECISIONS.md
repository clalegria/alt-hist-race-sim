# Open decisions

Questions waiting on the author. Confirm before implementing — do not assume. When one is
settled, **delete it here**: the outcome goes into `docs/ROADMAP.md` if it is work still to
do, or `.claude/rules/` once it is built. Why a constant has the value it has is not a
decision; it lives in the rule file for that constant.

## What moves the driver market

A design conversation, not a coding task. Blocks *driver market* and *game mode*. It
carries three smaller questions with it:

- **`adaptability`** is authored and read by nothing, and weighted zero in the overall
  (`packages/data/src/rating.ts`), because it is reserved for this.
- **Engine deals.** Nothing changes an engine supplier between seasons, and nothing
  models a works versus a customer deal (a works team is inferred from matching names).
  Whether a supplier moves with the market, with progression, or only by a team-management
  choice is part of the same conversation.
- **Career events are in season space.** A step down authored for 1986 is a historical
  event; once a run diverges far from history it may want to travel with the driver's age.

## Should the fitter and tuner move drivers?

`pnpm fit` and `pnpm tune` fit cars; drivers move only behind `--drivers`, off by default
(`tools/calibrate/src/targets.ts`). Whether driver ratings should ever be fitted, rather
than only authored by hand, is open.
