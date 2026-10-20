---
paths:
  - "packages/engine/src/weather/*.ts"
  - "apps/web/src/components/WeatherBadge.tsx"
  - "tools/calibrate/src/wet.ts"
---

# Wet racing

The weather roll, the wet constants and driver, and the badge that reports them.

- A dry round returns its inputs **by identity** from `wetConstants` and `wetDriver`
  (asserted with `toBe`); a wet one composes with the randomness level and the
  retirement factor as a separate multiplier, never as a share of one constant.
- **The four DNF endpoints in `race/constants.ts` carry a correction for wet racing**
  (derived on `driverErrorDnfAtZeroComposure`). Changing the wet chance, the wetness
  draw or a wet retirement multiplier invalidates it: say so, and leave re-deriving it
  to the author.
- Win shares are deliberately not corrected for the rain. If the author ever wants them
  back, the lever is `noiseScaleAtFullWetness`, not a chassis rating.
- Never adjust a race constant, a chassis rating or a `retirementFactor` to absorb what
  the rain does without the author asking.
- **Authoring `wetWeather`** (`drivers.json`): `round(0.7 · racing + 0.3 · qualifying)`
  for a driver nobody has an opinion about, so they are unaffected by rain; a
  hand-written delta only for drivers the sport remembers as good or bad in the wet.
- **The badge names a wet race in a word** (`rainWord`): the wetness range in equal
  thirds, read off `WEATHER_CONSTANTS`, so moving the floor or ceiling moves the words.
  Never write the cut-offs into the app. The percentage lives only in its tooltip.
- A test counting `<svg>` on a race or qualifying screen must count the rain cloud too,
  off `race.weather.wet`, never assuming a dry fixture (`App.test.tsx`).
