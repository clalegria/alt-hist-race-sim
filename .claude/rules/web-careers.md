---
paths:
  - "apps/web/src/components/SeasonHistory.tsx"
  - "apps/web/src/lib/history.ts"
  - "apps/web/src/components/history.test.tsx"
---

# The career panel

What one name did in every year of the run: `lib/history.ts` derives it,
`SeasonHistory.tsx` draws it.

- **Every name in a run opens this panel**: wrap it in `DriverHistory` / `TeamHistory`.
  With no run in scope it renders plain text, not a control.
- **A driver's whole block is one trigger, team line included**; a team's panel is reached
  from the constructors' table. Two triggers a row would double the tab stops.
- **A fitted name's trigger takes `HISTORY_FILL`**, inside the call site's own layout box:
  outside a run the wrapper drops its `className`.
- **`DriverName` renders spans, not divs**: a `<button>` may only contain phrasing content.
- **A place is the row's index in the engine's table**, countback and all, so the panel
  agrees with the roll of honour. The opposite of `rankBy` (`web-records.md`).
- **A team's lineup comes off the drivers' table, not `world.field`**: a car that never
  made a round is not part of the team's year.
- **One walk for the whole run**: `SeasonHistoryProvider` in `RunFrame` (`App.tsx`) over
  `revealed(run).years`. A year in progress crowns nobody. `pageOf` exists only in an era;
  `racePage` in either kind of run.
- **The list scrolls, the panel does not grow**: the height cap is on the list.
- **Nothing in the list repeats the row it opened from**: no badges, no liveries, no
  zeros. The heading carries a flag, and no badge.
- **First place takes `STANDOUT_TEXT` wherever it appears**; `lineupOf` returns parts so a
  champion inside a team's line can take it.
- **The two-control row**: where a row expands and its text is a name, the chevron
  (`DisclosureButton` with `label`) keeps the expansion and the name opens the panel. Tell
  them apart by `aria-haspopup="dialog"`, never `aria-expanded`, which Radix also puts on
  its popover trigger.
- **What a panel says is a pure function in `lib/history.ts`**, tested there: Radix
  renders nothing of a shut popover (`web-testing.md`).
