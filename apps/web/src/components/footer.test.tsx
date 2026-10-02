/**
 * The site footer.
 *
 * Two things are worth pinning: that it says who made this and does not offer
 * links that go nowhere, and that it is part of the *frame* rather than of one
 * screen — the reason it moved into `Shell` was that it was missing from the
 * screens that have no seed to print.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useSeasonStore } from "../store/season.js";
import { renderRoute } from "../test-router.js";
import { SiteFooter } from "./SiteFooter.js";

const CREDIT = "Developed by Claudio Alegria";

describe("the footer", () => {
  it("credits the author and the collaboration", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain(CREDIT);
    expect(html).toContain("2026");
    expect(html).toContain("Anthropic Claude Code");
  });

  it("offers the two destinations as disabled controls, not as dead links", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain("About this project");
    expect(html).toContain("Submit a bug report");
    // Both are inactive, and neither pretends to be a link: an <a> with no
    // destination is the thing this is deliberately not.
    expect(
      html
        .split("<button")
        .slice(1)
        .every((button) => button.includes("disabled")),
    ).toBe(true);
    expect(html).not.toContain("<a ");
  });

  it("prints the seed only when it is given one", () => {
    expect(renderToStaticMarkup(<SiteFooter seed={4242} />)).toContain("4242");
    expect(renderToStaticMarkup(<SiteFooter />)).not.toContain("Seed");
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
