---
paths:
  - "apps/web/src/lib/share-card.ts"
  - "apps/web/src/lib/share-card.test.ts"
  - "apps/web/src/lib/share-png.ts"
  - "apps/web/src/lib/share-png.test.ts"
  - "apps/web/src/components/ShareCard.tsx"
  - "apps/web/src/components/share-card.test.tsx"
  - "apps/web/src/components/ShareCards.tsx"
  - "apps/web/src/components/share-cards.test.tsx"
  - "apps/web/src/components/ShareDialog.tsx"
  - "apps/web/src/components/share-dialog.test.tsx"
---

# The share cards

A run's result as portrait PNGs, two cards per mode, saved or sent from the Share dialog.
How they look, and the mockup they came from: `docs/style/share-image.md`.

## The data
- **`lib/share-card.ts` decides what a card shows**: who is listed, in what order, what is
  cut. The components only lay it out; a rule about ties or cuts is tested there.
- **Ids and years, never names or colours.** Every team travels with the year it is drawn
  for and is named and painted through the run's kept-names and kept-liveries contexts,
  as on every other screen.
- **Only finished seasons.** Share appears once the cursor reaches a season's end, never
  mid-season even with the title settled: a season's cards on its summary, in an era too;
  an era's on its champions page, covering every year up to that one.
- **Ties**: the other champions by titles, a tie to whoever won first. A team renamed
  between a champion's titles reads as one, its names at those titles joined.
- **A winner's code** is the surname's first three letters; drivers in one season who
  would share one take the given name's initial and the surname's first two (`driverCodes`).
- **Wording follows the data**: "last N champions" only for an era longer than the list;
  "Level with" for a title on countback; a first title shows no ordinal.
- **No seed on any card.** The address is `SHARE_ADDRESS`, so going live changes one line.

## The frame
- **Every card is laid out on `ShareCardFrame`**, which owns the structure and the sash;
  a card fills its slots, never draws its own band or footer.
- **Pixels, not rems**: a fixed-size picture must not move with the reader's text size.
- **Always dark**: `.share-card` (`index.css`) resets every colour token on the card, so
  the app's utilities read dark inside it. Never read the theme in a card.
- **Every year is the card's own**: never the `Liveries` context's year. Each badge, bar
  and car is handed its year and read through `useLiveryYear`.
- **Every list fits at its longest** with the car band at its floor; a shorter list hands
  the band the room. Raising a list's cap means re-checking the card at that length.
- **A surname standing alone shrinks to fit (`FitToWidth`)**; `FittedName` only shortens a
  given name, so it serves the rows.

## The PNG and the dialog
- **The PNG is drawn from the dialog's own card**, never a second copy: the preview's
  scale is a transform on the box around the card, so the card stays laid out at 1:1.
- **Fonts are embedded from the app's own `@fontsource` CSS**: the SVG image may fetch
  nothing, so a face not inlined falls back to a system font.
- **WebKit draws twice** (`rendersTwice`): the first draw can leave out fonts and images.
- **Share only where `navigator.canShare({ files })` says yes**, Share both only where it
  takes two files; Save downloads everywhere. A cancelled share is not an error.
- **A phone shows one card at a time**: scroll snapping below `sm`, a grid from `sm` up,
  on the same markup, so only a media query chooses.
