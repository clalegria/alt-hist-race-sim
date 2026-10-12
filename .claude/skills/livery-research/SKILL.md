---
name: livery-research
description: Research a team's real car liveries from photos and turn them into livery eras in packages/data/src/teams.json — finds period photos (Openverse: Flickr and Wikimedia Commons, free, no key), extracts the primary colour and two accents, decides how many badge stripes the livery really carries, merges near-identical seasons into eras, and checks every same-season grid for twin badges and colour clashes before proposing anything. Use this whenever the user wants a team's colours, livery, badge or car colours made more accurate, corrected, researched or filled in — for one season ("the 1985 Brabham"), a span ("Williams from 2010 back to 1990"), a whole team history, or a whole grid — and whenever they ask what a team's car looked like in a given year for the purpose of the data, even if they don't say "livery".
---

# Livery research

Turn photos of real cars into `LiveryEra` rows for one team, so the badge the app draws
reads as that team's car — and never as another car on the same grid.

A livery here is four values: `primaryColor`, `secondaryColor1`, `secondaryColor2`
(`#RRGGBB`) and `badgeStripes` (0, 1 or 2). The badge is a disc in the primary with a
diagonal sash: 1 stripe draws `secondaryColor1`, 2 draw both accents side by side. Eras
are `{ from, ...livery }`, sorted, each running until the next — see
`LiveryEra` in `packages/data/src/types.ts` for the model and why it is coarse on purpose.

## Working with the user

The author knows F1 history well and has used this workflow before; don't make them
re-explain it.

- **Their corrections are facts.** "1979 is the same as 1978" or "that car was solid
  red" overrides any photo you found. Apply it, re-run `check`, and move on — don't
  re-argue from the photo pool.
- **They may send photos**, often a Google Images or Pinterest URL. `fetch` it, read the
  colours off it like any other photo, and treat it as authoritative for that season.
- **Big spans go in chunks** — a decade, or a run of related eras — in whatever order
  they ask ("from the last season backwards to 1990"). Propose a chunk, wait, and when
  they approve all or part of it, **apply the approved part straight away** before
  researching the next chunk. Don't hold approved work back for one big write at the end.
- **Keep them posted.** Research runs are long: a one-line note of what you're on
  between batches of tool calls ("reading colours off the 1994 photos").
- **Free tools only.** No paid APIs or API keys; the author has turned them down. If the
  free search comes up empty for a season, ask them for a photo.
- **Don't run the test suite** for a livery change, and don't commit unless asked.
- When they say a team is done, it's done: don't reopen its eras unprompted, and add it
  to [PROGRESS.md](PROGRESS.md) in the same piece of work.

## The tools

Run from the repo root. Put downloaded images and plans in the session scratchpad if one
is listed, otherwise a temp directory. **Badge sheets go in
`.claude/skills/livery-research/out/`** (gitignored), because the user can't open the
scratchpad; name them `<team>-<years>.png`. Images need Pillow
(`pip install --user Pillow`).

```
S=.claude/skills/livery-research/scripts
python $S/livery.py find <name> [--year Y]    # name -> team id (ids are the lineage's FIRST name)
python $S/livery.py show <team>               # names + livery eras, flags near-duplicate eras
python $S/livery.py grid <year>               # every team on that grid, with its livery
python $S/livery.py export <team> --out P     # current eras as an editable plan file
python $S/livery.py check --plan P [--years A-B]  # twins, clashes, near-duplicates, palette reuse
python $S/livery.py probe <team> <A-B> <hex>...   # nearest same-grid primaries for candidates
python $S/livery.py palette --near <hex>      # hexes already used in teams.json
python $S/livery.py sheet --plan P [--years A-B] --out X.png   # badge sheet, as the app draws it
python $S/livery.py apply P                   # validate and write the plan into teams.json
python $S/images.py search "<query>" --out DIR    # downloads hits + DIR/contact.png
python $S/images.py fetch <url> --out DIR     # one image from a direct URL
python $S/images.py grid <img> [--n 20]       # copy with a labelled NxN grid (default 10)
python $S/images.py colors <img> --box C0,R0,C1,R1 [--n 20] [--neutral C0,R0,C1,R1]
```

A **plan** is the team's complete era list as JSON. Start from `export`; extra keys on an
era (`"source"`, `"note"`) are yours for the proposal and are dropped by `apply`.

`search` uses **Openverse** — openly licensed images from Flickr (many scanned period
photos) and Wikimedia Commons. `--source commons` searches Commons alone. Both
rate-limit anonymous use; search for what you need rather than sweeping.

**StatsF1** (statsf1.com) has good period photos, one page per chassis, e.g.
`https://www.statsf1.com/en/eurobrun-er189b.aspx`, but it is the **last resort**: it
blocks readily, even the author's own browser. Only when Openverse, Commons and the
author have nothing, ask the author whether it's worth using for that one season.
It refuses scripted clients, so never fetch its pages, never retry, and never fake a
browser user agent. If the author agrees, give them the chassis page URL; they may send
a photo, which you use like any other photo they send.

## Workflow

### 1. Scope

Read [PROGRESS.md](PROGRESS.md) first: a team listed there is signed off. Resolve the team id with `find` — the modern Aston Martin is `jordan`, Red Bull is
`stewart`, Alpine is `toleman`. Run `show` to see the current eras and the name in force
each year: you search with the name *of that year*. A request for "the 1985 grid" means
every team in `grid 1985`, one after another.

### 2. Knowledge first, photos where it's thin

Photo research is the slow part, so spend it where it changes the answer. From what you
know of the team, write down its eras — title sponsors, rebrands, new owners — and mark
each **sure** or **unsure**. A famous, long-running look (Marlboro McLaren, JPS Lotus) is
sure: one confirming search, only to read the colours off. Photograph the unsure ones:
two good photos inside the era, and the seasons either side of a boundary you doubt.
Never search season by season through a history you already know.

### 3. Photos

**Search by chassis name first** (`"Brabham BT52"`, `"Williams FW14"`): that's how
Flickr and Commons titles are written, and year-plus-team queries mostly return junk.
Then a driver and race (`"Piquet 1983 Brands Hatch"`). Run all the searches for a chunk
**in one shell command**, each into its own folder, then view each folder's
`contact.png` — one look per search. Open a photo full-size only to read colours off it.

**Check every photo before trusting it.** Skip unrelated hits (the search is keyword
matching: expect aircraft, sculptures, buildings) and discard:
- historic demos, museum and show cars, restorations — often repainted, or in another
  season's livery than the title says;
- scale models, die-casts and radio-controlled models, which Flickr is full of;
- launch cars and one-race specials (a tobacco-ban race, a charity livery) — the data
  wants what the car wore most of the season;
- black-and-white photos, and anything too small or blurred to see the paint.

Most photos you find of pre-1995 cars will be demos and museum cars. They are usable as
evidence of the look, not of the exact season: **a single source is a guess, however
authoritative it looks.** Photos from one race (a non-championship event, a test
livery), a museum's label on a restored car, or one demo car can each be wrong about the
year. When an era rests on one of these, say so in the proposal and ask.

Record which photos you used per era (`"source"` in the plan). The user will want them.

### 4. Colours

`grid` the image, view it, then run `colors` on **tight boxes of bodywork only** — one
region per colour (body, then each accent), using the same `--n` as the grid. Use
`--n 20` when the car is small in the frame. If the top clusters come back tyre-black or
tarmac-grey, the box missed: shrink it and retry.

The output is evidence, not an answer:
- Several clusters of one hue at different lightness are one paint under light and
  shadow. Take the lit, non-glare one.
- Photos, film scans especially, read darker, duller and colour-cast compared with the
  paint. Old slides go warm: a white car reads cream. If a white number panel or white
  lettering is in shot, pass it as `--neutral` to remove the cast. Tarmac is a poor
  reference — it is rarely truly grey. Metallics photograph paler than they are.
- Trust agreement across photos over precision from one.
- **Reuse the file's palette.** If a colour is within ΔE 6 of a hex already in
  `teams.json` (the "nearest" column, `palette --near`), use that hex — `#E4002B` is the
  bright red, `#FFD200` the yellow, `#FF8000` the orange, and so on. `check` flags any
  new hex that should have been an existing one.

### 5. Deciding the four values

- **Primary** is the colour you would name the car by at a glance — the paint covering
  most of the car seen from the side and above. Not the carbon floor, tyres or bare wings.
  When a car is split half and half, pick the one covering more from the side, and say
  so — the user may prefer the other.
- **Accents** are the next colours that make the car recognisable, usually the title
  sponsor's. `secondaryColor1` is the stronger of the two.
- **Stripes** — how much of that identity the badge needs:
  - **2** when two accents are both part of the look (green with red and yellow).
  - **1** when one accent carries it and a second would be noise. `secondaryColor2` is
    still authored — a quiet related tone, or a real minor colour of the car such as its
    lettering — because it is used outside the badge.
  - **0** when the car is essentially one colour.

### 6. Eras, not seasons

The grain is coarse on purpose — a team that looks different every year is unreadable in
a table. Merge consecutive seasons into one era when they share the stripe count and each
drawn colour is within roughly ΔE 10 (`show` and `check` flag eras that fail this). A
real one-season departure earns its own era; a slightly different shade of the same red
does not. When one season is asked about and it matches the era around it, the answer is
"no change".

The first era keeps its `from` (normally the team's `foundedYear`) even when the first
race was later. Eras outside the requested span stay as they are unless the user asks —
but do point out any that are plainly wrong. Names and bases (`identity`) are not this
skill's business; if one looks wrong, mention it.

### 7. Clashes

`check --plan` compares the team's badge with every other badge on each grid it races
on, at two levels:

- **Twin badges** — primary under ΔE 16 *and* stripes alike (under ΔE 25, since thin
  stripes are harder to tell apart than a disc). The teams are indistinguishable: always
  fix these, usually by adding a second stripe from a real colour of the car. The typical
  case is two white cars with a single red stripe each.
- **Primary clashes** — primaries under ΔE 16 but stripes that differ. Common and often
  honest (half the 1990 grid was white); the stripes carry the difference.

Resolve either by moving **only the team under review** unless the user says otherwise:

- Make the smallest move that keeps the character: lightness first, then a lean in hue.
  `probe` shows each candidate's nearest neighbours across the span — one fix often walks
  into another team. For a car that really was the same colour as a rival (a red car on
  a grid with Ferrari), pick the palette shade that is ΔE 16 or more away and still
  matches the photos.
- Re-run `check`: the fix must not create a new clash, a near-duplicate era or a palette
  near-miss.
- Some clashes can't be fixed honestly: five white cars on one grid, or a colour boxed in
  between two neighbours. Leave those and report them — a pure white car shaded to
  off-white is still white. (A car that really was cream or ivory should be cream: that
  is accuracy, not a dodge.)
- Another team's current colours may simply be wrong (not yet researched). Don't bend a
  correct livery far to avoid a wrong one; name that team as a candidate for its own pass.
- When doing a whole grid, everyone is under review: move whichever of the pair has the
  less certain evidence.

"Stripe echoes" (an accent identical to another team's primary that year) are listed for
completeness. A thin stripe and a whole disc don't read alike, so an echo of a shared
palette colour is fine; only an unusual accent matching another car exactly (a specific
silver) is worth a nudge.

### 8. Propose — then wait

Render the sheet for the chunk and **look at it yourself** before showing it. It draws
the badges the way the app does: the team's eras on top, proposed above current, and
every grid below, with the team ringed blue, twin badges red and primary clashes amber.
Any red ring is unfinished work. Then give the user:

```
| Years | Primary | Stripe 1 | Stripe 2 | Stripes | Evidence |
|---|---|---|---|---|---|
| 1990-92 | `#FFFFFF` white | `#E4002B` red | `#0A2472` navy | 2 | 1991 Monaco race photo (period); museum car (demo) |
```

Mark in the evidence column whether each source is a period race photo or a demo /
museum / user-supplied one. Then: eras that changed or merged; clashes you moved away
from, with ΔE before and after; clashes you left, and why; every doubtful call (a season
with no photos, a single-source era, a half-and-half primary); and each sheet as a
clickable workspace-relative link, e.g.
`[lotus-1958-1978.png](.claude/skills/livery-research/out/lotus-1958-1978.png)`.
**Write nothing until the user says go**, then apply what they approved (see "Working
with the user").

### 9. Apply

`livery.py apply <plan>` validates what `validateSeedData` would (strictly ascending
`from`, `#RRGGBB`, stripes 0-2) and rewrites only that team's block, one era per line.
That validation is why the test suite isn't needed: nothing in the engine reads a
livery. Don't author season-entry livery overrides — that is the escape hatch in
`team-eras.md`, not this skill's tool.

Finish with the final era table and a list of anything left open: seasons that still
rest on one source, and other teams whose colours looked wrong along the way.
