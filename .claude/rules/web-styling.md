---
paths:
  - "apps/web/**/*.css"
  - "apps/web/index.html"
  - "apps/web/src/lib/theme.ts"
  - "apps/web/src/theme.test.ts"
  - "apps/web/src/components/ThemeToggle.tsx"
---

# Type, palette and theme

Archivo (UI) and IBM Plex Mono (every figure), self-hosted via `@fontsource` so a
shared static build makes no external request — **Latin subsets only**, since
importing a package root ships Cyrillic, Greek and Vietnamese cuts of every weight.
Numerals get the mono face through a single unlayered `.tabular-nums` rule rather than
a font class threaded through a dozen components; the coupling is deliberate and
everything currently marked `tabular-nums` is a number. The palette is warm greys
(hue ~70, almost no chroma) against a petrol teal primary at hue 203, with the Tailwind
radius scale overridden tighter, so corners read as instrument panel rather than
consumer app.

**Red is never the primary.** It means something went wrong or is about to be thrown
away: `--color-destructive` (the confirm button of `RunConfirmDialog`, through Button's
`destructive` variant, and any future error or warning) and `--color-loss` (places
lost, a retirement's status). The teal is held to moderate chroma because it sits
between gain green (148) and wet blue (250) and must read as neither. Every primary and
destructive value clears 4.5:1 both under its foreground and as text on the card and
the header, in both themes; measure a new value against all three before using it.

**Headers are darker than what they head.** `--color-card-header` is the band at the
top of a card or a table, a step below `--color-card`: grey over white in light, a
darker charcoal over a lighter one in dark. `CardHeader` and `TableHeader` in
`components/ui/` carry it, and so does a grid tile's top row (`SeasonGrid`), so every
header in the app gets it from one place; never hand-roll a header fill. The dim text
tokens and the reds are set to hold 4.5:1 on both surfaces. Light `accent` (the hover
fill) sits below the header too, or a name's hover would vanish on it.

**Theme is chosen, not inherited.** Dark is the default and lives in plain `@theme`,
so it needs no attribute and survives a page with JavaScript disabled. Light is an
override on `:root[data-theme="light"]`, flipped by a toggle in the sticky bar and
remembered in `localStorage`. A blocking script in `index.html` applies the stored
choice before first paint; doing it in React instead would show dark and correct it
after hydration, which is the flash the script exists to prevent.

**The override must never be a nested `@theme`.** Tailwind flattens every `@theme`
block wherever it sits and merges them, dropping whatever selector or media query
wrapped it — so a nested one silently pins the app to whichever palette is declared
last. It shipped that way once, dark-only under a `prefers-color-scheme` block that
was being hoisted away, until a build-output check caught it. `src/theme.test.ts`
reads the stylesheet and `index.html` as text to guard the structure, including that
both spell the storage key the same way, because nothing in a component test can see
any of this.

Biome needs `css.parser.tailwindDirectives` to parse Tailwind 4's `@theme`; it is on
in `biome.json`.

## Two rules the dark palette is built on

**Dark is a mid charcoal, not near-black.** Below roughly 20% lightness the neutrals
stop separating from each other, so a card is drawn entirely by its border and the page
reads as one flat unlit sheet. The ladder (background, header, card, muted, accent,
border) moves together and keeps its steps, listed in `index.css`. `border` sits
furthest above the card (~1.6:1) because on a dark theme it is the border, not the fill,
that draws a panel. If a surface needs to read as raised, raise `border` before reaching
further down into `background`.

**Never fade text with an opacity modifier.** `text-muted-foreground/50` measures
2.5:1 against the card — not the ~3.1 that halving a 6.2:1 colour suggests, because
CSS composites alpha in gamma space, and the shortfall is invisible in the source.
That class was on a good fraction of every table (drivers on zero points, retired
cars, unselected ratings). De-emphasised text uses `--color-subtle` instead, a real
token with a floor of 4.5:1 on both card and header, in both themes. Opacity modifiers
are fine on *fills* — `bg-muted/60`, `bg-primary/10` — where nothing has to be read
through them.

## The hues outside the palette

`--color-wet` / `--color-wet-foreground` is a blue, in a palette that is otherwise warm
greys and a teal. It earns the exception by naming a fact about the world rather than an
emphasis: `--color-primary` is spent on "won the thing on screen", and a wet round is not
a winner, so reusing it would make two different meanings share one colour. Blue means
rain with no legend needed.

**Both values were picked by measuring contrast, not by eye**, and the dark one is darker
than the instinct for a dark theme. The badge is a *filled pill with white text*, so it is
the text that has to clear 4.5:1, not the fill against the card — and a blue light enough
to pop off the card cannot carry white text. Dark `oklch(54% 0.17 250)` gives 4.7:1 under
its foreground and 2.6:1 against the card; light `oklch(50% 0.18 250)` gives 5.6:1 and
5.9:1. The foreground is the same near-white in both. Like gain and loss, it is always
paired with a glyph — never colour alone.

`--color-home` / `--color-home-edge` is the second such exception and earns it the same
way: a pale gold for an entry racing at home, which is neither "won the thing on screen"
nor "it rained", and a third mark in either of those hues would have read as one of them.
**Two tokens because the star is a filled shape rather than a pill**: the pale fill
carries it against the dark theme's grey card and vanishes against the light theme's
white one, so the darker edge is what actually draws it there — which is also why the
light values are deeper on both counts rather than the same gold twice.

The existing "every dark token has a light value" assertion in `theme.test.ts` covers
all four without needing a case of their own.

## The background texture

The page sits on a **checkerboard of 120px squares with a second checkerboard of 20px
squares over it** — two stacked `repeating-conic-gradient`s on a fixed `body::before`
at `z-index: -1`, so it stays put while a long classification scrolls over it and no
component has to know it exists. The periods are commensurate on purpose (six minor
squares to a major one), so the small grid never drifts across a large square's edge.
The home screen's parade of cars runs on a layer at the same `-1`, just above it, unless
it has no open lane (`web-team-car.md`).

**Stacking the two is what makes it read as nested.** Four tone levels come out of two
layers, and from the base surface they ladder at roughly +1.2, +2.0, +3.1 L\* — small
alone, large alone, both — so a large square reads as a field that the small grid then
subdivides, rather than as two textures over each other. The tints are white on dark
and black on light: the texture always lifts *away* from the background, which stops
it looking like dirt on the light theme.

**Light is deliberately stronger** — roughly −2.4 / −3.8 / −5.9 L\* — so the pattern
still reads on a washed-out screen such as a TV.

The tints are 1.3–4.2% alpha and that band is narrower than it looks. Alpha composites
in gamma space here as everywhere (see the opacity rule above), so the major tint does
not land at twice the minor's step even at nearly twice its alpha. Much below 1% and
8-bit rounding eats the step; much past light's values and the largest squares start
reading as panels with edges. **They are not `--color-` tokens** —
`--pattern-major-tint` and friends live on plain `:root`, deliberately outside
`@theme`, because a checkerboard tint is not a colour any component should be able to
reach for as `bg-*`. `theme.test.ts` still holds them to having both a dark and
a light value, since a missed light override would leave the pattern lightening an
already white page.
