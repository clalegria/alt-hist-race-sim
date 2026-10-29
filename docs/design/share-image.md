# The share image

A portrait PNG of a run's result that a player posts from their phone, the way Spotify
Wrapped is shared. Two cards per mode; the player shares either or both.

**The mockup is `docs/design/share-image-mockup.html`**: open it in a browser. Its results
are invented; its cars, badges, flags and colours come from the app's own components and
authored liveries. Match its look, not its CSS.

## What is decided

- DECIDED: **1080×1920 PNG**, made in the browser from a card component laid out for that
  frame. No server, no save format.
- DECIDED: **always dark**, in the app's dark tokens, whatever the app's theme.
- DECIDED: **sent with the Web Share API** where it takes files, **downloaded** where not.
- DECIDED: **every card has the same structure**, top to bottom: a mono heading line ("My
  1986", "16 rounds"); a lead sentence in the first person with its subject in teal; the
  subject; one ruled car band across the full width; the detail in panels; then a footer
  reading "Make your own history at" and the address.
- DECIDED: **one diagonal sash runs the length of the card**, at the app's chequer angle,
  through the car band. Outside the band it is the app's chequer; inside, that team's car
  on a ribbon of its livery, as many colours as the badge shows: the primary in the
  middle, its accents either side, each edged with the badge hairline and chequered in
  white and black so the grid shows on any colour.
  Every word, bar and badge sits on graphite, so no livery can hide them.
- DECIDED: **a season is two digits over a bar in that year's team colours** ("94" over
  Benetton blue), read through the run's livery settings like every other colour.

### The era cards
- DECIDED: **Champion of champions.** "I replayed history and my champion of champions
  is…", then the name, the flag and the teams of their titles, the title count large, and
  the seasons won. The car is their last title's car. Below that:
  - **The other champions**: up to 10 rows, ordered by titles, with ties going to whoever
    won first. Each row has the flag, the name, the count and the seasons.
  - **The rest in one sentence**: names for each count of two or more, a number for the
    one-title champions.
  - **The Constructors' top three** on one line at the panel's foot.
- DECIDED: **The last champions.** "I replayed history and these are my last 20
  champions", then the newest champion's car. Below, newest first, up to 20 rows: the year,
  the flag, the name, which of their titles it was (none shown for a first), and the team's
  badge and name for that year. A shorter era lists every season.

### The season cards
- DECIDED: **World champion.** "I replayed 1986 and my world champion is…", then the
  name, the flag, the badge, the team and the wins, the points large with the margin to
  second, and the champion's car. Below that:
  - **The podium**: the championship's top three on stepped blocks, each with their car.
  - **The race winners**, round by round: each round's badge and the winner's
    abbreviation, with the champion's wins in teal.
  - **The Constructors' top three** on one line at the panel's foot.
- DECIDED: **Final standings.** "I replayed 1986 and this is how my championship
  finished", then the champion's car. Below, the Drivers' Championship: everyone who
  scored, up to 20 rows, with position, flag, name, team badge and name, wins (left blank
  for none) and points.

## What is left to settle

- PROPOSED: the address `race-sim.clalegria.dev`, provisional until *publish it* picks the
  host. One constant, so going live changes one line.
- PROPOSED: **the button**: a Share button on `SeasonOverview` and `EraChampions` opens a
  dialog showing that mode's two cards side by side, as in the mockup, with Share and Save
  for each, and a Share both where the browser takes two files.
- PROPOSED: **from 17 rounds** the race winners take 12 columns instead of 8, so a modern
  calendar stays two rows.
- PROPOSED: **a winner's abbreviation** is the first three letters of the surname, made
  unique within the season where two would match (the Schumachers, the Hills).
- OPEN: **when Share appears**: a season card only once the champion is decided, or a
  "so far" card mid-season too? An era card after its first crowned year, headed with the
  years crowned so far?
- OPEN: **the run's settings and seed** were on the first mockup and are not on the
  chosen cards. Leave them off, or add them in small print at the foot?
- OPEN: once *historical career records* exist, do the era cards count titles from before
  the start year, or only the run's?

## The build, in order

Each step lands with its tests and leaves the app working. The shape and the order are
PROPOSED: confirm before step 1.

1. **The card data** (`lib/share-card.ts`): pure functions from the run to what each card
   shows. Build on `eraChampions` (it already numbers each champion's titles) and the
   engine's standings. Cover the edge cases: an era of one season, no one with two titles,
   ties, a season with no wins for the runner-up, more than 20 scorers. Unit tests on
   shapes and rules, never on a seeded outcome (`testing.md`).
2. **The card frame**: one component at a fixed 1080×1920 with the parts every card
   shares (heading line, lead, subject, car band, panel, footer), in the dark tokens
   whatever the theme. Long surnames use `FittedName`. The car band reuses `LiveryCar`.
   The year bars, badges, flags and position blocks reuse their app components or owners.
3. **The four cards** on that frame, each smoke-rendered with a real season and a short
   era.
4. **The preview dialog** and the Share button on both pages, with the cards scaled to
   fit (the mockup's `transform: scale` approach). Behaviour tested at store level.
5. **The PNG**: one small dependency (`html-to-image` or a fork of it) renders the card
   off-screen at 1:1. Its traps: the fonts must be embedded from the app's own
   `@fontsource` files or the PNG falls back to system fonts, and Safari can drop images
   and fonts on the first render, so render twice there. Make the image on tap, not when
   the dialog opens.
6. **Share or save**: `navigator.canShare({ files })` decides. If it says yes, send the PNG
   through `navigator.share`; if not, save it from an object URL. The file is named after
   the run, such as `my-1986.png`.
7. **Look and docs**: a `pnpm screenshots` step per card, checked by `screenshot-checker`;
   move the rules into a `web-share-card.md` rule file; delete this doc and its mockup when
   nothing is left.
