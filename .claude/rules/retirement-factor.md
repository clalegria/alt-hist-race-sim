---
paths:
  - "packages/engine/src/race/retirement.ts"
  - "packages/data/src/seasonConstants.ts"
  - "packages/data/src/seasons/**"
  - "tools/calibrate/src/retirements.ts"
  - "tools/calibrate/src/realRetirements.ts"
---

# Retirement factor — how hard a season is on its cars

One authored number per season file, `retirementFactor`, 1–10, **5 = the calibrated
constants untouched**. It is the first of roadmap item 5's *seasonal factors*, and the
first thing in the project fitted against a target measured for all 77 years rather
than for two.

```
season JSON  →  seasonConstants(seed, randomness)  →  withRetirementFactor(...)  →  RaceConstants
```

- `packages/engine/src/race/retirement.ts` owns the 1–10 → multiplier table and the
  derived-constants helper. Same shape as `randomness.ts`, and for the same reasons:
  it derives a copy, never edits `constants.ts`, and returns the constants object
  **by identity** at the neutral setting.
- `packages/data/src/seasonConstants.ts` composes it with the randomness level. Every
  runner of a season goes through it — the app store, `pnpm season`,
  `pnpm calibrate-season`, `pnpm retirements`. Do not compose the two by hand at a
  call site.
- `tools/calibrate/src/realRetirements.ts` is the target set; `retirements.ts` is the
  harness. `pnpm retirements --sweep` prints the best-fitting factor per year.

## What it scales, and why it is both rolls

**Mechanical failure and driver error, by the same multiplier.** Mechanical alone
cannot work: composure is a career attribute with no era term, so driver-error
retirements are worth ~13% of starts in every year of history — *more than a modern
season's entire retirement rate*. A knob that left them alone could not reach 2024 no
matter how far it turned.

It does not touch pace. A fragile era is not a random one; that is the randomness
level, and the two compose because they scale disjoint constants.

## The uncomfortable finding: the ratings carry almost none of the era

The authored chassis and engine `reliability` ratings do rise across the decades, and
it moves the simulated rate far less than you would expect. At factor 5 across all 77
seasons the model produces **30%–45%**, top to bottom of history. The real sport ran
**9.0% (2024) to 57.1% (1968)**. Everything outside that fifteen-point band is the
factor's work, which is why the scale has to reach 0.3 at the bottom.

That is not a complaint about the ratings. It is that both mappings *below* them were
fitted to 1980 and neither has an era term: `mechanicalDnfAtZeroReliability` /
`AtFullReliability` turn a rating into a probability on 1980's terms, and driver error
never sees the year at all. **Do not "fix" this by re-authoring reliability ratings** —
that is a re-tune, it needs the author's word, and the dial is the cheaper answer.

## The fit

77 of 77 years have a measured target and every one lands within **2.9 points**, mean
absolute error **1.30**. Factors used run 1–8; nothing is pinned to an end of the
scale, and 9 and 10 are headroom. Roughly: 1950s **6**, 1960s **4–8**, 1970s–80s
**6–8**, 1990s **6–7**, falling through the 2000s **5→2**, 2010s–20s **1–3**.

Measured at `peak` ratings, 400 seasons a year. The `aged` grid gives mean 1.39 / worst
3.71 against the *same* authored factors, so the fit does not depend on which rating
mode a run uses — worth knowing, because the two harnesses disagree about the default.

**1980 and 1981 moved off 5, to 6.** They are the two fitted seasons, so this is the
one place the new dial touches settled work: their real rates are 48.5% and 48.3%, and
at factor 5 the model gives 41.0% / 40.4% — which is the 41.3% figure in
`.claude/rules/calibration.md`. Two things follow, and neither has been acted on:

- **`retirementRate: 0.42` in `tools/calibrate/src/targets.ts` is an estimate that the
  measurement contradicts** by six and a half points. It was not changed. Changing it
  would re-fit chassis and engine reliability ratings, which needs the author's word.
- **The tuner still runs at the neutral factor**, deliberately: `pnpm tune` builds
  constants from `RACE_CONSTANTS`, not from `seasonConstants`, so a season's dial
  cannot drift the ratings it fits. Whether it *should* see the factor — fitting cars
  against the real rate instead of 42% — is an open question for the author.

## Counting rules — the part to get right

**A DNQ is not a retirement and is not in the denominator.** Both sides count the same
way, which is the only reason the numbers can be compared at all:

- The engine already splits them — `retirements` and `classifiedCount` are starters,
  `nonQualifiers` are not — so the harness's rate is
  `retirements / (retirements + classifiedCount)`.
- The real figures come from the Ergast/Jolpica **classification**, which a car that
  failed to qualify never appears in. Withdrawn entries are dropped as non-starters; a
  car given a finishing position despite stopping counts as a finisher, matching where
  the engine draws the same line; the ~120 disqualifications in 77 years stay in as
  finishers.

The definition is checkable: it reproduces the published figures for the seasons people
have written about — 53.9% for 1984 against ~54%, 51.6% for 1989 against ~51%, 44.3%
for 1999 against ~45%, 33.3% for 2003 against ~32%.

**2026 is a partial season** (12 rounds fetched, a regulations year running hot at
17.9%). Its factor is fitted to that partial record and should be revisited when the
year finishes.

## Working here

- `pnpm retirements` reports every year at its authored factor; `--sweep` re-fits;
  `--year`, `--mode`, `--randomness` narrow it. 200–400 seasons a year is plenty — a
  season is already ~400 coin flips.
- **This harness is the one exception to "do not run a harness to check something"**,
  and only for this number: the author asked for the per-season retirement calibration
  (roadmap item 5). Nothing it prints is a reason to move a chassis, an engine or a
  driver rating.
- Adding a season means authoring its factor too. Start at 5, run
  `pnpm retirements --sweep --year <n>`, take the best. `validateSeedData` rejects
  anything that is not a whole 1–10.
- The remaining two thirds of roadmap item 5 — per-season cosmetic gaps and
  `maxStarters` — are untouched. Both are still one global constant.
