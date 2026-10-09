---
paths:
  - "packages/engine/src/weather/*.ts"
  - "apps/web/src/components/WeatherBadge.tsx"
  - "tools/calibrate/src/wet.ts"
---

# Wet racing

About **one round in seven is declared wet**, and a wet one is scored on derived
constants and derived driver ratings. Everything lives in `packages/engine/src/weather/`
— `constants.ts` (every tunable number) and `weather.ts` (the roll, and the two
derivations). `simulateRace` rolls the weather before it scores a single car and reports
it back on `RaceResult.weather`.

## Wetness is a range, not a switch

A declared-wet round draws a **wetness** in `[wetnessFloor, wetnessCeiling]` = `[0.2, 1]`,
skewed toward the floor by `floor + span * u ** 1.6`. Mean wetness of a wet race is about
0.51; a biblical one (>0.9) turns up in roughly one wet race in eight, so about once every
five seasons. That is the point: most wet races are a shower over a dry weekend, not the
1996 Spanish Grand Prix, and a feature that turned everything to maximum every time would
make rain a coin flip rather than a condition.

**Every effect scales linearly with wetness**, from "no change at all" at 0 to its full
value at 1. Nothing is a step change.

| what moves | at full wetness | constant |
| --- | --- | --- |
| both noise sigmas | ×1.9 | `noiseScaleAtFullWetness` |
| driver-error risk | ×2.6 | `driverErrorScaleAtFullWetness` |
| mechanical risk | ×1.25 | `mechanicalScaleAtFullWetness` |
| car → driver, both sessions | −0.12 / +0.12 | `driverWeightShiftAtFullWetness` |
| engine → chassis, pace | −0.12 / +0.12 | `chassisWeightShiftAtFullWetness` |
| `racing`/`qualifying` → `wetWeather` | 75% blend | `abilityShareAtFullWetness` |
| `composure` → `wetWeather` | 50% blend | `composureShareAtFullWetness` |

Weight pairs are **shifted, never replaced**, and the shift is capped by what there is to
give, so every pair still sums to 1 and no weight can invert. Reliability keeps its even
chassis/engine split — an engine drowns as readily as a gearbox.

## Three properties, all load-bearing

1. **A dry round returns its inputs by identity.** `wetConstants(DRY, c) === c` and
   `wetDriver(d, DRY) === d`, asserted with `toBe`. Six rounds in seven are therefore
   scored by *precisely* the constants as written, with no arithmetic in between — the
   same guarantee `withRandomness` makes at its unscaled level and
   `withRetirementFactor` at 5.
2. **It composes as a separate multiplier**, never as a share of one constant. The
   randomness slider says how much the dice decide across a run; this says how much
   *this afternoon* did. A chaotic run in the rain gets both, multiplied. Same for the
   season's retirement factor: it scales the risks where they are *defined*, exactly as
   `withRetirementFactor` does, so the race model needs no knowledge that weather exists.
3. **The roll always draws two values, wet or dry, and before anything else.** A stream
   position that depended on the outcome would make round 5 depend on whether round 4
   rained. `RoundContext.weather` forces an afternoon (`pnpm race 7 --wet 0.8`) and the
   roll still happens underneath it, so a forced race is a *comparison* rather than a
   different race.

## The `wetWeather` rating

A sixth authored driver attribute in `drivers.json`, 1–100, same polarity as the rest.
Authored as `round(0.7 · racing + 0.3 · qualifying)` for most of the pool — wet pace and
dry pace really are highly correlated, and a driver nobody has an opinion about should sit
exactly on that line — with a hand-written delta for the drivers the sport remembers one
way or the other. Senna, Schumacher, Stewart, Ickx, Pedro Rodríguez, Beltoise, Bellof,
Boutsen, Peterson, Gilles Villeneuve, Hülkenberg, Button and Stroll above; Prost (−8),
Lauda, Piquet, Regazzoni, Arnoux, Berger, Irvine, Trulli and Maldonado below.

**A driver whose wet rating equals their dry one is completely unaffected at every
wetness.** That is by construction, and it is why the field costs nothing to author for
the majority: this term exists for the exceptions.

The ageing curve reads it like any other attribute — development sensitivity 0.8 (wet
pace arrives early; the drivers famous for it were mostly famous for it young), decline
1.0 (it goes at the same rate racecraft does, not at qualifying's 1.3).

It carries **0.04 of `driverOverall`** — the smallest of the four weights that count, not
because a wet race cares least about it but because only one race in seven is wet and an
overall is an average over a season.

## The UI

`WeatherBadge` — the icon, the word, and the percentage — appears on the race header, the
qualifying header (the weather belongs to the whole weekend: it moves qualifying's noise
and weights exactly as it does the race's) and under each round of the summary's calendar.

**It renders nothing at all for a dry race**, the same argument the classification's
status column makes: a column reading "Dry" fourteen times says nothing, and what a reader
scans for is the round where the sky changed the result.

**A white-on-blue pill** — `bg-wet text-wet-foreground rounded-full` — and both halves are
deliberate. Not `--color-primary`, which means "won the thing on screen"
(`lib/highlight.ts`), and not red, which reads as a warning rather than as weather. Blue
means rain with no legend. The `rounded-full` is a departure from a house style that runs
the radius scale tight on purpose, and the departure is the point: everything else on
these pages is a table cell or a card, so the one fully round thing is unmistakably a tag
*on* a round rather than part of the furniture. The tokens are per-theme and were picked
by measuring contrast — see `index.css` and `.claude/rules/web-styling.md`.

The cloud is **inline SVG in `currentColor`**, drawn rather than fetched — an emoji ☔ is a
different picture on every platform and a grey box on Windows, and a remote image is a
network dependency in an app that has none. One icon rather than a scale of them: the
wetness is stated in words beside it, and a drizzle icon and a downpour icon would be two
ways of saying the same thing. **16px at stroke 2 with two drops**, arrived at by rendering
the candidates at real size: three finer drops at 14px merged into a smudge under the
cloud. Note that **it is an `<svg>`**, so the tests that count flags that way have to
account for it — `App.test.tsx` derives the count off `race.weather.wet` rather than
assuming a dry fixture.

## What was corrected, and what was not

**The constants in the table above are judgements**, chosen for plausibility. One
consequence of them was measured and taken back out, at the author's request:

**Retirements — corrected.** Raising both DNF risks on ~15% of rounds inflated a season's
expected driver-error risk by ~12% and its mechanical risk by ~2%, which pushed every
year's retirement rate up ~1.3 points and broke the fit behind all 77 `retirementFactor`
values. The four DNF endpoints in `race/constants.ts` now carry a **x0.985 / x0.90**
correction that undoes exactly that, which puts the whole 77-year set back where it sat
before wet racing existed. The table is in
`.claude/rules/race-constants.md`, the derivation in `constants.ts`. **Note that this makes a dry race
retire marginally fewer cars than it used to** — unavoidable, and the author's call.

**Win shares — not corrected, deliberately.** The best driver loses 1-2 points of win
share to the rain, which is what "the field genuinely reorders" means, and it is the same
order as the two points consistency's spread lever already handed the best pairing in the
other direction. If it is ever to be recovered the lever is `noiseScaleAtFullWetness`,
not a chassis rating.

Beyond that: do not adjust a race constant, a chassis rating or a season's retirement
factor to absorb this without the author asking — the invariant in `CLAUDE.md` covers it,
and the measurements exist precisely so the decision can be made on numbers.
