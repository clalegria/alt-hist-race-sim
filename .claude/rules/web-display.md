---
paths:
  - "apps/web/src/components/**"
---

# Web app — display rules

How the reveal is drawn. The architecture these sit on — screens, the one store, the
reveal cursor, and how any of this is tested — is in `.claude/rules/web-app.md`, which
loads alongside this file.

- **The grid opens closed.** Teams and drivers with a flag, an age and one overall
  rating; the five individual ratings live behind a popover, and teams are listed
  alphabetically rather than by pace so the pecking order is not given away before a
  wheel turns. A test asserts no rating label appears in the closed markup.
- **The grid can be rearranged, and only by swapping.** `Edit grid` turns every driver
  row into a select button and opens `ReserveList` — everyone in the pool without a
  seat — as a sticky sidebar; the team cards drop from three columns to two to make
  room. Select a driver, then whoever takes the seat: seated ↔ reserve, or seated ↔
  seated between two teams. Two reserves in a row cannot swap, so the second just
  becomes the selection rather than doing nothing visible. Nothing here can *add* a
  car, by construction rather than by validation.
- **An edited grid says so, in the same muted dashed frame everywhere.** Deliberately
  *not* the `lib/highlight.ts` accent: "the grid was changed" is a caveat on a result,
  not something that was won, and borrowing the accent would also break the test that
  counts exactly two accented cards per summary. A driver who is not where history put
  them carries the same soft fill (`SWAPPED_IN`) in the grid, so the note and the cards
  agree without the reader matching names. The summary declares it **twice** — a banner
  above the champions, because finding out at the foot of the page is finding out too
  late, and the full list on the grid at the end.
- `lib/rating.ts` computes the overall: a **display heuristic, not model truth** —
  nothing in the engine reads it — whose weights approximate how much each rating
  actually moves results. Reliability takes a quarter of the car number despite
  touching no race score, because ~42% of the 1980 field failed to finish and a
  fragile car forfeits points it had the pace to take. Adaptability is weighted zero:
  paying for it would claim a driver is better at something the sim never asks of.
- **One accent, defined once in `lib/highlight.ts`**: pole on the grid, the winner of
  a race, each champion on the summary, and the champion's row in the race sidebar
  from the round the arithmetic settles it. The banner announcing a title appears on
  that round *only* — repeating it turns the beat the season built to into a standing
  notice, and the row accent already carries the fact. A test asserts exactly one row
  or card carries the accent per view, since "make it look coherent" is the sort of
  thing that quietly stops being true.
- **Qualifying is drawn as a starting grid**, not a table: two columns, odd left, even
  right, the right column set back half a row. Rows are a fixed height and even slots
  shift by exactly half of it via `translate-y`, which moves them visually without
  changing layout height — so car N sits at `(N − 1) × step / 2` and P1→P2 spacing
  equals P2→P3. **A margin would grow the row it sits in and bunch each pair
  together.** Two numbers control this and must stay in that 2:1 ratio; a test parses
  both out of the markup and fails if they drift. Below `sm` the stagger drops to one
  column. Cars outside the cut are listed apart — they never form up, and slotting
  them in would put the wrong drivers on the wrong side.
- **A race shows its result and the championship side by side**, standings cut to
  position/name/points and the top eight. Movement arrows come from running
  `championshipStandings` over one fewer race and comparing, which costs nothing
  because standings are derived. Round one shows none. Direction rides the glyph as
  well as the colour, with the count in a `title`, so it is not colour-only. The full
  breakdown belongs to the summary — after one round it is all zeroes.
- **Actions live in a sticky header, repeated at the foot**, and every stage change
  scrolls to the top — otherwise stepping on from a race means scrolling past two
  28-row tables, then landing mid-page in the next session.
- **Flags** go beside every driver and team everywhere they are named, via the shared
  `DriverName` / `TeamName` pair so they cannot end up in some tables and not others.
  SVGs from `country-flag-icons`, imported **one country at a time** in
  `components/Flag.tsx`. Emoji flags were tried first and **do not render on Windows
  at all**. `import * as Flags` costs 240 kB — the namespace defeats tree-shaking and
  pulls in all ~250 flags for the twenty used — so the map is explicit, and
  `Flag.test.tsx` fails if the seed data grows a country it does not cover.
