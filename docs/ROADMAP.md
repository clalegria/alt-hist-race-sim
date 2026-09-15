# Roadmap

Read this before starting new feature work. Ordered, with the reasoning — the order
matters more than the items, because several of these create work for each other if
taken out of sequence. Deviate deliberately, not by accident.

**Finished items are deleted rather than kept as trophies**, so this file always reads
as what is left to do. What they turned into is documented where the code is — the
subsystem rules in `.claude/rules/` — and the open questions they left behind are in
`docs/DECISIONS.md`. Other documents therefore refer to items here by *name*, never by
number: the numbering is the order, and it shifts every time something lands.

The spine of the order: **the multi-season shell first** — now built — then **how a run
feels**, then **going live**, then **the shape of the seed data**, then **the alternate
history**. Publishing sits in the middle rather than at either end: nothing in the code
gates it, but **the author does** — see that item. The seed-data-shape items follow as a
block: each adds a field to all seventy-seven files, so they are settled together and
paid for in one authoring pass.

`apps/web/src/lib/modes.ts` lists the five modes the finished app is meant to offer —
`season` and `era-basic` (both shipped), `era-advanced`, `game`, `edit-ratings`. That
list is the destination; this file is the route. Roughly: *the in-app ratings editor*
turns on `edit-ratings`, *driver market* turns on `era-advanced`, and *game mode* turns
on the last one.


**1. Phone layout.** The app is built for a desktop window; a public site gets most of
its traffic from a phone held vertically. Several screens do not survive that — the
grid, the results classification and the standings are wide tables, and the session
reveal assumes room beside the table.

Detect by **viewport width via CSS media queries, not by user-agent sniffing** — that is
the practice, it handles narrow desktop windows and tablets for free, and it keeps the
decision in the stylesheet rather than in a device list that ages. Per screen, choose
deliberately between three moves: **drop columns** that are context rather than content
(gaps, grid position, engine), with the full row available on tap; **restack the row**
into a card so the same facts read vertically; or **let the table scroll horizontally**
inside its own container, which is the honest answer for a classification where every
column is a result. The **standings evolution charts** on the season summary need their
own answer too: the legend is already below the plot rather than beside it, but a
six-series legend and twenty-four round labels on a 360px-wide axis are not solved.

Ordered here because it is cheaper before the editor adds more screens, and because
*publish it* is what makes it matter. Nothing about the model changes; this is styling
and layout only.

**2. The in-app ratings editor.** Turn on the `edit-ratings` card. **This is a player
feature first**, not an authoring tool: someone who disagrees that a driver was worth
what the data says should be able to change it and run their own what-if, in the
browser, without touching a JSON file. Editing drivers, teams/chassis, engines and
(once *circuit character* lands below) circuits.

- **The driver editor shows that driver's whole career progression, as a table and as a
  chart.** Not a nice-to-have — it is the screen, because a driver is not a set of
  numbers for one year but a curve, and editing the curve blind is not usable. Age along
  the bottom, the ratings up the side, the authored peak marked. This is `pnpm
  progression` brought into the UI, on the charting groundwork the standings evolution
  charts laid down — Recharts, the theming, and how a series takes a livery colour are
  all settled in `apps/web/src/components/StandingsEvolution.tsx`.
- **The hard part is that ratings are not authored per season.** A driver is a `peak`
  block plus a career shape (`peakSeasons`, `developmentSpeed`, `declineSpeed`,
  `stepDown`), and what the app displays for a given year is *derived* from those by
  the ageing curve. So "make Piquet an 88 in 1982" has no direct representation in
  `drivers.json`. Either the editor edits peak-and-curve directly and shows the derived
  year (honest, but asks the user to think in careers), or it accepts a per-year edit
  and solves back to a curve that produces it (friendlier, sometimes impossible).
  **Decide this before writing the export**, and record it in `docs/DECISIONS.md` — it
  determines what the editor's main screen even is. Teams, engines and circuits have no
  equivalent problem: those ratings are authored per season already.
- **Edits apply to the user's run and survive the sitting.** File-based export/import of
  a save is the phase-1 form of the local persistence decided in `docs/DECISIONS.md`;
  Dexie/IndexedDB remains the later phase. The world state and the seed are already
  plain serialisable objects specifically so this is a small job. An imported file is
  untrusted input — validate it, per *publish it* below.
- **Export in the authored seed format — `drivers.json`, `teams.json`, `engines.json`,
  `seasons/<year>.json`, shaped exactly as the repo writes them.** This is the half that
  also serves the author: it makes the editor an alternative to hand-editing seed files,
  and a user's tuning can be sent in as data. Whether it is always on or behind a flag
  is open.

**3. Publish it.** Put the app on the public internet, unfinished, and keep it there.
The author has never shipped anything before, so this item is written as much to say
what is *not* a problem as what is.

**Nothing in the code gates this — the author does.** It could technically ship today,
and the unfinished modes already render as greyed-out cards, which is exactly the right
way for a public app to admit what it cannot do yet. What it is waiting on is the author
being content with the ratings, which he is not: a wrong rating does not announce itself
as unfinished — it just reads as a wrong opinion about a real driver.

That is why it sits after the editor that makes the ageing curve judgeable — the single
biggest lever on how right the ratings feel is the authoring pass they need. **It
is deliberately not placed after *season fine-tuning***, the era-by-era pass at the far
end of this file: waiting for that means waiting for the whole roadmap, and the intent
is to publish long before the project is finished. Somewhere between those two is the
author's call, and moving this item is how that call gets recorded.

Once it lands the cost is paid once and everything below goes live as it lands. Three
parts, because they are one release.

***The About page.*** The footer already has the destination stubbed as a disabled
`Pending` button. What it should carry: what the project is (an alternate history, not a
prediction or a re-creation — it starts from a real season and diverges); roughly how
the model works, in a paragraph a non-programmer can read; that the ratings are the
author's opinions and mostly first drafts; the AI-collaboration credit the footer
already makes; where the historical data came from, with whatever attribution that
source requires; a link to the GitHub repository; and the disclaimer described under
*going live* below.

***The bug report page.*** The other stubbed footer destination. Phase 1 has no backend,
so there is nowhere for a form to post to. Three options, and they are not equal:

- **A pre-filled GitHub issue link** — a URL with the title and body as query
  parameters. No infrastructure, nothing to maintain, and the author handles no one
  else's personal data. Costs the reporter a GitHub account. **This is the
  recommendation.**
- **A `mailto:` link** — simplest, but publishes the author's email address to every
  scraper that reads the page, permanently.
- **A hosted form service** — friendliest to the reporter, but it adds a dependency, and
  collecting strangers' text and email addresses creates privacy obligations that did
  not exist before.

Whichever it is, **the page's real job is to make the report reproducible**: pre-fill the
seed, the season, the rating mode, the randomness level, and a build
identifier, because a seeded simulation with those five facts reproduces exactly and
without them a bug report is a ghost story. That build identifier is a reason to put a
version stamp in the footer as part of this item.

***Going live.*** The deployment and the readiness pass.

- **Hosting.** A static site with no backend, so any static host works. The repo is
  already on GitHub, so GitHub Pages needs no new account — but a project site is served
  from a subpath, which means setting `base` in `apps/web/vite.config.ts` and a router
  that agrees with it. Netlify or Cloudflare Pages avoid the subpath problem and deploy
  from the same repo. Pick one and do not agonise; moving later is an afternoon.
- **A domain name is optional, and is not a blocker.** Every static host hands out a
  free subdomain, which works completely and can be replaced later without rebuilding
  anything. When buying: it is an annual rent rather than a purchase, so it lapses if
  the renewal is missed; the registrar sells the name and the host serves the site, and
  the two are connected by pointing the domain's DNS at the host. **Turn on the
  registrar's WHOIS privacy** — without masking, registration publishes the registrant's
  real name, postal address, phone number and email for anyone to look up. Most
  registrars include it free; some charge, which is a reason to pick a different one.
- **Continuous integration first.** There is no `.github/` directory today. Deploying on
  every push without gates means a broken `main` is a broken public site, so the workflow
  that runs `pnpm typecheck`, `pnpm lint` and `pnpm test` should exist *before* the one
  that deploys. `Test Files`, not just `Tests`, per the convention in `CLAUDE.md`.
- **Check the payload.** `packages/data/src/seasons/index.ts` globs all seventy-seven
  season files with `eager: true`, so the whole of the seed data — over half a megabyte
  of JSON before compression — is inlined into the main bundle. That is survivable but
  it is the first thing to measure on a real build, and dropping `eager` so years load
  on demand is the obvious fix if it bites.
- **Nothing here is a security problem, and it is worth knowing why.** No backend, no
  database, no accounts, no sessions, no secrets, and nothing a user does leaves their
  browser. That removes essentially every category of web vulnerability there is — there
  is no server to attack, no data of anyone's to breach, and no credentials to steal. Do
  not spend effort defending against those.
- **What actually applies is smaller and different.** Four things:
  1. **Publishing makes the whole repository public, not just the app.** If the repo is
     public so are `CLAUDE.md`, `docs/`, `.claude/rules/` and the commit history. That
     is probably fine and arguably good, but it should be a decision rather than a
     discovery. Confirm there is no `.env` and nothing personal in the history first.
  2. **Names and trademarks are the real exposure.** Using real drivers' and teams'
     names to describe history is ordinary and fine. The championship's word marks and
     the teams' logos are not the author's to use, so do not put them in the app. The
     livery badge is fine and deliberately so: it is a disc generated from three authored
     colours, not a reproduction of anyone's mark. The line not to cross is a real logo
     or word mark, not a coloured shape. Add a plain line to the About page
     saying the project is unofficial, unaffiliated with and unendorsed by anyone, and
     is a work of alternate history. This is a note to be careful, not legal advice.
  3. **User-supplied text arrives with the editor.** Once someone can rename a team, the
     app renders a string a person typed. React escapes by default, so this is safe as
     long as `dangerouslySetInnerHTML` never appears — and imported save files are
     untrusted input that must be validated on load, the way `validateSeedData()`
     already validates the seeds, never trusted or evaluated.
  4. **Analytics are the one thing that would create obligations.** A tracker means a
     privacy notice and possibly a consent banner. Not adding one means neither. Prefer
     none, or a cookieless one, and decide deliberately.
- **The licence question is half-answered.** The repo is MIT, which covers the code. The
  authored season data is a different kind of thing and may carry conditions from
  wherever it was sourced. Settle what the data is licensed as, and say so on the About
  page. Open.

---

*The next three items are the seed-data-shape block.* Each adds an authored field to all
seventy-seven season files — career records, era numbers, per-round circuit blocks.
**Settle them together and make one authoring pass**, in *season fine-tuning* below,
rather than three passes over the same files. Liveries, team lineage and the wet ratings
were the others and are done, so they can join that pass without holding it up.

**4. Historical career records.** When a run starts in 1980, Jones should already have
his previous wins and Ferrari its previous titles, so the first screen reads as a career
in progress rather than everyone's debut — and so the simulated results add onto a real
total as the era runs.

Each season file carries, per driver and per team, the **championships, wins, podiums
and poles accumulated *before* that season**. Four points about the shape:

- **It is an opening balance, not a running counter, and this does not violate "results
  are the source of truth".** Nothing before the starting year has results to derive
  from, so the balance is authored; everything the simulation produces is still derived
  from result rows, and the display total is the authored opening balance plus the
  derived one. Never write simulated results back into the balance.
- **It must cover people who are not on that season's grid.** Mid-season replacements,
  one-off entries and drivers between seats still have histories, and a driver who
  appears in 1982 needs the record he brought with him. So the block is keyed by driver
  and team id over *everyone the era might surface*, not over the entry list.
- **Only the starting year's balance is ever read** in a normal run — every later year's
  totals come from simulated results. Authoring it in all seventy-seven files is what
  lets any year be a starting year.
- **Team totals depend on team lineage**, which is already built
  (`.claude/rules/team-eras.md`): a rebadged team's history has to follow it across the
  rename or the roll-up lies.

Consumed by *simulate an era*'s champions screen, and later by anything that wants to
say who the established names are — including the driver market.

**5. Seasonal factors.** Several numbers that are one global constant today are really
per-era, and the season file is where they belong. One item, because it is one change to
`SeasonSeed` and one authoring pass per year:

- ~~**Retirement rate per season.**~~ **Done.** Every season file carries a 1-10
  `retirementFactor` (5 = the constants untouched), scaling both DNF rolls, answered per
  year against the real classification of that championship. `pnpm retirements --sweep`
  is the harness; `.claude/rules/retirement-factor.md` is the write-up, including the
  finding that the authored reliability ratings carry far less of the era than expected.
- **The cosmetic qualifying and race gaps** shown in the UI, per season. A 1955 field, a
  1994 field and a 2015 field spread out very differently, and today one scale serves
  all of them. Display-only — nothing in the model reads it.
- **The starting limit.** `maxStarters` is pinned at 26; real 1981 took 24, and the
  number moves across eras. Folding it in here means one decision about where era
  numbers live rather than three.

Setting these per year is a measurement job, and the author asking for it here is the
authorisation the tuning invariant requires — for *these* numbers, not for driver or car
ratings, which a session leaves alone. The retirement rate has been through it; the gaps
and the starting limit have not.

**6. Circuit character.** Today a round reaches the model as a `RoundContext` with one
field, `country`, read only by home advantage. Give circuits attributes and feed them in:

- **Engine-dependent versus downforce-dependent**, shifting the weight between the
  engine and chassis halves of the powertrain for that round — Monza is not Monaco.
- **How hard it is to overtake**, which raises how much the qualifying result carries
  into the race result. Somewhere like Monaco, the grid nearly is the classification.
- **How likely a wet race is here**, modulating the base rate from *wet racing*, which
  has landed: `RoundContext.wetChance` is already the seam, already read by the roll, and
  set by nothing.

Also a deep change to the score, with the same "changes what a rating means" caveat, and it adds a per-round
authored block to every round of every season file — the largest of the re-authoring
passes, and the last piece the single pass below is waiting on.

**7. Season fine-tuning.** The writing is done: **every season from 1950 to 2026 is
authored** — one JSON file each in `packages/data/src/seasons/`, discovered by that
folder's `index.ts` (see `.claude/rules/seed-data.md`). What is left is judgement, not
typing.

- **This is where the single authoring pass for the block above is made** — career
  records, era numbers, per-round circuit blocks — which is why those are settled first
  and paid for once. **Wet ratings are already written**, all 450 of them: a formula off
  `racing` and `qualifying` with a hand-written delta for the drivers the sport remembers
  one way or the other. They are a first draft like every other rating and belong in the
  era-by-era pass below. Liveries are in the same pass but not
  waiting on anything: their format is already settled, so they can be written for any
  year at any time.
- **The ratings are first drafts.** Seventy-seven seasons were written far faster than
  they can be checked. Going back over them era by era — against `pnpm calibrate-season`,
  in the editor — is the author's own job, and the tuning invariant means a session
  touches these numbers only when asked for that era by name.
- **The far ends are the least trustworthy**, because they are the least like the racing
  the model was built around: tiny fields, wild attrition, privateers and shared drives
  in the 1950s and 1960s; and at the modern end, reliability and overtaking assumptions
  that suit an early-eighties season better than a recent one.
- **Liveries are authored for almost no season yet.** The feature itself is built — every
  team carries a default in `teams.json`, any season may override it per entry, and the
  UI draws both (`.claude/rules/web-display.md`). What is missing is the *writing*: only
  1991 has season overrides, so every other year falls back to one set of colours per
  team and a team that changed livery between seasons does not show it. Worth doing for
  the modern seasons first, where a reader is most likely to notice — but it is typing
  against reference photos, not a decision, and nothing depends on it.

**8. Driver market.** Transfers between seasons — what turns *simulate an era* from a
replay into an alternate history, and what turns on the `era-advanced` card. Needs
ageing (who is declining, who retires) and more than one season to move between, hence
its place here. What forces move the market is not yet decided — a design conversation,
not a coding task — and `adaptability` is authored and unused precisely for this. Team
lineage was a prerequisite for that conversation — a market cannot reason about a team's
standing across years while a rename looks like a disappearance — and is now built;
*historical career records* give it the reputations to reason about.

This is where the substitution point left clean in *simulate an era* gets used: the grid
for year N+1 stops coming from that year's seed file and starts coming from the market.

**9. Game mode.** The `game` card: take charge of a team, hire and fire drivers, choose
development directions, negotiate engine deals. Far future, and explicitly after a
working multi-season simulation — it is *era-advanced* seen from inside one team, so it
needs everything the market needs and a decision loop besides.

Car progression lives here rather than as a mode of its own. The
`SeasonProgressionModel` seam in the glossary has two implementations:
`HistoricalProgression`, which after *simulate an era* is just "read the next season
file", and `EvolutionaryProgression` (random walk + mean reversion), which is what makes
cars drift from real history. Only the second is real work, and it is a **submode inside
this mode and `era-advanced`**, not a card on the menu. Build the interface when that
second implementation lands, not before.

Engines make this bigger than it was: a career needs engine *deals* to move as well as
cars to develop, and `SeasonProgressionModel` has no `nextSeasonEngines()`. Whether a
supplier relationship is something the market moves, something progression rolls, or
something this mode chooses is undecided. Nothing should be designed around this yet.

## Directories these will create

```
packages/engine/src/market/       # driver transfers, for the driver market
packages/engine/src/progression/  # ageing (done), car development (game mode)
```
