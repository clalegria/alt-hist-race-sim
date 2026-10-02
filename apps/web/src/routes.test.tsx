/**
 * The routes, rendered through the real router at a URL.
 *
 * What the component tests cannot reach: that each URL lands on the page it
 * names, inside the frame, and that `/run` with no run behind it goes home
 * rather than drawing an empty page — the last through the route's guard, since
 * a DOM-less router reports a redirect rather than following it. The run's own screens need a run in the
 * store, which a static render cannot see (`test-router.tsx`), so they are
 * tested as components in `App.test.tsx`.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  isRedirect,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { TopNav } from "./components/TopNav.js";
import { AREAS, type Area, isAvailable } from "./lib/areas.js";
import { Route as RunRoute } from "./routes/run.js";
import { useSeasonStore } from "./store/season.js";
import { renderRoute } from "./test-router.js";
import { YEAR } from "./test-support.js";

const CREDIT = "Developed by Claudio Alegria";

/** The top nav's markup alone, so other disabled buttons on a page are not counted. */
function navOf(html: string): string {
  const start = html.indexOf('<nav aria-label="Main"');
  expect(start, "the top nav is drawn").toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</nav>", start));
}

describe("each URL", () => {
  const pages = [
    { path: "/", shows: "Rewrite motorsport history" },
    { path: "/season/new", shows: "Begin the " },
    { path: "/era/new", shows: "Begin an era from " },
  ];

  for (const page of pages) {
    it(`renders ${page.path} inside the frame`, async () => {
      const { html, pathname } = await renderRoute(page.path);
      expect(pathname).toBe(page.path);
      expect(html).toContain(page.shows);
      navOf(html);
      expect(html).toContain(CREDIT);
    });
  }
});

describe("the guard on /run", () => {
  /** What `/run`'s guard does before the page renders: a redirect, or nothing. */
  function guard(): unknown {
    try {
      // The guard reads the store, never its arguments.
      RunRoute.options.beforeLoad?.({} as never);
      return undefined;
    } catch (thrown) {
      return thrown;
    }
  }

  afterEach(() => {
    useSeasonStore.getState().exitRun();
  });

  it("sends the reader home when there is no run to show", () => {
    // A typed URL, a reload, or browser-forward onto a run already exited.
    useSeasonStore.getState().exitRun();
    const thrown = guard();
    expect(isRedirect(thrown)).toBe(true);
    expect(isRedirect(thrown) && thrown.options.to).toBe("/");
  });

  it("lets the reader through to a run in progress", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    expect(guard()).toBeUndefined();
  });
});

describe("the top nav", () => {
  it("links every built area to its page, and greys out the rest", async () => {
    const nav = navOf((await renderRoute("/")).html);
    for (const area of AREAS) {
      if (isAvailable(area)) {
        expect(nav, area.label).toContain(`href="${area.to}"`);
      } else {
        // The label is text, not a pattern: "Era (advanced)" has brackets in it.
        const label = area.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(nav, area.label).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>${label}<`));
      }
    }
    // Disabled entries are buttons, never links to nowhere.
    expect((nav.match(/<a /g) ?? []).length).toBe(AREAS.filter(isAvailable).length);
  });

  it("marks the area the reader is in, and no other", async () => {
    const area = AREAS.find(isAvailable);
    if (area?.to === undefined) {
      throw new Error("the nav needs at least one built area");
    }
    const nav = navOf((await renderRoute(area.to)).html);
    expect((nav.match(/aria-current="page"/g) ?? []).length).toBe(1);
    const link = nav.slice(nav.indexOf(`href="${area.to}"`));
    expect(link.slice(0, link.indexOf("</a>"))).toContain('aria-current="page"');
  });

  it("greys out an area with a page while its mode is unbuilt", async () => {
    // Not in today's list, so drawn from a synthetic one: an entry for a mode
    // the menu says is not there must not lead into it.
    const unbuilt: Area = { label: "Market", to: "/era/new", mode: "era-advanced" };
    const router = createRouter({
      routeTree: createRootRoute({ component: () => <TopNav areas={[unbuilt]} /> }),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    const nav = navOf(renderToStaticMarkup(<RouterProvider router={router} />));
    expect(nav).not.toContain("<a ");
    expect(nav).toMatch(/<button[^>]*disabled=""[^>]*>Market</);
  });
});
