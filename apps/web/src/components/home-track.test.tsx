/**
 * The track along the foot of Home as drawn: the band a screen reader skips,
 * every car of the field at the large size with its wheels turning, and the
 * field turned round and held as the hidden game says.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carLabel } from "../lib/parade.js";
import { spreadField } from "../lib/track.js";
import { randomSource } from "../test-support.js";
import { HomeTrack, Track } from "./HomeTrack.js";
import { CAR_SIZES } from "./TeamCar.js";

const field = spreadField(randomSource(1), 1280);

describe("the track", () => {
  it("is hidden from screen readers, and marks its start/finish line", () => {
    const html = renderToStaticMarkup(<Track field={null} />);
    expect(html).toMatch(/^<div aria-hidden="true"/);
    expect(html).toContain("track-start");
    expect(html).toContain("S/F");
  });

  it("draws every car of the field at the large size, its wheels turning", () => {
    const html = renderToStaticMarkup(<Track field={field} />);
    expect(html.split(CAR_SIZES.large).length - 1).toBe(field.cars.length);
    expect(html.split("<svg").length - 1).toBe(field.cars.length);
    expect(html).toContain("motion-safe:animate-wheel");
  });

  it("puts each car where the field has it, in whole px", () => {
    const html = renderToStaticMarkup(<Track field={field} />);
    for (const car of field.cars) {
      expect(html).toContain(`translate(${Math.round(car.x)}px, ${Math.round(car.y)}px)`);
    }
  });

  it("draws the cars the right way round until the game turns them", () => {
    const ahead = renderToStaticMarkup(<Track field={field} />);
    const turned = renderToStaticMarkup(
      <Track field={field} game={{ pressed: false, reversed: true }} />,
    );
    expect(ahead).not.toContain("-scale-x-100");
    expect(turned.split("-scale-x-100").length - 1).toBe(field.cars.length);
  });

  it("stops every wheel while a car is held", () => {
    const PAUSED = "[animation-play-state:paused]";
    expect(renderToStaticMarkup(<Track field={field} />)).not.toContain(PAUSED);
    expect(
      renderToStaticMarkup(<Track field={field} game={{ pressed: true, reversed: false }} />),
    ).toContain(PAUSED);
  });

  it("draws the band and no cars before the page has measured it, and no tooltip", () => {
    const html = renderToStaticMarkup(<HomeTrack />);
    expect(html).toContain("track-tarmac");
    expect(html).not.toContain("<svg");
    for (const car of field.cars) {
      expect(html).not.toContain(carLabel(car));
    }
  });

  it("has its colours defined in the stylesheet for both themes", () => {
    const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");
    for (const part of ["track-verge", "track-kerb", "track-tarmac", "track-start"]) {
      expect(css).toContain(`.${part}`);
    }
    expect(css.split("--track-tarmac:").length - 1).toBe(2);
  });
});
