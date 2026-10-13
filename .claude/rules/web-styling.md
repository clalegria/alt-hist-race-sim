---
paths:
  - "apps/web/**/*.css"
  - "apps/web/index.html"
  - "apps/web/src/lib/theme.ts"
  - "apps/web/src/theme.test.ts"
  - "apps/web/src/components/ThemeToggle.tsx"
---

# Type, palette and theme

The stylesheet, the theme and the blocking script in `index.html`. Each token's
reasoning is its comment in `index.css`.

- **Fonts are self-hosted through `@fontsource`** (`main.tsx`), so a static build makes
  no external request. Import a subset file, never a package root, which ships every
  script's cut of every weight. Archivo's must be `standard.css`: `wght.css` has no
  width axis, and `narrow` silently does nothing.
- **`.tabular-nums` puts text in the mono face**: mark only figures with it.
- **`narrow` is the one width utility.** Never name a custom utility `font-*`:
  tailwind-merge reads it as a font family and drops it beside `font-mono`.
- **Capitals come from `uppercase`, never the source text**: tests and the screenshot
  steps find elements by their text.
- **Corners are square through the `--radius-*` tokens**, `--radius` included (bare
  `rounded`). A shape that must stay round uses `rounded-full` or an arbitrary value.
- **Badges and flags outline with `badge-line`, never `border`**, which is too close to the
  dark card to edge a black livery.
- **Red is never the primary**: it means something went wrong or is about to be thrown
  away (`--color-destructive`, `--color-loss`).
- **A new primary or destructive value must clear 4.5:1** under its foreground and as text
  on the card and on the header, in both themes. Measure all three before using it.
- **Never hand-roll a header fill**: `CardHeader`, `TableHeader` and a grid tile's top row
  carry `--color-card-header`.
- **Never fade text with an opacity modifier**: alpha composites in gamma space and lands
  far below the contrast it appears to have. Use `--color-subtle`. Opacity on fills is fine.
- **On dark, a panel is drawn by its border**: to make a surface read as raised, raise
  `border` before darkening `background`.
- **Dark is the default, in plain `@theme`; light overrides the variables on
  `:root[data-theme="light"]`. Never nest a `@theme`**: Tailwind hoists it and drops its
  selector, pinning the app to whichever palette comes last.
- **Every dark value needs a light one**, the background pattern's tints included.
- **The theme's storage key is spelled in both `lib/theme.ts` and the blocking script in
  `index.html`**, which applies the choice before first paint. `theme.test.ts` reads both
  as text, since no component test can see either.
- **A hue outside the palette must name a fact, not an emphasis** (`--color-wet`,
  `--color-home`), and is always paired with a glyph or tooltip, never colour alone.
- **The pattern tints are not `--color-` tokens**: they stay on plain `:root`, outside
  `@theme`, so no component can reach for them as `bg-*`.
- **The chequer sash's angle is the badge's** (`ANGLE` in `TeamBadge.tsx`): change both.
- **Biome parses `@theme` only with `css.parser.tailwindDirectives`**, on in `biome.json`.
