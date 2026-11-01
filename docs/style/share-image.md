# The share image

A run's result as a portrait PNG that a player posts from their phone, the way Spotify
Wrapped is shared: two cards per mode. Like the other files here, this one is kept as the
reference a later tweak is checked against, not a plan. The rules that bind the code are
in `.claude/rules/web-share-card.md`.

**The mockup is `docs/style/share-image-mockup.html`**: open it in a browser. Its results
are invented; its cars, badges, flags and colours come from the app's own components and
authored liveries. The app has moved on from it where noted below.

## What holds for every card

- **One structure, top to bottom** (`ShareCardFrame`): a mono heading line ("My 1986",
  "16 rounds"); a lead sentence in the first person with its subject in teal; the subject;
  one ruled car band across the full width; the detail in panels; a footer reading "Make
  your own history at" and the address.
- **Always dark**, in the app's dark tokens, whatever the app's theme.
- **One diagonal sash runs the length of the card**, at the app's chequer angle, through
  the car band. Outside the band it is the app's chequer; inside, that team's car on a
  ribbon of its livery, as many colours as the badge shows: the primary in the middle,
  its accents either side, each edged with the badge hairline and chequered in white and
  black so the grid shows on any colour. The mockup ran it only across the band.
- **Every word, bar and badge sits on graphite**, so no livery can hide them.
- **A season is two digits over a bar in that year's team colours** (`SeasonMark`): "94"
  over Benetton blue, the bar a livery barcode stripe, the primary over the accents.
- **The car band fills the room the card leaves** above its panels, never below a floor,
  and the car is sized to it; its outline grows with it, at the large car's proportion.
- **The subject's surname shrinks its type to fit its line.**

## The era cards

- **Champion of champions**: "I replayed history and my champion of champions is…", then
  the name, the flag and the teams of their titles, the title count large and the seasons
  won; the car is their last title's. Below: the other champions, up to ten rows by
  titles, each with the flag, name, count and seasons; the rest in one sentence, names for
  each count of two or more and a number for the one-title champions; the Constructors'
  top three on one line at the panel's foot.
- **The last champions**: "I replayed history and these are my last 20 champions", then
  the newest champion's car. Below, newest first, up to twenty rows: the year, the flag,
  the name, which of their titles it was, and the team's badge and name for that year. An
  era no longer than the list reads "these are my champions".

## The season cards

- **World champion**: "I replayed 1986 and my world champion is…", then the name, the
  flag, the badge, the team and the wins, the points large with the margin to second, and
  the champion's car. Below: the championship's top three on stepped podium blocks, each
  with their car; the race winners round by round, the champion's wins in teal; the
  Constructors' top three on one line. A round is marked by its flag over the winner's
  badge and code, not the mockup's three-letter code, which the calendar doesn't carry.
  From the round count `WIDE_ROUNDS_FROM` on, the winners take more columns, so a modern
  calendar stays two rows.
- **Final standings**: "I replayed 1986 and this is how my championship finished", then
  the champion's car. Below, the Drivers' Championship: everyone who scored, up to twenty
  rows, with position, flag, name, team badge and name, wins (blank for none) and points.

## The dialog

Share sits beside the page's heading and opens that mode's two cards side by side, each
with Save under it. A phone shows one card at a time, swiped or stepped with the arrows
and dots at the footer's left, so neither card needs a scroll down.
