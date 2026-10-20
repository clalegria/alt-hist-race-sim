---
paths:
  - "apps/web/src/components/CareerStatistics.tsx"
  - "apps/web/src/lib/records.ts"
---

# The career statistics

The record cards under the era's roll of honour (`CareerStatistics`, `lib/records.ts`).

- **A season's champion is the first row of its table**, as `lib/era.ts` reads it; never
  a second derivation that could disagree with the roll of honour.
- **`rankBy` lets equal figures share a position**; the career panel and the people pages
  separate them by countback (`web-careers.md`). Don't unify the two.
- **A driver row has no team line and no badge**: a career spans several teams.
- **A team row is drawn as of its label's year** (`labelsFor`), through a `Liveries`
  provider per row and no `EntryNames`: an entry name belongs to one season.
- **Spells and labels are decided in `lib/records.ts` and nowhere else.** `labelsFor`
  takes the whole list so all four cards name a lineage alike; `sharedNames` asks the
  run, not the database, and never applies to drivers.
- **No accent on a record card**: this screen spends its one accent on the season just
  finished.
- **A lineage row has two controls**: the chevron opens its spells, the name opens its
  career panel (`web-careers.md`).
