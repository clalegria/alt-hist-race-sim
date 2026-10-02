/**
 * The routes, rendered through the real router at a URL.
 *
 * What the component tests cannot reach: that each URL lands on the page it
 * names, inside the frame, and that `/run` with no run behind it goes home
 * rather than drawing an empty page — the last through the route's guard, since
 * a DOM-less router reports a redirect rather than following it. The run's own
 * pages need a run in the store, which a static render cannot see
 * (`test-router.tsx`), so their guards are called directly and their parts are
 * rendered as components inside a bare router.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  isRedirect,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ResumeRun } from "./components/ResumeRun.js";
import { RunBar } from "./components/RunBar.js";
import { TopNav } from "./components/TopNav.js";
import { AREAS, type Area, isAvailable } from "./lib/areas.js";
import { crumbsFor, runBarFor } from "./lib/run-bar.js";
import { linkTo } from "./lib/run-places.js";
import { Route as GridRoute } from "./routes/run/$year/grid.js";
import { Route as SummaryRoute } from "./routes/run/$year/index.js";
import { Route as QualifyingRoute } from "./routes/run/$year/round/$round/qualifying.js";
import { Route as RaceRoute } from "./routes/run/$year/round/$round/race.js";
import { Route as ReviewRoute } from "./routes/run/index.js";
import { Route as RunRoute } from "./routes/run.js";
import { cursorPlace, type Run, useSeasonStore } from "./store/season.js";
import { renderRoute } from "./test-router.js";
import { seededWorld, YEAR } from "./test-support.js";

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

/** What a route's guard does before the page renders: a redirect, or nothing. */
function guardOf(
  route: { options: { beforeLoad?: unknown } },
  params: Record<string, string>,
): unknown {
  try {
    (route.options.beforeLoad as (context: unknown) => void)({ params });
    return undefined;
  } catch (thrown) {
    return thrown;
  }
}

describe("the guards on the pages inside /run", () => {
  const year = String(YEAR);
  const pages = [
    { name: "review", route: ReviewRoute, params: {} },
    { name: "summary", route: SummaryRoute, params: { year } },
    { name: "grid", route: GridRoute, params: { year } },
    { name: "qualifying", route: QualifyingRoute, params: { year, round: "1" } },
    { name: "race", route: RaceRoute, params: { year, round: "1" } },
  ];

  afterEach(() => {
    useSeasonStore.getState().exitRun();
  });

  it("send the reader home from every page when there is no run", () => {
    for (const page of pages) {
      const thrown = guardOf(page.route, page.params);
      expect(isRedirect(thrown) && thrown.options.to, page.name).toBe("/");
    }
  });

  it("let the reader through to the cursor's own page", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    expect(guardOf(GridRoute, { year })).toBeUndefined();
  });

  it("send a page the reader has not reached to the cursor", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    const cursor = linkTo({ year: YEAR, beat: { kind: "grid" } });
    for (const page of pages.filter((each) => each.name !== "grid")) {
      const thrown = guardOf(page.route, page.params);
      expect(isRedirect(thrown), page.name).toBe(true);
      expect(isRedirect(thrown) && thrown.options.to, page.name).toBe(cursor.to);
      expect(isRedirect(thrown) && thrown.options.params, page.name).toEqual(
        "params" in cursor && cursor.params,
      );
    }
  });

  it("let the reader back to every page once the season is over", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().skipToEnd();
    for (const page of pages.filter((each) => each.name !== "review")) {
      expect(guardOf(page.route, page.params), page.name).toBeUndefined();
    }
  });
});

/** Renders `node` inside a bare router, which a `Link` needs around it. */
async function inRouter(node: ReactNode): Promise<string> {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("the run bar", () => {
  const world = seededWorld(3, "aged", YEAR);
  const noop = () => {};
  const bar = (run: Run) =>
    inRouter(
      <RunBar
        crumbs={crumbsFor(run, cursorPlace(run))}
        state={runBarFor(run)}
        editingGrid={false}
        confirmingRestart={false}
        onContinue={noop}
        onSkip={noop}
        onJump={noop}
        onStartAgain={noop}
        onRestart={noop}
        onCancelRestart={noop}
        onExit={noop}
      />,
    );

  it("draws the trail as a breadcrumb list, the page itself marked current", async () => {
    const html = await bar({ kind: "season", world, cursor: { kind: "race", round: 0 } });
    expect(html).toContain('<nav aria-label="Breadcrumb"><ol');
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-current="page"[^>]*>Race</);
  });

  it("offers Continue while there is somewhere to go, and the menu always", async () => {
    const html = await bar({ kind: "season", world, cursor: { kind: "grid" } });
    expect(html).toContain(">Continue");
    expect(html).toContain('aria-label="More run actions"');
  });

  it("offers no Continue at the end of a one-year run, but still the way out", async () => {
    const html = await bar({ kind: "season", world, cursor: { kind: "summary" } });
    expect(html).not.toContain(">Continue");
    expect(html).toContain('aria-label="More run actions"');
  });
});

describe("the Resume run card", () => {
  it("links to the page the run is on", async () => {
    const place = { year: YEAR, beat: { kind: "race", round: 2 } } as const;
    const html = await inRouter(
      <ResumeRun title="Era from 1980" detail="somewhere" link={linkTo(place)} />,
    );
    expect(html).toContain(`href="/run/${YEAR}/round/3/race"`);
    expect(html).toContain("Resume run");
  });
});
