---
paths:
  - "packages/engine/src/race/home.ts"
  - "packages/engine/src/race/home.test.ts"
  - "apps/web/src/lib/home.ts"
  - "apps/web/src/components/HomeAdvantage.tsx"
  - "apps/web/src/components/home.test.tsx"
---

# Home advantage — the model and the star

One feature with two readers: the race model pays the bonus, and the sheets mark the cars
it was paid to. Both sides are here so the two cannot drift apart. The race model around
it is `.claude/rules/race-engine.md`.

## What it pays

An entry has **three allegiances**, and each pays into *both* session scores when the
round's country matches: `homeAdvantageDriver` (1.0) against `driverCountry`,
`homeAdvantageTeam` (0.5) against `teamCountry`, and `homeAdvantageEngine` (0.25)
against `engineCountry`. They stack, so a Frenchman in a Ligier-Matra at Paul Ricard
collects all three — 1.75 points, and that ceiling is the number to weigh these by, not
any one of them alone. An Italian in a Ferrari at Monza collects 1.5; a Brazilian in the
same car collects 0.75.

The ordering is the claim, and there is a test asserting it: a crowd shouts for the
driver first, the team second, and the supplier least of all — it brought engineers and
a truck, not a factory that slept in its own beds. Codes are ISO alpha-2, compared case-
and whitespace-insensitively; anything absent — no round country, no entrant country, no
engine — is simply no match. Set the constants to 0 to switch any share off.

**The rule lives in `race/home.ts`, not in `simulateRace`.** `homeAllegiances(entrant,
round)` returns the three booleans, `homeAdvantage(allegiances, constants)` prices them,
and both are exported from the package — because the *flags* have a second reader, below.
A classification marking a different set of cars from the ones the race actually paid
would be worse than marking none: two spellings of "is this driver at home" would drift
the first time a country code was written with a stray space. Anything that needs to know
who was at home calls this rather than comparing codes itself.

Three properties hold it in place, each with a test:

- **It draws no randomness.** The RNG stream after a race is identical with and without a
  host country, so where a round is held cannot change what happens at every later round
  of the season.
- **A shared bonus is invisible.** Only differences between cars move a result, so a grid
  where everyone is at home finishes in exactly the order it otherwise would. Most of the
  1980 field was British, which means what this really prices is the *visitor's* deficit
  at a round the paddock treats as home. The engine's share is worth even less than 0.25
  suggests for the same reason: ten of the fifteen 1980 entries ran a Cosworth, so at
  Brands Hatch it pays almost everybody, and what it prices is Ferrari's and Alfa's
  deficit there and their advantage at Imola.
- **The countries are identity, not rating.** All three ride on `RaceEntrant`, filled in
  by `buildField` from the driver's `nationality`, the team's `base` and the engine
  manufacturer's; the engine package still reads no seed data, and a field built without
  them races everywhere as a visitor.

The three numbers are a first guess, chosen for plausibility — a home race is worth a
tenth or two, not a car upgrade. **The harnesses cannot see them**: `pnpm calibrate` and
the tuner both run with no `RoundContext`, so home advantage pays nothing in any race
they run. Putting a real number on these would mean first deciding whether the harness
should rotate through a real calendar. See `.claude/rules/calibration.md`.

## The star

**An entry racing at home wears a star** — pale gold, trailing the entry's name in both
sessions: beside the team line under the driver on the grid, and at the foot of the same
two-line block in the classification. The two sheets deliberately put the same mark in
the same place relative to the same words; the grid slot's own corner was tried first and
read as a different mark on a different sheet.

Who is at home is **not decided here**: `HomeStar` asks the engine's `homeAllegiances`
about the entrant off the field as it was raced, so the sheet marks exactly the cars the
race paid a bonus to. The three facts stack, and the tooltip names the ones that actually
counted — `homeAdvantageLabel` in `lib/home.ts` owns that sentence, and is where the
wording is tested without rendering anything. **Nothing at all is drawn for an entry with
nobody at home**, for the reason the weather badge draws nothing on a dry round: most of
the field is away at most rounds, and a column of faint stars says nothing. The meaning
is in the tooltip, never in the star alone, like the gain and loss arrows.

**The grid travels by context, the round's country by prop.** Where everyone is from is a
fact about the season, so `SeasonView` publishes it through `HomeAdvantage` exactly as it
publishes the engine supply; where a round was held is a fact about *one* round, and the
same classification component is rendered for Monza and for Interlagos. No country means
no stars, which is what keeps every DOM-less render outside a season working.

It is an `<svg>`, unlike the livery badge and the disclosure chevron — so **a test
counting flags by counting `<svg>` on a race or qualifying screen has to count the stars
too**, off the field and the calendar rather than by writing a number down.
`App.test.tsx` does this next to its rain-cloud count.
