/**
 * The home screen's parade as drawn: big cars with turning wheels, on a layer
 * a screen reader skips, and nothing moving for a reader who asked for less.
 *
 * Synthetic liveries throughout; the real ones are seed data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Livery } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATIONS, type Formation, PARADE_SIZE, type Pass } from "../lib/parade.js";
import { HomeParade, Parade } from "./HomeParade.js";
import { CAR_SIZES } from "./TeamCar.js";

const LIVERY: Livery = {
  primaryColor: "#aa0000",
  secondaryColor1: "#00bb00",
  secondaryColor2: "#0000cc",
  badgeStripes: 2,
};

function pass(formation: Formation): Pass {
  return {
    cars: Array.from({ length: PARADE_SIZE }, (_, i) => ({
      teamId: `team-${i}`,
      year: 1950 + 30 * i,
      livery: LIVERY,
    })),
    formation,
    lane: 0.4,
    duration: 3,
  };
}

const formations = Object.keys(FORMATIONS) as Formation[];

describe("the parade", () => {
  it("draws every car of a pass at the large size, its wheels turning", () => {
    for (const formation of formations) {
      const html = renderToStaticMarkup(<Parade pass={pass(formation)} />);
      expect(html.split(CAR_SIZES.large).length - 1).toBe(PARADE_SIZE);
      expect(html.split("<svg").length - 1).toBe(PARADE_SIZE);
      expect(html).toContain("motion-safe:animate-wheel");
    }
  });

  it("starts each car at its formation's delay", () => {
    for (const formation of formations) {
      const html = renderToStaticMarkup(<Parade pass={pass(formation)} />);
      for (const slot of FORMATIONS[formation]) {
        expect(html).toContain(`animation-delay:${slot.delay}s`);
      }
    }
  });

  it("is hidden from screen readers and from the pointer", () => {
    const html = renderToStaticMarkup(<Parade pass={pass("file")} />);
    expect(html).toMatch(/^<div aria-hidden="true" class="[^"]*pointer-events-none/);
  });

  it("does not move, or show, for a reader who has asked for reduced motion", () => {
    const html = renderToStaticMarkup(<Parade pass={pass("staggered")} />);
    expect(html).toContain("motion-reduce:hidden");
    expect(html.split("motion-safe:animate-drive").length - 1).toBe(PARADE_SIZE);
    expect(html).not.toMatch(/(?<!motion-safe:)animate-drive/);
  });

  it("has its drive defined in the stylesheet", () => {
    const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");
    expect(css).toMatch(/--animate-drive:\s*drive\b/);
    expect(css).toContain("@keyframes drive");
  });

  it("draws nothing until its timer sets a pass off", () => {
    expect(renderToStaticMarkup(<HomeParade />)).toBe("");
  });
});
