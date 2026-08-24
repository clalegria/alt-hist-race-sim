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
(hue ~70, almost no chroma) against a deep red at hue 25, with the Tailwind radius
scale overridden tighter, so corners read as instrument panel rather than consumer app.

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

**Dark's floor is 20.5%, not the near-black it started at.** Below roughly 20%
lightness the neutrals stop separating from each other: background, card and muted
sat 1.08:1 and 1.21:1 apart, which is not a step anybody sees, so a card was drawn
entirely by its border and the page read as one flat unlit sheet. Lifting the floor
trades a little text contrast for elevation that is actually visible, and `border`
was raised further still (now ~1.5:1 against card) because on a dark theme it is the
border, not the fill, that draws a panel. If a surface needs to read as raised,
raise `border` before reaching further down into `background`.

**Never fade text with an opacity modifier.** `text-muted-foreground/50` measures
2.5:1 against the card — not the ~3.1 that halving a 6.2:1 colour suggests, because
CSS composites alpha in gamma space, and the shortfall is invisible in the source.
That class was on a good fraction of every table (drivers on zero points, retired
cars, unselected ratings). De-emphasised text uses `--color-subtle` instead, a real
token with a floor of ~4.8:1 on card in dark and ~4.4:1 in light. Opacity modifiers
are fine on *fills* — `bg-muted/60`, `bg-primary/10` — where nothing has to be read
through them.
