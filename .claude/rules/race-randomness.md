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
| 2 | Balanced (default) | **1.0** |
| 3 | Exciting | 1.5 |
| 4 | More exciting | 2.1 |
| 5 | Chaotic | 3.0 |

**Level 2 returns `RACE_CONSTANTS` itself, by identity** — not a copy, not a copy
multiplied by 1. That is what keeps everything measured in this file and in
`calibration.md` a true description of what the app runs by default, and it is asserted
with `toBe` rather than `toEqual` so no arithmetic can creep in between the calibrated
numbers and the default season. **The other four levels are not calibrated against
anything and are not meant to be.** Do not read a figure off a run at level 4 and
"correct" a constant with it.

**The upper three are steep on purpose, and the first attempt at them was not.** They
started at 1.2 / 1.45 / 1.9 and chaotic did not feel chaotic: a season averages its noise
away over a dozen-odd rounds, so scatter that changes an afternoon barely moves who ends
the year on top. Measured over 1980 and 2010, the favourite took the title 49% of the
time at level 2 and still 39% at the old top setting. At 3.0 the favourite takes ~30%,
twenty different drivers win titles across a run of seasons rather than seven, and every
car on the grid wins a race sooner or later. Past 3.0 it flattens rather than getting
wilder, because what is left concentrating the titles is reliability, which this setting
does not touch. Those figures came from a throwaway script, not from `pnpm calibrate`,
and nothing authored was changed on the strength of them.

Three numbers move and nothing else does. `qualifyingNoise` and `racingNoise` take the
same factor: scaling both in step leaves the variance split intact, where scaling one
alone would quietly re-weight weekend form against session luck, which is a different
lever (`.claude/rules/race-constants.md`).

**`teamFormBoost` is the third, and it moves only at levels 4 and 5** (1.2 and 1.35).
It exists because scaling the sigmas uniformly does not scale *upsets* uniformly. Noise
is additive in rating points, and the two signals it competes against are not the same
size — a car gap is worth `weightCarRacing` times itself, a driver gap only
`weightDriverRacing` times itself — so the driver signal is much the smaller and a
uniform increase drowns it first. Turning the dice up therefore bought mostly *teammate*
upsets: at level 5 the second driver in a dominant car took the title far more often than
the title went to a car that was not the best on the grid, which is the reverse of what
"chaotic" should mean. Boosting the team term specifically buys the second without buying
much of the first — measured over 2002 and 2011 it roughly doubles how often a weaker car
takes the title, while moving teammate upsets two or three points.

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

