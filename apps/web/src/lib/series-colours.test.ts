import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Livery } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { clashes, oklab, pickingOrder, seriesColours, THEMES } from "./series-colours.js";

/** A synthetic livery, nothing out of the seed data. */
function livery(primaryColor: string, secondaryColor1: string, secondaryColor2: string): Livery {
  return { primaryColor, secondaryColor1, secondaryColor2, badgeStripes: 2 };
}

const WHITE = "#FFFFFF";
const RED = "#CC0000";
const BLUE = "#0033CC";
const GREEN = "#006633";

function authored(hex: string) {
  return { css: hex, lab: oklab(hex) };
}

describe("THEMES", () => {
  it("is a copy of the stylesheet's foregrounds and line pulls", () => {
    const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");
    const light = css.indexOf(':root[data-theme="light"]');
    const after = (pattern: RegExp, from: number) => pattern.exec(css.slice(from))?.[1];
    const read = (from: number, lineFrom: number) => ({
      foreground: Number(after(/--color-foreground: oklch\(([\d.]+)%/, from)) / 100,
      pull: Number(after(/--line-pull: *([\d.]+)%/, lineFrom)) / 100,
    });
    const linePulls = css.indexOf("--line-pull");
    const lightLinePull = css.indexOf(':root[data-theme="light"] {\n  --line-pull');
    expect(lightLinePull).toBeGreaterThan(-1);
    const fromCss = {
      dark: read(css.indexOf("@theme"), linePulls),
      light: read(light, lightLinePull),
    };
    for (const theme of THEMES) {
      expect(fromCss[theme.name], theme.name).toEqual({
        foreground: theme.foreground,
        pull: theme.pull,
      });
    }
  });
});

describe("oklab", () => {
  it("puts white at full lightness and black at none, both without hue", () => {
    const [whiteL, whiteA, whiteB] = oklab(WHITE);
    expect(whiteL).toBeCloseTo(1, 3);
    expect(whiteA).toBeCloseTo(0, 3);
    expect(whiteB).toBeCloseTo(0, 3);
    expect(oklab("#000000")[0]).toBeCloseTo(0, 3);
  });
});

describe("pickingOrder", () => {
  const lines = (...teamIds: string[]) => teamIds.map((teamId) => ({ teamId }));

  it("puts the drivers' champion's team first, then the constructors' champion", () => {
    const order = pickingOrder(lines("a", "b", "c"), lines("c", "a", "b"));
    expect(order.slice(0, 2)).toEqual(["a", "c"]);
  });

  it("interleaves the two tables rank by rank, each team once", () => {
    const order = pickingOrder(lines("a", "a", "b", "d", "e", "f"), lines("c", "b", "a", "g"));
    expect(order).toEqual(["a", "c", "b", "d", "g", "e", "f"]);
  });
});

describe("seriesColours", () => {
  it("lets the best-placed team keep its primary, whatever comes below", () => {
    const [first] = seriesColours([livery(WHITE, RED, BLUE), livery(WHITE, GREEN, BLUE)]);
    expect(first?.css).toBe(WHITE);
  });

  it("moves a team that clashes with one above it to its first clear accent", () => {
    const picks = seriesColours([livery(WHITE, BLUE, RED), livery(WHITE, BLUE, GREEN)]);
    // Blue is the first accent, but the team above holds nothing blue: it is clear.
    expect(picks.map((pick) => pick?.css)).toEqual([WHITE, BLUE]);
  });

  it("takes a dark navy for black, as a thin line does", () => {
    const black = authored("#000000");
    expect(clashes(black, authored("#1A2848"))).toBe(true);
    // Light enough to show its hue, a dark red is still a colour of its own.
    expect(clashes(black, authored("#A00010"))).toBe(false);
  });

  it("takes two greens a car tells apart for one, once the dark theme pales them", () => {
    expect(clashes(authored("#008040"), authored("#005540"))).toBe(true);
  });

  it("moves a navy team below a black one to an accent", () => {
    const picks = seriesColours([livery("#000000", RED, RED), livery("#1A2848", WHITE, RED)]);
    expect(picks[1]?.css).toBe(WHITE);
  });

  it("skips an accent that clashes too", () => {
    const picks = seriesColours([
      livery(WHITE, GREEN, GREEN),
      livery(BLUE, GREEN, GREEN),
      livery(WHITE, BLUE, RED),
    ]);
    expect(picks[2]?.css).toBe(RED);
  });

  it("blends two of a team's colours only once all three are taken", () => {
    const picks = seriesColours([
      livery(WHITE, GREEN, GREEN),
      livery(RED, GREEN, GREEN),
      livery(BLUE, GREEN, GREEN),
      livery(WHITE, RED, BLUE),
    ]);
    const last = picks[3];
    expect(last?.css).toMatch(/^color-mix\(in oklab, /);
    for (const above of picks.slice(0, 3)) {
      expect(above !== undefined && last !== undefined && clashes(above, last)).toBe(false);
    }
  });

  it("takes the blend that stands furthest apart, not the first to scrape clear", () => {
    // 1985's McLaren: white, red and black all taken, and white-and-red is a
    // pale copy of the red above it.
    const brightRed = "#E0002A";
    const otherRed = "#E00800";
    const picks = seriesColours([
      livery(WHITE, WHITE, WHITE),
      livery(brightRed, brightRed, brightRed),
      livery("#000000", "#000000", "#000000"),
      livery(WHITE, otherRed, "#1A1A1A"),
    ]);
    expect(picks[3]?.css).toMatch(/^color-mix/);
    expect(picks[3]?.css).not.toBe(`color-mix(in oklab, ${WHITE} 50%, ${otherRed})`);
  });

  it("still gives a colour from the livery when nothing is clear", () => {
    const allWhite = livery(WHITE, WHITE, WHITE);
    const picks = seriesColours([allWhite, allWhite]);
    expect(picks[1]).toBeDefined();
    const [first, second] = picks;
    expect(first !== undefined && second !== undefined && clashes(first, second)).toBe(true);
  });

  it("takes no colour for an unknown team, and leaves the rest unconstrained", () => {
    const picks = seriesColours([undefined, livery(WHITE, RED, BLUE)]);
    expect(picks[0]).toBeUndefined();
    expect(picks[1]?.css).toBe(WHITE);
  });

  it("returns one pick per livery, in the order given", () => {
    const liveries = [livery(WHITE, RED, BLUE), undefined, livery(RED, WHITE, BLUE)];
    expect(seriesColours(liveries)).toHaveLength(liveries.length);
  });
});
