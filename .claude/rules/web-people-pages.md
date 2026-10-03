---
paths:
  - "apps/web/src/routes/run/drivers.tsx"
  - "apps/web/src/routes/run/teams.tsx"
  - "apps/web/src/routes/run/driver/**"
  - "apps/web/src/routes/run/team/**"
  - "apps/web/src/components/PersonPages.tsx"
  - "apps/web/src/components/RosterIndex.tsx"
  - "apps/web/src/components/people-pages.test.tsx"
  - "apps/web/src/lib/roster.ts"
  - "apps/web/src/lib/roster-places.ts"
  - "apps/web/src/lib/roster.test.ts"
---

# Web app — the people pages

A page per driver and per team, and the two lists of everyone in the run. The router
and the gate are `.claude/rules/web-routing.md`; the career panel that leads here is
`.claude/rules/web-careers.md`.

| URL | Page |
|---|---|
| `/run/drivers?sort=wins` | `RosterIndex kind="drivers"` |
| `/run/teams?sort=wins` | `RosterIndex kind="teams"` |
| `/run/driver/piquet` | `DriverPage` |
| `/run/team/tyrrell` | `TeamPage` — the **lineage id**, one address for every name it raced under |

## Who is in the run

**The roster is everyone in the `field` of a year reached** (`rosterOf` over
`revealed(run).years`, `lib/roster.ts`). The cursor's own year counts from its grid on,
so someone on the grid who has not raced has a page ("On the grid", "No races yet"). A
driver only on a grid still ahead has none: a page would give that grid away. The
figures come off the championship tables (`careerRecords`, `seasonHistories`); the
roster only says who is listed and for how many seasons.

`resolveRosterPage` (`lib/roster-places.ts`) is the door, beside `resolveRunPage`. An
index always shows; an id that is malformed (`parseId`: the seed data's
`[a-z0-9_]`) or not on the roster redirects to its index, in `guardRosterPage` before
render and again in `RosterPlacePage` on render, since a restart can take someone out
of the run under their page.

**A year cut before its last race is in progress** (`isComplete` in `lib/reveal.ts`):
it crowns nobody, and a place in it reads "3rd after round 5" (`afterRound`,
`placeLabel`). The tallies take `TalliedYear`, which a whole `World` and a
`RevealedWorld` both are; a whole world is complete.

## The pages

Both take the revealed years and an id, and never the store. A header (flag, name;
a driver's age, entry and overall as of their latest year on the grid; a team's names
as `spellSpan`s), the run's totals, then `CareerSeasons`: a row per year, latest first
and open, each a `DisclosureButton` on the year opening into `RaceByRace`, plus
"N rounds to come" on a year in progress. Each row sits in its year's `Liveries` and
`EntryNames`. Names inside the page — a driver's team, a team's lineup — are the panel
triggers every name is, never links.

## The lists

**A name on an index is a plain link to the page**, the one exception to panel first:
an index is a directory. A driver is named alone, as on a record card; a team as of
its last year, with "under N names" past one. Everyone on the roster is listed, a
career on zero included.

**The order is a search param** (`indexSearch`), each column heading a `Link` with
`aria-sort`; the default, titles, is left out of the URL. `sortIndex` is total:
biggest first, ties falling through titles, wins, podiums, poles, points, seasons, then
the id; *name* is A to Z, then the id.

## Ways in

The root crumb's **Run sections** menu (`.claude/rules/web-run-bar.md`); *Full page →*
on every career panel and on the grid's driver and team popovers, the editor shut
(`usePageOf` in `SeasonHistory.tsx`); *All drivers → / All teams →* over the era's
career statistics. All of them draw only inside the run's frame, so a test without a
router sees none.

## Testing

`lib/roster.test.ts`: the roster against the fields at every beat of an era; the door
for every roster id, and for a stranger, a typo and a driver searched for on a later
grid; the sort against synthetic rows. `people-pages.test.tsx`: one season row per year
on the roster with one open, "after round N" mid-season, every index name a link.
`routes.test.tsx` runs the four guards.
