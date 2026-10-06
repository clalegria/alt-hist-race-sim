---
paths:
  - "packages/engine/src/race/retirement.ts"
  - "packages/engine/src/race/breakdowns.ts"
  - "packages/data/src/seasonConstants.ts"
  - "packages/data/src/seasons/**"
  - "tools/calibrate/src/retirements.ts"
  - "tools/calibrate/src/realRetirements.ts"
---

# Retirement factor — how hard a season is on its cars

One authored number per season file, `retirementFactor`, 1–10, **5 = the constants
untouched**. It is the first of the roadmap's *seasonal factors*, and the one number
in the project with a real target behind every single year — `pnpm retirements --sweep`
answers it against the actual record.

```
season JSON  →  seasonConstants(seed, randomness)  →  withRetirementFactor(...)  →  RaceConstants
```

- `packages/engine/src/race/retirement.ts` owns the 1–10 → multiplier table and the
  derived-constants helper. Same shape as `randomness.ts`, and for the same reasons:
  it derives a copy, never edits `constants.ts`, and returns the constants object
  **by identity** at the neutral setting.
- `packages/data/src/seasonConstants.ts` composes it with the randomness level. Every
  runner of a season goes through it — the app store and every harness that takes a
  year. Do not compose the two by hand at a call site; a caller racing constants not
  yet written (the tuner's `--noise`) passes them as its `base`.
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

## Two run settings over it

The app's Races settings (`docs/design/run-settings.md`, `.claude/rules/web-setup.md`)
reach the constants through `seasonConstants`'s fourth argument, `run`, built by
`runConstants` in the web store. Both are identities when historical.

- **Reliability: As in ⟨year⟩** breaks every year's cars down at that season's
  `retirementFactor` — `withRetirementFactor`'s third argument, `mechanical` — while
  driver error keeps the year's own. Cars only, so under Breakdowns: None it has
  nothing to scale: the setup screen greys it out and `createWorld` drops it.
- **Breakdowns** (`race/breakdowns.ts`) multiplies `mechanicalDnfEraScale` only —
  Realistic 1, Fewer 0.5, None 0 — on top of the factor, and returns the constants by
  identity at Realistic. **Driver error is untouched**: composure is a driver rating, so
  None means no car fails, not that nobody crashes out. The weather multiplies the same
  field, so a zero stays zero in the wet.

## The uncomfortable finding: the ratings carry almost none of the era

The authored chassis and engine `reliability` ratings do rise across the decades, and
it moves the simulated rate far less than you would expect. At factor 5 across all 77
seasons the model produces **30%–45%**, top to bottom of history. The real sport ran
**9.0% (2024) to 57.1% (1968)**. Everything outside that fifteen-point band is the
factor's work, which is why the scale has to reach 0.3 at the bottom.

That is not a complaint about the ratings. It is that both mappings *below* them turn a
rating into a probability on one era's terms and neither has a year in it:
`mechanicalDnfAtZeroReliability` / `AtFullReliability` know nothing about the decade, and
driver error never sees the year at all. **Do not "fix" this by re-authoring reliability
ratings** — that needs the author's word, and the dial is the cheaper answer.

## Reading the sweep

Factors in use run across most of the 1–10 scale, and their shape is the sport's own:
higher through the fifties to the eighties, falling through the 2000s, low in the 2010s
and 20s. Nothing sits at an end of the scale, which leaves headroom for a season harder
on its cars than any real one.

**The rating mode barely moves it.** A `peak` grid and an `aged` one land on the same
factors to within a fraction of a point, which is worth knowing: a sweep is not quietly
measuring the ageing curve. 200–400 seasons a year is plenty of sample either way.

**The tuner races at the season's factor** and scores against the year's real rate from
`realRetirements.ts`, so its reliability proposals are what is left after the factor,
not a second copy of it.

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

**2026 is a partial season** (12 rounds fetched, a regulations year running hot). Its
factor answers that partial record and should be revisited when the year finishes.

## Working here

- `pnpm retirements` reports every year at its authored factor; `--sweep` re-fits;
  `--year`, `--mode`, `--randomness` narrow it. 200–400 seasons a year is plenty — a
  season is already ~400 coin flips.
- **This harness is the one exception to "do not run a harness to check something"**,
  and only for this number: the author asked for the per-season retirement dial
  (*seasonal factors* in the roadmap). Nothing it prints is a reason to move a chassis,
  an engine or a driver rating.
- Adding a season means authoring its factor too. Start at 5, run
  `pnpm retirements --sweep --year <n>`, take the best. `validateSeedData` rejects
  anything that is not a whole 1–10.
- What is left of *seasonal factors* is the per-season cosmetic gaps, still one global
  constant.
