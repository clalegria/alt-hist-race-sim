# The share image

A portrait PNG of a run's result that a player posts from their phone, the way Spotify
Wrapped is shared. Two cards per mode; the player shares either or both.

**The mockup is `docs/design/share-image-mockup.html`**: open it in a browser. Its results
are invented; its cars, badges, flags and colours come from the app's own components and
authored liveries. Match its look, not its CSS.

## What is decided

The card data, its abbreviations and its tie rules are built: `lib/share-card.ts`. The
frame and its shared parts are built: `components/ShareCard.tsx`. The four cards are
built: `components/ShareCards.tsx`. Share and its dialog are built: `components/ShareDialog.tsx`
(`pnpm screenshots share-season share-era`). The PNG, Save and Share are built: `lib/share-png.ts`.

- DECIDED: **the PNG is drawn from the dialog's own card**, not a second copy: the
  preview's scale is a transform on the box around it, so the card is laid out at 1:1.

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
  Benetton blue), read through the run's livery settings like every other colour. The bar
  is a livery barcode stripe: the primary over the badge's accents.
- DECIDED: **the car band fills the room the card leaves** above its panels, never below a
  floor, and the car is sized to it; its outline grows with it, at the large car's
  proportion.
- DECIDED: **the subject's surname shrinks its type to fit its line.** `FittedName` only
  shortens a given name, so it serves the rows, not a surname standing alone.

### The era cards
- DECIDED: **Champion of champions.** "I replayed history and my champion of champions
  is…", then the name, the flag and the teams of their titles, the title count large, and
  the seasons won. A team renamed between their titles reads as one, its names at those
  titles joined: "Titles with Brawn/Mercedes and McLaren". The car is their last title's car. Below that:
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

- DECIDED: **the address is `race-sim.clalegria.dev`** until *publish it* picks the host.
  One constant, so going live changes one line.
- DECIDED: **from 17 rounds** the race winners take 12 columns instead of 8, so a modern
  calendar stays two rows.
- DECIDED: **a winner's abbreviation** is the first three letters of the surname. Drivers
  in one season who would share one take their given name's initial and the surname's
  first two letters instead: Michael and Ralf Schumacher are `MSC` and `RSC`.
- DECIDED: **Share appears only once the cursor reaches the end of a season**, never
  mid-season, even with the title settled. The season's cards are offered on its summary,
  in an era too; the era's on its champions page, covering every year up to that one.
- DECIDED: **no seed on any card.**
- DECIDED: **Share sits beside the page's heading** and opens a dialog of that mode's two
  cards, side by side, each with Save. Share on a card only where
  `navigator.canShare({ files })` says yes; Share both only where it takes two files.
- DECIDED: **a phone shows one card at a time**: swiped, or stepped with the arrows and
  dots at the footer's left, so neither card needs a scroll down.
- DECIDED: **a PNG is named after the run and the card**: `my-1986-world-champion.png`.

## What is left to settle

- PROPOSED: **a round is marked by its flag** over the winner's badge and code, not the
  mockup's three-letter code, which the calendar doesn't carry.
- PROPOSED: **an era no longer than its list** reads "these are my champions", not "my
  last 20"; **a title on countback** reads "Level with Prost", not "0 clear of Prost".
- OPEN: **the run's settings** in small print at the foot: worth having, but how, with so
  many combinations?
- OPEN: once *historical career records* exist, do the era cards count titles from before
  the start year, or only the run's? Until then, only the run's.

## The build, in order

Each step lands with its tests and leaves the app working. DECIDED.

6. **Look and docs**: a last look at each card through `screenshot-checker`; move the
   rules into a `web-share-card.md` rule file; delete this doc and its mockup when nothing
   is left.
