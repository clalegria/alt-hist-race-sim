/**
 * The site footer.
 *
 * Two things are worth pinning: that it says who made this and does not offer
 * links that go nowhere, and that it is part of the *frame* rather than of one
 * screen — the reason it moved into `Shell` was that it was missing from the
 * screens that have no seed to print.
 */

import { describe, expect, it } from "vitest";
import { useSeasonStore } from "../store/season.js";
import { inRouter, renderRoute } from "../test-router.js";
import { SiteFooter } from "./SiteFooter.js";

const CREDIT = "Developed by Claudio Alegria";

describe("the footer", () => {
  it("credits the author and the collaboration", async () => {
    const html = await inRouter(<SiteFooter />);
    expect(html).toContain(CREDIT);
    expect(html).toContain("2026");
    expect(html).toContain("Anthropic Claude Code");
  });

  it("links to the About page", async () => {
    const html = await inRouter(<SiteFooter />);
    expect(html).toMatch(/<a [^>]*href="\/about"[^>]*>About this project<\/a>/);
  });

  it("offers the bug report, not built yet, as a disabled control rather than a dead link", async () => {
    const html = await inRouter(<SiteFooter />);
    // An <a> with no destination is the thing this is deliberately not.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Submit a bug report<\/button>/);
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("prints the seed only when it is given one", async () => {
    expect(await inRouter(<SiteFooter seed={4242} />)).toContain("4242");
    expect(await inRouter(<SiteFooter />)).not.toContain("Seed");
  });

  it("on the verge, is the track's grass with every part on a board of its own", async () => {
    const BOARD = "bg-card";
    const strip = await inRouter(<SiteFooter seed={4242} />);
    const verge = await inRouter(<SiteFooter seed={4242} onVerge />);
    expect(strip).not.toContain("track-verge");
    expect(strip).not.toContain(BOARD);
    expect(verge).toContain("track-verge");
    expect(verge).toContain(CREDIT);
    // The credit, the two destinations and the run.
    expect(verge.split(BOARD).length - 1).toBe(4);
  });

  it("is the lower verge of Home's track, straight after it", async () => {
    const { html } = await renderRoute("/");
    const track = html.indexOf("track-tarmac");
    const footer = html.indexOf("<footer");
    expect(track).toBeGreaterThan(-1);
    expect(footer).toBeGreaterThan(track);
    expect(html.slice(footer)).toMatch(/^<footer class="track-verge/);
  });

  it("is part of the frame, so a screen with no seed still has one", async () => {
    // The main menu is the case the bug was about: it had nothing to print in
    // a footer, so it had no footer. Rendered through the router, at the store's
    // *initial* state, which is what a static render reads whatever has been
    // dispatched at it.
    const { html } = await renderRoute("/");
    expect(useSeasonStore.getInitialState().run).toBeNull();
    expect(html).toContain(CREDIT);
    // Nothing to say about a run that has not started.
    expect(html).not.toContain("Seed");
  });
});
