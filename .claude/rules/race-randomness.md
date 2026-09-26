---
paths:
  - "packages/engine/src/race/randomness.ts"
---

# The randomness slider

`race/randomness.ts` is a **scale factor over these constants, never an edit to them**.
Five levels, chosen once on the setup screen before anything is simulated:

| level | label | noise scale |
| ----- | ----------------- | ----------- |
| 1 | Realistic | 0.85 |
| 2 | Balanced | **1.0** |
| 3 | Exciting | 1.25 |
| 4 | More exciting | 1.65 |
| 5 | Chaotic | 2.5 |

**Two levels have names in code, and they are not the same one.**

- **`DEFAULT_RANDOMNESS_LEVEL` (1, `Realistic`) is the reference level.** Anything not
  told otherwise runs here — every harness, every tool, every measurement worth making —
  because it is the setting that asks the model to be a plausible history rather than a
  good story. It is the level to state, or assume, when talking about what the model
  does.
- **`UNSCALED_RANDOMNESS_LEVEL` (2) is the arithmetic one**: the single stop whose factor
  is 1, where `withRandomness` returns `RACE_CONSTANTS` *itself*, by identity — not a
  copy, not a copy multiplied by 1. Asserted with `toBe` rather than `toEqual`, so no
  rounding can creep in between `constants.ts` and the race.

**The web app opens on level 2 and neither of these is why.** `STARTING_RANDOMNESS_LEVEL`
in `apps/web/src/lib/preferences.ts` is a claim about what makes a good first season for
a reader who has not met the slider; it lives in the app because the engine has no
opinion about what is fun. Do not collapse the three into one number — a test in
`preferences.test.ts` pins that the app's opening offer is not the reference level.

**Only the reference level means anything about the model.** Do not read a figure off a
run at level 4 and "correct" a constant with it.

**The upper three have been re-set twice.** They started at 1.2 / 1.45 / 1.9, which did
not feel chaotic: a season averages its noise away over a dozen-odd rounds, so scatter
that visibly changes an afternoon barely moves who ends the year on top. It takes a
factor around 3 before the favourite stops being the favourite, before a run of seasons
produces twenty different champions rather than seven, and before every car on the grid
wins a race sooner or later. Past that it flattens rather than getting wilder, because
what is left concentrating the titles is reliability, which this setting does not touch.

Three numbers move and nothing else does. `qualifyingNoise` and `racingNoise` take the
same factor: scaling both in step leaves the variance split intact, where scaling one
alone would quietly re-weight weekend form against session luck, which is a different
lever (`.claude/rules/race-engine.md`).

**`teamFormBoost` is the third, and it moves only at levels 4 and 5** (1.2 and 1.35).
It exists because scaling the sigmas uniformly does not scale *upsets* uniformly. Noise
is additive in rating points, and the two signals it competes against are not the same
size — a car gap is worth `weightCarRacing` times itself, a driver gap only
`weightDriverRacing` times itself — so the driver signal is much the smaller and a
uniform increase drowns it first. Turning the dice up therefore bought mostly *teammate*
upsets: at level 5 the second driver in a dominant car took the title far more often than
the title went to a car that was not the best on the grid, which is the reverse of what
"chaotic" should mean. Boosting the team term specifically buys the second without buying
much of the first: it roughly doubles how often a weaker car takes the title, while
barely moving teammate upsets.

It is a multiplier on the team *weight*, not a redistribution, so at 4 and 5 the total
noise sits a little above the nominal scale. That is deliberate; it is also why the boost
stays at 1 for levels 1-3, so the shape of the randomness only changes once a run has
already opted out of realism.

Reliability is deliberately untouched: chaotic means unpredictable, not fragile, and a
separate reliability setting is the author's plan rather than a second thing folded into
this one. Grid advantage, home advantage, the consistency penalty, the powertrain weights
and both form *shares* are untouched for the same reason — they are what a rating
*means*.

The level rides in the world state beside the seed and the rating mode, because it is a
simulation input: same seed at two levels is two championships, same seed and same level
reproduces exactly. A standalone season keeps the level it was started on; an era bakes
in the level its first year was started on and carries it through every year that
follows. The tools take `--randomness <1-5>` so a bug report can be reproduced under the
level it was made at.

