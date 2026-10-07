# Roadmap

Read this before starting new feature work. The order matters more than the items,
because several create work for each other if taken out of sequence.

**Finished items are deleted rather than kept as trophies**, so this file reads as what
is left. What they turned into is documented where the code is — `.claude/rules/` — and
the questions they left open are in `docs/DECISIONS.md`. Other documents refer to items
here by *name*, never by number: the numbering is the order, and it shifts.

**Two tracks run at once.** *The authoring pass* is the author's own, under way, and the
top priority; *the build order* below it is the coding work, spined as **how a run feels**,
then **going live**, then **the shape of the seed data**, then **the alternate history**.
The three unbuilt modes in `apps/web/src/lib/modes.ts` are each turned on by the item of
that name: `edit-ratings` by the ratings editor, `era-advanced` by the driver market,
`game` by game mode.

## The authoring pass — season fine-tuning

All seventy-seven seasons are written, one JSON file each in
`packages/data/src/seasons/` (`.claude/rules/seed-data.md`). What is left is judgement,
not typing, and it is **the author's**: a session touches these numbers only when asked
for that era by name — the tuning invariant in `CLAUDE.md`.

- **Going backwards from 2026; everything down to 2005 is done.** Seventy-seven seasons
  were written far faster than they can be checked, so every rating is a first draft.
- **The far ends are the least trustworthy**, because they are least like the racing the
  model was built around: tiny fields, wild attrition, privateers and shared drives in
  the fifties and sixties; reliability and overtaking assumptions at the modern end that
  suit an early-eighties season better than a recent one.
- **Livery colours are part of this pass.** They are authored per *team era* in
  `teams.json` (`.claude/rules/team-eras.md`), and most teams still carry a single set of
  colours for their whole life, so a team that was repainted does not show it. Typing
  against reference photos, not a decision; nothing depends on it; it rides along with
  whichever era is being tuned. The mechanism — eras, the per-season override escape
  hatch, the badge — is built.
- **The seed-data-shape items below add authored fields to these same files** — career
  records, era numbers, per-round circuit blocks. They were meant to be folded into this
  pass; the pass started first, so they will be a second visit. Settling them together is
  still worth it: one extra pass rather than three.

---

## 1. Run settings

What-if settings chosen before a run, beside Randomness: career events, team names,
teams and seats (era only), and car performance, breakdowns, reliability and points (both
modes). **Designed in `docs/design/run-settings.md`**, with its own build order, one
session per step; its open questions live there.

Builds three of the advanced era's run settings early — the frozen grid, historical
careers, random car development — in `era-basic`, where the advanced era inherits them.

## 2. Phone layout

The app is built for a desktop window; a public site gets most of its traffic from a
phone held vertically. The grid, the classification and the standings are wide tables,
the session reveal assumes room beside the table, and the app shell's navigation and
breadcrumbs need a phone form of their own.

Detect by **viewport width via CSS media queries, not user-agent sniffing** — it handles
narrow desktop windows and tablets for free and keeps the decision in the stylesheet
rather than in a device list that ages. Per screen, choose deliberately between three
moves: **drop columns** that are context rather than content (gaps, grid position,
engine), with the full row on tap; **restack the row** into a card; or **let the table
scroll horizontally** inside its own container, which is the honest answer for a
classification where every column is a result. The **standings evolution charts** need
their own answer: a six-series legend and twenty-four round labels on a 360px axis is
not solved.

Cheaper before the editor adds more screens, and *publish it* is what makes it matter.
Styling and layout only; nothing about the model changes.

## 3. The in-app ratings editor

Turns on the `edit-ratings` card. **A player feature first**, not an authoring tool:
someone who disagrees that a driver was worth what the data says should be able to change
it and run their own what-if, in the browser. Drivers, teams/chassis, engines, and
circuits once *circuit character* lands. The grid editor already re-rates one season's
chassis for one run (`stepChassis`); this item is the editor that changes the data itself.

- **The driver editor shows that driver's whole career progression, as a table and a
  chart** — it *is* the screen, because a driver is a curve rather than a set of numbers
  for one year. Age along the bottom, ratings up the side, the authored peak marked. This
  is `pnpm progression` brought into the UI, on the charting groundwork in
  `StandingsEvolution.tsx` (`.claude/rules/web-charts.md`).
- **It edits the curve, not the year — decided.** A driver is a `peak` block plus a career
  shape (`peakSeasons`, `developmentSpeed`, `declineSpeed`, `stepDown`), and what the app
  shows for a year is *derived* by the ageing curve, so "make Piquet an 88 in 1982" has no
  direct representation in `drivers.json`. The editor therefore edits peak-and-curve and
  shows the derived rating for each season; it does not take a per-year edit and solve
  back to a curve. Teams, engines and circuits are authored per season already and have
  no equivalent problem.
- **Edits apply to the user's run and survive the sitting.** File-based export/import is
  the phase-1 form of local persistence (*stack for later phases*, below); Dexie/IndexedDB
  is later. An imported file is untrusted input — validate it. How a run on edited data
  is saved and shared is open (`docs/DECISIONS.md`).
- **Export in the authored seed format** — `drivers.json`, `teams.json`, `engines.json`,
  `seasons/<year>.json`, exactly as the repo writes them. This is the half that also
  serves the author, and it makes a user's tuning something that can be sent in as data.
  Always on or behind a flag is open.

## 4. Publish it

Put the app on the public internet, unfinished, and keep it there.

**Nothing in the code gates this — the author does.** It could ship today, and the
unfinished modes already render as greyed-out cards, which is the right way for a public
app to admit what it cannot do yet. What it waits on is the author being content with the
ratings: a wrong rating does not announce itself as unfinished, it reads as a wrong
opinion about a real driver. Hence its place after the editor that makes the ageing curve
judgeable — and **deliberately not after the whole authoring pass**, because waiting for
that means waiting for everything. Moving this item is how that call gets recorded. Four
parts, one release.

***The text pass.*** Every string on screen was written as its feature landed, and it
shows: too many words, and too much of the *design* explained to a reader who never asked
— why a setting is fixed before the run, what a rating mode is, how a table decided what
to count. A reader wants to know what they are looking at, not how it was built. Go
screen by screen and cut. The leads and panel copy on the setup screens (`SeasonPicker`
— the era lead is three sentences), the option details on `RandomnessSlider` and
`RatingModeToggle`, `RandomnessNote`, and the section descriptions on `CareerStatistics`
are where the prose is. What survives should be short, concrete, and about the racing.

***The About page.*** The footer already stubs the destination as a disabled `Pending`
button. What it carries: what the project is (an alternate history, not a prediction or a
re-creation); roughly how the model works, in a paragraph a non-programmer can read; that
the ratings are the author's opinions and mostly first drafts; the AI-collaboration credit
the footer already makes; where the historical data came from, with whatever attribution
that source requires; a link to the repository; and the unofficial/unaffiliated
disclaimer.

***The bug report page.*** The other stubbed destination. No backend, so nothing for a
form to post to. **A pre-filled GitHub issue link** — title and body as query parameters
— is the recommendation: no infrastructure, nothing to maintain, no one else's personal
data to handle, at the cost of the reporter needing an account. A `mailto:` publishes the
author's address to every scraper, permanently; a hosted form adds a dependency and
privacy obligations. Whichever it is, **the page's job is to make the report
reproducible**: pre-fill the seed, the season, the rating mode, the randomness level and
a build identifier, because a seeded simulation with those five facts reproduces exactly
and without them a bug report is a ghost story. The run's recipe
(`.claude/rules/web-persistence.md`) already holds all but the build identifier, which is
the reason to put a version stamp in the footer here.

***Going live.***

- **Hosting.** Any static host works. GitHub Pages needs no new account but serves a
  project site from a subpath, which means setting `base` in `apps/web/vite.config.ts`
  and a router that agrees, and deep links (`/run/…` answering with `index.html`) need a
  workaround there; Netlify or Cloudflare Pages avoid both. Pick one — moving
  later is an afternoon. A domain is optional: every host gives a free subdomain that can
  be replaced later. If buying one, **turn on WHOIS privacy** — without it, registration
  publishes the registrant's real name, address, phone and email.
- **CI before CD.** There is no `.github/` today. The workflow running `pnpm typecheck`,
  `pnpm lint` and `pnpm test` should exist *before* the one that deploys, or a broken
  `main` is a broken public site. `Test Files`, not just `Tests`.
- **Check the payload.** `packages/data/src/seasons/index.ts` globs all seventy-seven
  season files with `eager: true`, so the whole of the seed data is inlined into the main
  bundle. Measure it on a real build; dropping `eager` so years load on demand is the fix
  if it bites.
- **Security is mostly a non-problem, and it is worth knowing why.** No backend, no
  database, no accounts, no secrets, and nothing a user does leaves their browser — which
  removes essentially every category of web vulnerability there is. Do not spend effort
  defending against them. Three things do apply: **the repository goes public with the
  app**, `CLAUDE.md`, `docs/` and the commit history included, so confirm there is no
  `.env` and nothing personal in it and make that a decision rather than a discovery;
  **imported saves and edited names are untrusted input**, to be validated on load the way
  `validateSeedData()` validates the seeds, and safe in React as long as
  `dangerouslySetInnerHTML` never appears; and **analytics would create obligations** — a
  privacy notice, possibly a consent banner — where having none creates neither.
- **Names and marks are the real exposure.** Real drivers' and teams' names describing
  history is ordinary and fine; the championship's word marks and the teams' logos are not
  the author's to use, so keep them out. The livery badge is fine and deliberately so — a
  disc generated from authored colours, not a reproduction of anyone's mark. The line is a
  logo or a word mark, not a coloured shape. (A note to be careful, not legal advice.)
- **The licence is half-answered.** The repo is MIT, which covers the code; the authored
  season data may carry conditions from wherever it was sourced. Settle what it is
  licensed as and say so on the About page. Open.

## 5. Historical career records

When a run starts in 1980, Jones should already have his wins and Ferrari its titles, so
the first screen reads as a career in progress rather than everyone's debut — and the
simulated results add onto a real total as the era runs. Each season file carries, per
driver and per team, the **championships, wins, podiums and poles accumulated before that
season**.

- **An opening balance, not a running counter — and not a violation of "results are the
  source of truth".** Nothing before the starting year has results to derive from, so the
  balance is authored; everything the simulation produces is still derived from result
  rows, and a display total is the balance plus the derived one. Never write simulated
  results back into the balance.
- **It must cover people who are not on that season's grid** — mid-season replacements,
  one-off entries, drivers between seats. Keyed by driver and team id over everyone the
  era might surface, not over the entry list.
- **Only the starting year's balance is ever read** in a normal run; every later year
  comes from simulated results. Authoring all seventy-seven is what lets any year be a
  starting year.
- **Team totals follow team lineage** (`.claude/rules/team-eras.md`), or a rebadged
  team's roll-up lies.

Consumed by the era's champions screen, and later by anything wanting to say who the
established names are — the driver market included.

## 6. Seasonal factors

Numbers that are one global constant today but are really per-era, in the season file
where they belong. What is left is **the cosmetic qualifying and race gaps**: a 1955
field, a 1994 field and a 2015 field spread out very differently, and one scale serves
all of them today. Display-only — nothing in the model reads it. Setting it per year is a
measurement job, and this item is the authorisation the tuning invariant requires — for
*this* number, not for driver or car ratings, which a session leaves alone.

## 7. Circuit character

A round reaches the model as a `RoundContext` with one field, `country`, read only by
home advantage. Give circuits attributes and feed them in:

- **Engine-dependent versus downforce-dependent**, shifting the weight between the engine
  and chassis halves of the powertrain for that round — Monza is not Monaco.
- **How hard it is to overtake**, raising how much the qualifying result carries into the
  race. Somewhere like Monaco, the grid nearly is the classification.
- **How likely a wet race is here**, modulating the base rate: `RoundContext.wetChance`
  is already the seam, already read by the roll, and set by nothing.

A deep change to the score — the "changes what a rating means" caveat applies — and it
adds an authored block to every round of every season file, the largest of the
re-authoring passes.

## 8. Driver market

Transfers between seasons: what turns an era from a replay into an alternate history, and
what turns on the `era-advanced` card. **Designed in `docs/design/era-advanced.md`** —
the market, its in-season timeline, the run settings (careers, retirement, grid
evolution, car development), pre-season testing, and its own build order. Its open
questions live there, not in `docs/DECISIONS.md`.

Needs ageing and more than one season to move between, hence its place here. Leans on
*historical career records* for reputations and on the app shell
(`docs/design/app-shell.md`) for the next-season grid and the event feed. This is where the substitution point left clean in
the era loop gets used: the grid for year N+1 stops coming from that year's seed file and
starts coming from the market.

## 9. Game mode

The `game` card: take charge of a team, hire and fire drivers, choose development
directions, negotiate engine deals. Far future, and explicitly after a working
multi-season simulation — it is *era-advanced* seen from inside one team, so it needs
everything the market needs and a decision loop besides. Its notes — mini-games, what
the player may see, why its seasons simulate round by round — are in
`docs/design/era-advanced.md`.

## Someday: the Share link

A link that rebuilds a run on someone else's machine. A nice-to-have, not needed to
publish, and unscheduled. Designed in `docs/design/app-shell.md` §8; the reload recipe is
its starting point, and its format waits on *what a saved or shared run replays against*
(`docs/DECISIONS.md`).

## Stack for later phases

Decided, not installed: add these only when the phase that needs them arrives, and see
the phase rule in `CLAUDE.md` first.

- **Local persistence:** Dexie over IndexedDB, plus JSON export/import. The world state is
  already a plain serialisable object specifically so this is a small job.
- **Backend, only if and when needed, never in phase 1:** Hono + SQLite/Postgres + Drizzle.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (advanced era)
```
