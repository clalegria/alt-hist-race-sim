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
