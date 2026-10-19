/**
 * Guards the shape of the theme, not its taste.
 *
 * These read the stylesheet as text because the failure they exist to catch is
 * invisible everywhere else: a nested `@theme` compiles without error, renders
 * without warning, and silently pins the whole app to one palette. Nothing in a
 * component test would ever notice, and it shipped that way once already.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyTheme, DEFAULT_THEME, otherTheme, parseTheme, readTheme } from "./lib/theme.js";

const css = readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf-8");
const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf-8");

const LIGHT_SELECTOR = ':root[data-theme="light"]';
const lightStart = css.indexOf(LIGHT_SELECTOR);

function tokensAfter(from: number, until = css.length): Set<string> {
  return new Set(
    [...css.slice(from, until).matchAll(/--color-([a-z-]+):/g)].map((match) => match[1] ?? ""),
  );
}

describe("the stylesheet", () => {
  it("declares the light palette outside @theme", () => {
    // Tailwind hoists every `@theme` block and merges them, dropping whatever
    // selector or media query wrapped it — so a nested one makes its palette
    // unconditional and the toggle stops doing anything.
    expect(lightStart).toBeGreaterThan(-1);
    expect(css.slice(lightStart)).not.toContain("@theme");
  });

  it("puts dark in plain @theme, so it needs no attribute to apply", () => {
    // The default has to survive a page with JavaScript disabled, where nothing
    // ever sets `data-theme`.
    const theme = css.slice(css.indexOf("@theme"), lightStart);
    expect(theme).toContain("--color-background");
    expect(theme).not.toContain("data-theme");
  });

  it("gives every colour both a dark value and a light one", () => {
    const dark = tokensAfter(css.indexOf("@theme"), lightStart);
    const light = tokensAfter(lightStart);
    expect(dark.size).toBeGreaterThan(5);
    for (const token of dark) {
      expect(light.has(token), `--color-${token} has no light value`).toBe(true);
    }
  });

  it("actually changes the colours between the two", () => {
    // A light block that repeated the dark values would pass the check above and
    // still leave the toggle apparently broken.
    const colourOf = (token: string, from: number): string | undefined =>
      css.slice(from).match(new RegExp(`--color-${token}: *([^;]+);`))?.[1];
    for (const token of [
      "background",
      "foreground",
      "card",
      "card-header",
      "border",
      "primary",
      "destructive",
    ]) {
      expect(colourOf(token, 0), `--color-${token} is identical in both themes`).not.toBe(
        colourOf(token, lightStart),
      );
    }
  });

  it("tells the browser which scheme is in play", () => {
    // Without this, scrollbars and form controls stay in the other theme.
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("color-scheme: light");
  });

  it("names the two faces it self-hosts", () => {
    expect(css).toContain("Archivo Variable");
    expect(css).toContain("IBM Plex Mono");
  });

  it("tints the background pattern for both themes", () => {
    // The texture is white-on-dark and black-on-light, so a light block that
    // forgot to override it would leave the pattern lightening an already white
    // page — invisible, and only ever noticed by someone looking for it.
    // Anchored on the *last* light block, not the first: the palette override
    // and the pattern override are separate rules, and the pattern's dark
    // defaults sit between them.
    const patternLight = css.lastIndexOf(LIGHT_SELECTOR);
    const tintOf = (token: string, from: number): string | undefined =>
      css.slice(from).match(new RegExp(`--pattern-${token}-tint: *([^;]+);`))?.[1];
    for (const token of ["major", "minor", "gap"]) {
      expect(tintOf(token, 0), `--pattern-${token}-tint has no dark value`).toBeDefined();
      expect(
        tintOf(token, patternLight),
        `--pattern-${token}-tint has no light value`,
      ).toBeDefined();
      expect(tintOf(token, 0)).not.toBe(tintOf(token, patternLight));
    }
  });
});

describe("choosing a theme", () => {
  it("starts dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(readTheme()).toBe("dark");
  });

  it("toggles between exactly two", () => {
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme(otherTheme("dark"))).toBe("dark");
  });

  it("falls back to the default for anything it did not write", () => {
    // Storage is shared with whatever else runs on the origin, and survives
    // across versions of this app.
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme("DARK")).toBe(DEFAULT_THEME);
    expect(parseTheme("solarized")).toBe(DEFAULT_THEME);
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("does nothing rather than throwing where there is no document", () => {
    // This module is imported by a test run in plain Node, and would be by any
    // future server render.
    expect(() => {
      applyTheme("light");
    }).not.toThrow();
  });
});

describe("the pre-paint script", () => {
  it("sets the theme before the page renders", () => {
    // Applying it in React instead would show dark first and correct it after
    // hydration, which is exactly the flash the script exists to prevent.
    const script = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));
    expect(script).toContain("alt-hist-theme");
    expect(script).toContain('setAttribute("data-theme"');
    expect(script).toContain("try");
    // It runs in the head, ahead of the app's own module.
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("uses the same storage key the app writes", () => {
    // Two spellings of the key would leave the choice silently forgotten.
    const key = html.match(/getItem\("([^"]+)"\)/)?.[1];
    const source = readFileSync(fileURLToPath(new URL("./lib/theme.ts", import.meta.url)), "utf-8");
    expect(key).toBeDefined();
    expect(source).toContain(`"${key}"`);
  });
});
