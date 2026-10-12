---
paths:
  - "apps/web/**"
---

# Web app

`apps/web`: React + Vite, Tailwind 4, Zustand, TanStack Router. Rules for the whole app;
each subsystem's are in the `web-*` file scoped to its code.

- **shadcn/ui is copied into `components/ui/`, not a dependency**: edit it there. The
  Radix primitives it wraps are real dependencies (`@radix-ui/react-*`).
- **The URL says which page; the store holds the run.** Nothing writes the store into
  the URL (`web-routing.md`).
- **A season is simulated whole the moment its seed is drawn**, one RNG stream through
  every round; the cursor only reveals it. Never simulate a beat at a time.
- **Nothing rewinds the cursor.** A restart is a new seed back at the grid; Back moves
  between pages, never through time.
- **A new kind of beat** (a market event, a decision) is a row in `lib/timeline.ts`, a
  page in `lib/run-places.ts` and a line in `describeBeat`, not a new screen flow.
- **An era is the season flow with an `EraRun` beside it**: the same beats, pages and
  store actions, written once for both. Never fork one per mode; `SeasonPage`'s
  optional `run` is the whole difference.
- **`nextEraWorld` is the seam `era-advanced` replaces** (what is handed to
  `createWorld` for the next year). Keep it the one step Continue and a jump share.
- **Never write a year down.** Which years exist is `authoredSeasons` (`@alt-hist/data`);
  `lib/seasons.ts` only holds the range the picker draws, and `nextEraYear` and
  `adjacentSeason` walk what is authored. `seasonSeed` throws on an unauthored year:
  never fall back.
- **No component reads a season fixed at import time**: round names and calendars come
  from the world's own year (`seasonSeed(world.year)`). 1981 renders fine with 1980's
  names, so only `seasons.smoke.test.tsx` catches it.
