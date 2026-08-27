---
paths:
  - "packages/data/src/teams.json"
  - "packages/data/src/eras.ts"
  - "packages/data/src/types.ts"
  - "apps/web/src/lib/names.ts"
  - "apps/web/src/lib/livery.ts"
  - "apps/web/src/components/Liveries.tsx"
  - "apps/web/src/components/EntryNames.tsx"
---

# Team eras

What a team is *called*, where it is registered and what it is painted are facts about a
span of years, not about the team. `Team` is `{ id, foundedYear, identity[], liveries[] }`
and the `id` is the only identity there is — one continuous organisation for its whole
life, across every name it ever used.

A team carries two independent sorted lists, and **the resolution rule is the same for
both: the era in force is the last one whose `from` has arrived.** `from` and no `until`
— an era runs until the next one starts, so a boundary is stated once. A year before the
first era falls back to that first era rather than throwing, because every caller is a
render. **Never read a name or a colour off a field** — see "Reading one" below.

- **`identity: [{ from, name, base }]`** — Toleman → Benetton (1986) → Renault (2002)
  → Lotus (2012) → Renault (2016) → Alpine (2021), all one `id`. `base` rides along
  because the flag moves with the name, and `buildField` reads it *for the season being
  built*, so home advantage follows the era.

  **The id is the lineage's first name**, which is why the current Mercedes is
  `tyrrell` and the current Red Bull is `stewart`. The eleven that rename:

  | id | becomes |
  |---|---|
  | `toleman` | Benetton 86, Renault 02, Lotus 12, Renault 16, Alpine 21 |
  | `tyrrell` | BAR 99, Honda 06, Brawn 09, Mercedes 10 |
  | `jordan` | Midland 06, Spyker 07, Force India 08, Racing Point 19, Aston Martin 21 |
  | `stewart` | Jaguar 00, Red Bull 05 |
  | `minardi` | Toro Rosso 06, AlphaTauri 20, RB 24 |
  | `sauber` | BMW Sauber 06, Sauber 10, Alfa Romeo 19, Kick Sauber 24, Audi 26 |
  | `virgin` | Marussia 12, Manor 16 |
  | `ligier` | Prost 97 |
  | `march` | Leyton House 90, March 92 |
  | `caterham` | Lotus 10, Caterham 12 |
  | `arrows` | Footwork 91, Arrows 97 |

  **A name can belong to two lineages in different eras, and that is the point.**
  `lotus` is Team Lotus (1958-94), while `caterham` is called Lotus in 2010-11 and
  `toleman` is called Lotus in 2012-15; `renault` is the Viry works team (1977-85) and
  `toleman` is called Renault in 2002-11 and 2016-20. `honda`, `mercedes` and
  `aston_martin` likewise hold only their **first** incarnation — 1964-68, 1954-55 and
  1959 — because the modern teams of those names are the `tyrrell` and `jordan`
  lineages. Never key anything off a team's *name*: two rows can share one, in the same
  season (2011 has two teams called Lotus).
- **`liveries: [{ from, primaryColor, secondaryColor1, secondaryColor2, badgeStripes }]`**
  — colours as `#RRGGBB`, `badgeStripes` 0, 1 or 2.

**Two lists, not one, because the timelines do not coincide.** Ferrari has one name and
many liveries; McLaren raced in Marlboro white for eighteen unbroken years under one
name and then went silver; Toleman changed both at once in 1986. Folding them together
would force an invented name era every time a car was repainted.

**The grain is deliberately coarse.** Real liveries drift every season; an era is a
*substantial* change, and the small ones are not modelled — a team that looks like a
different team every year is unreadable in a table.

`validateSeedData` requires each list non-empty, its `from` years whole and **strictly
ascending** (a shared or out-of-order year would make an era dead data that reads as
authored), a non-empty name and an alpha-2 `base`.

**A season entry may still override all four livery fields for one year**, and it is all
four or none: `validateSeedData` rejects a partial override rather than merging one,
because the fields that fell back would combine into a livery nobody authored. This is
the **escape hatch, not the mechanism** — a team that looked different for a *span* of
years gets a `LiveryEra`. **No season declares one today**: the eras absorbed all 83
that existed, of which McLaren alone held ~40 identical copies of the same four values
from 1974 to 2016. `livery.test.tsx` asserts that count is zero rather than passing
vacuously, so re-authoring a genuine one-off means updating that assertion on purpose.

## Reading one

`eraAt`, `teamIdentityIn(team, year)` and `teamLiveryIn(team, year)` in
`packages/data/src/eras.ts` are the **only** places either list is indexed. There is no
`team.name` and no `team.primaryColor` to read instead — that is deliberate, and it is
what stops a 1983 table rendering a 2024 name.

On the web side the year rides a context rather than a prop chain: `Liveries` provides
it, `useSeasonYear()` exposes it, and `useEntryName()` / `useTeamName()` /
`useLivery()` consume it. Components handed a year directly — `SeasonGrid`, and the grid
editor previewing a draft — pass it explicitly instead, which is what lets them render a
grid the world has never seen.

`buildField` reads `base` for the season being built, so **home advantage follows the
era**: the lineage that raced as Toleman is registered in France as Alpine.
