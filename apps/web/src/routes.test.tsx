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
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { NotReached, placeLabel } from "./components/NotReached.js";
import { ResumeRun, RunNotResumed } from "./components/ResumeRun.js";
import { RunBar } from "./components/RunBar.js";
import { TopNav } from "./components/TopNav.js";
import { AREAS, type Area, isAvailable } from "./lib/areas.js";
import { crumbsFor, returnFor, runBarFor } from "./lib/run-bar.js";
import { linkTo } from "./lib/run-places.js";
import { PLAYABLE_SEASONS } from "./lib/seasons.js";
import type { Place } from "./lib/timeline.js";
import { Route as GridRoute } from "./routes/run/$year/grid.js";
import { Route as SeasonRoute } from "./routes/run/$year/index.js";
import { Route as QualifyingRoute } from "./routes/run/$year/round/$round/qualifying.js";
import { Route as RaceRoute } from "./routes/run/$year/round/$round/race.js";
import { Route as DriverRoute } from "./routes/run/driver/$driverId.js";
import { Route as DriversRoute } from "./routes/run/drivers.js";
import { Route as ReviewRoute } from "./routes/run/index.js";
import { Route as TeamRoute } from "./routes/run/team/$teamId.js";
import { Route as TeamsRoute } from "./routes/run/teams.js";
import { Route as RunRoute } from "./routes/run.js";
import { cursorPlace, type Run, useSeasonStore } from "./store/season.js";
import { inRouter, renderRoute } from "./test-router.js";
import { seededWorld, YEAR } from "./test-support.js";

const CREDIT = "Developed by Claudio Alegria";

/** The top nav's markup alone, so other disabled buttons on a page are not counted. */
function navOf(html: string): string {
  const start = html.search(/<nav [^>]*aria-label="Main"/);
  expect(start, "the top nav is drawn").toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</nav>", start));
}

/** The top bar's markup, the nav and the Home mark and the buttons around it. */
function headerOf(html: string): string {
  const start = html.indexOf("<header");
  expect(start, "the top bar is drawn").toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</header>", start));
}

describe("each URL", () => {
  const pages = [
    { path: "/", shows: "Rewrite motorsport history" },
    { path: "/season/new", shows: "Begin the " },
    { path: "/era/new", shows: "Begin an era starting in " },
  ];

  for (const page of pages) {
    it(`renders ${page.path} inside the frame`, async () => {
      const { html, pathname } = await renderRoute(page.path);
      expect(pathname).toBe(page.path);
      expect(html).toContain(page.shows);
      // One page heading each; the run's own pages check theirs beside their parts.
      expect(html.split("<h1").length - 1).toBe(1);
      navOf(html);
      expect(html).toContain(CREDIT);
    });
  }
});

describe("a setup page", () => {
  it("draws no sticky bar: the run bar starts at the run's grid", async () => {
    for (const path of ["/season/new", "/era/new"]) {
      const { html } = await renderRoute(path);
      expect(html, path).not.toContain("sticky top-0");
      expect(html, path).not.toContain(">Back<");
    }
  });
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

  it("folds behind a menu button that names the nav it shows, closed at first", async () => {
    const header = headerOf((await renderRoute("/")).html);
    const navId = /<nav [^>]*id="([^"]+)"/.exec(header)?.[1];
    const button = /<button[^>]*aria-label="Menu"[^>]*>/.exec(header)?.[0];
    expect(navId, "the nav has an id").toBeDefined();
    expect(button, "the menu button is drawn").toBeDefined();
    expect(button).toContain(`aria-controls="${navId}"`);
    expect(button).toContain('aria-expanded="false"');
  });

  it("marks the Home link current on Home alone", async () => {
    const homeLink = (html: string) => /<a [^>]*href="\/"[^>]*>/.exec(headerOf(html))?.[0];
    expect(homeLink((await renderRoute("/")).html)).toContain('aria-current="page"');
    expect(homeLink((await renderRoute("/season/new")).html)).not.toContain("aria-current");
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
    { name: "season", route: SeasonRoute, params: { year } },
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

  it("let a page not reached yet through, to say so", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    for (const page of pages.filter((each) => each.name !== "grid" && each.name !== "review")) {
      expect(guardOf(page.route, page.params), page.name).toBeUndefined();
    }
  });

  it("send a URL naming no place the run will reach to the cursor", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    const cursor = linkTo({ year: YEAR, beat: { kind: "grid" } });
    for (const [route, params] of [
      [GridRoute, { year: "84" }],
      [GridRoute, { year: String(YEAR + 1) }],
      [RaceRoute, { year, round: "0" }],
    ] as const) {
      const thrown = guardOf(route, params);
      expect(isRedirect(thrown) && thrown.options.to, JSON.stringify(params)).toBe(cursor.to);
    }
  });

  it("let the reader back to every page once the season is over", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().jumpTo({ year: YEAR, beat: { kind: "summary" } });
    for (const page of pages.filter((each) => each.name !== "review" && each.name !== "grid")) {
      expect(guardOf(page.route, page.params), page.name).toBeUndefined();
    }
  });

  it("sends a raced grid's page on to the season page's Grid tab", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().jumpTo({ year: YEAR, beat: { kind: "summary" } });
    const grid = pages.find((each) => each.name === "grid");
    expect(grid && guardOf(grid.route, grid.params)).toBeDefined();
  });
});

describe("the guards on the people pages", () => {
  const pages = [
    { name: "drivers", route: DriversRoute, params: {} },
    { name: "teams", route: TeamsRoute, params: {} },
    { name: "driver", route: DriverRoute, params: { driverId: "x" } },
    { name: "team", route: TeamRoute, params: { teamId: "x" } },
  ];

  afterEach(() => {
    useSeasonStore.getState().exitRun();
  });

  it("send the reader home from every one when there is no run", () => {
    for (const page of pages) {
      const thrown = guardOf(page.route, page.params);
      expect(isRedirect(thrown) && thrown.options.to, page.name).toBe("/");
    }
  });

  it("let the reader through to the lists, and to anyone on the grid", () => {
    useSeasonStore.getState().startEra(YEAR);
    const entrant = useSeasonStore.getState().run?.world.field[0];
    expect(guardOf(DriversRoute, {})).toBeUndefined();
    expect(guardOf(TeamsRoute, {})).toBeUndefined();
    expect(guardOf(DriverRoute, { driverId: entrant?.driverId ?? "" })).toBeUndefined();
    expect(guardOf(TeamRoute, { teamId: entrant?.teamId ?? "" })).toBeUndefined();
  });

  it("send someone the run has not had to their list", () => {
    useSeasonStore.getState().startEra(YEAR);
    const driver = guardOf(DriverRoute, { driverId: "nobody_at_all" });
    expect(isRedirect(driver) && driver.options.to).toBe("/run/drivers");
    const team = guardOf(TeamRoute, { teamId: "Not An Id" });
    expect(isRedirect(team) && team.options.to).toBe("/run/teams");
  });

  it("send the reader of a one-year run to its season page from every one", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    const entrant = useSeasonStore.getState().run?.world.field[0];
    const season = linkTo({ year: YEAR, beat: { kind: "summary" } });
    for (const [route, params] of [
      [DriversRoute, {}],
      [TeamsRoute, {}],
      [DriverRoute, { driverId: entrant?.driverId ?? "" }],
      [TeamRoute, { teamId: entrant?.teamId ?? "" }],
    ] as const) {
      const thrown = guardOf(route, params);
      expect(isRedirect(thrown) && thrown.options).toMatchObject(season);
    }
  });
});

describe("the run bar", () => {
  const world = seededWorld(3, "aged", YEAR);
  const noop = () => {};
  /** The bar on `place`, the cursor's own page unless another is named. */
  const bar = (run: Run, place: Place = cursorPlace(run)) =>
    inRouter(
      <RunBar
        crumbs={crumbsFor(run, place)}
        returnTo={returnFor(run, place)}
        state={runBarFor(run)}
        editingGrid={false}
        onContinue={noop}
        onSkip={noop}
        onJump={noop}
        onRestartSeason={noop}
        onRestartEra={noop}
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

  it("puts the ways forward on a wide screen's bar, and the restarts and Exit run in ⋯", async () => {
    const era: Run = {
      kind: "era",
      run: { startYear: YEAR, seasons: [] },
      world,
      cursor: { kind: "race", round: 0 },
    };
    const html = await bar(era);
    // The ways forward are buttons in a row hidden below `md`, where ⋯ lists
    // them instead; ⋯'s entries render into a portal, so the rest are not in
    // the markup at all (`lib/run-bar.test.ts` has them as data).
    for (const label of ["Simulate rest of the season", "Jump to…"]) {
      expect(html, label).toContain(`>${label}</button>`);
    }
    for (const label of ["Restart season", "Restart era", "Exit run"]) {
      expect(html, label).not.toContain(`>${label}<`);
    }
    expect(html).toMatch(/class="hidden flex-1 flex-wrap justify-end gap-2 md:flex"><button/);
    expect(html).toMatch(/<button[^>]*aria-label="More run actions"/);
  });

  it("ends on every beat with the way on, ⋯ just before it", async () => {
    const rounds = world.season.races.length;
    const beats: Run["cursor"][] = [
      { kind: "grid" },
      ...Array.from({ length: rounds }, (_, round) => [
        { kind: "qualifying", round } as const,
        { kind: "race", round } as const,
      ]).flat(),
      { kind: "summary" },
    ];
    for (const cursor of beats) {
      const html = await bar({ kind: "season", world, cursor });
      const menu = html.lastIndexOf('aria-label="More run actions"');
      // The way on is Continue, or at a one-year run's end, Restart season.
      const end = html.lastIndexOf(cursor.kind === "summary" ? ">Restart season" : ">Continue");
      expect(menu, cursor.kind).toBeGreaterThan(-1);
      expect(end, cursor.kind).toBeGreaterThan(menu);
      // Nothing between ⋯ and Continue but Continue's own tag, nothing after.
      expect(html.slice(menu, end).match(/<button|<a /g), cursor.kind).toHaveLength(1);
      expect(html.slice(end), cursor.kind).not.toMatch(/<button|<a /);
    }
  });

  it("puts a menu of the other rounds beside the round, and none of other years in one year", async () => {
    // The menus' items render into a portal, so they are tested as data in
    // `lib/run-bar.test.ts`; here, that the button is drawn.
    const html = await bar({ kind: "season", world, cursor: { kind: "race", round: 0 } });
    expect(html).toMatch(/<button[^>]*aria-label="Other rounds"/);
    expect(html).not.toContain('aria-label="Other years"');
  });

  it("puts the way back first on a page away from the cursor, Continue still at the end", async () => {
    const run: Run = { kind: "season", world, cursor: { kind: "grid" } };
    const away = await bar(run, { year: YEAR, beat: { kind: "summary" } });
    // A link, since it goes somewhere, styled as the primary button, naming
    // the place in full in its tooltip.
    expect(away).toMatch(new RegExp(`<a[^>]*href="/run/${YEAR}/grid"[^>]*>[^]*?Back to run`));
    expect(away).toContain(`title="Back to ${YEAR} · Grid"`);
    expect(away).toContain(`Run is at ${YEAR} · Grid`);
    // Continue is still there, but no longer the primary button; on a phone,
    // the way back has its slot.
    expect(away).toMatch(/<button[^>]*class="[^"]*border-border[^"]*"[^>]*title="Next:/);
    expect(away.lastIndexOf("Back to run")).toBeGreaterThan(away.lastIndexOf(">Continue"));

    // On the cursor's own page the trail says where the run is, so the place
    // under it is only for screen readers, which cannot see the segments.
    const home = await bar(run);
    expect(home).not.toContain("Back to");
    expect(home).not.toContain("Run is at");
    expect(home).toContain(`<span class="sr-only">${YEAR} · Grid</span>`);
  });

  it("draws the season as a segment per round, the ones run marked done", async () => {
    const run: Run = {
      kind: "season",
      world: seededWorld(3, "aged", YEAR),
      cursor: { kind: "race", round: 1 },
    };
    const state = runBarFor(run);
    const html = await bar(run);
    const start = html.indexOf("grid-template-columns:repeat(");
    expect(start).toBeGreaterThan(-1);
    const segments = html.slice(start, html.indexOf("</div>", start));
    expect(segments.match(/<span/g)).toHaveLength(state.rounds);
    expect(segments.match(/data-done=""/g)).toHaveLength(state.roundsRun);
  });

  it("lights the live dot on the cursor's own page only", async () => {
    const run: Run = { kind: "season", world, cursor: { kind: "grid" } };
    expect(await bar(run)).toContain('data-live=""');
    expect(await bar(run, { year: YEAR, beat: { kind: "summary" } })).not.toContain("data-live");
  });

  it("ends a one-year run on Restart season in Continue's place, the primary button", async () => {
    const html = await bar({ kind: "season", world, cursor: { kind: "summary" } });
    expect(html).not.toContain(">Continue");
    expect(html).not.toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*class="[^"]*bg-primary[^"]*"[^>]*>Restart season/);
    expect(html).toContain('aria-label="More run actions"');
  });

  it("ends an era on Restart era in Continue's place", async () => {
    // The last year the data has, so its review has no year after it.
    const last = seededWorld(3, "aged", PLAYABLE_SEASONS.at(-1) ?? 0);
    const html = await bar({
      kind: "era",
      run: { startYear: last.year, seasons: [] },
      world: last,
      cursor: { kind: "review" },
    });
    expect(html).not.toContain(">Continue");
    expect(html).toMatch(/<button[^>]*class="[^"]*bg-primary[^"]*"[^>]*>Restart era/);
  });
});

describe("the Not reached yet page", () => {
  const place = { year: YEAR, beat: { kind: "race", round: 2 } } as const;
  const cursor = { year: YEAR, beat: { kind: "grid" } } as const;
  const page = () =>
    inRouter(<NotReached place={place} cursor="where the run is" link={linkTo(cursor)} />);

  it("says so, and names the place", async () => {
    const html = await page();
    // The words are the page's one h1, the place its sub-line.
    expect(html.split("<h1").length - 1).toBe(1);
    expect(html).toContain("Not reached yet</h1>");
    expect(html).toContain(placeLabel(place));
  });

  it("links back to the page the run is on", async () => {
    expect(await page()).toContain(`href="/run/${YEAR}/grid"`);
  });
});

describe("the Resume run card", () => {
  const grid = linkTo({ year: YEAR, beat: { kind: "grid" } });

  it("links to the page the run is on", async () => {
    const place = { year: YEAR, beat: { kind: "race", round: 2 } } as const;
    const html = await inRouter(
      <ResumeRun
        title="Era from 1980"
        detail="somewhere"
        rounds={16}
        roundsRun={3}
        link={linkTo(place)}
      />,
    );
    expect(html).toContain(`href="/run/${YEAR}/round/3/race"`);
    expect(html).toContain("Resume run");
  });

  it("offers Exit run beside the link, not inside it", async () => {
    const html = await inRouter(
      <ResumeRun title="Era from 1980" detail="somewhere" rounds={16} roundsRun={0} link={grid} />,
    );
    expect(html).toContain(">Exit run</button>");
    // A button inside an <a> is invalid HTML, and clicking it would follow the link.
    const link = html.slice(html.indexOf("<a "), html.indexOf("</a>"));
    expect(link).not.toContain("<button");
  });

  it("draws the season as segments, as many run as the run bar counts", async () => {
    const run: Run = {
      kind: "season",
      world: seededWorld(3, "aged", YEAR),
      cursor: { kind: "race", round: 1 },
    };
    const bar = runBarFor(run);
    const html = await inRouter(
      <ResumeRun
        title="Run"
        detail={bar.cursor}
        rounds={bar.rounds}
        roundsRun={bar.roundsRun}
        link={grid}
      />,
    );
    const count = (needle: string) => html.split(needle).length - 1;
    // Every segment carries its done fill as a variant; only the run ones are marked.
    expect(count("data-[done]:bg-primary")).toBe(bar.rounds);
    expect(count('data-done=""')).toBe(bar.roundsRun);
  });

  it("shows a car only when it is handed one", async () => {
    const props = { title: "Run", detail: "Grid", rounds: 16, roundsRun: 0, link: grid };
    expect(await inRouter(<ResumeRun {...props} />)).not.toContain("<svg");
    expect(await inRouter(<ResumeRun {...props} car={<svg />} />)).toContain("<svg");
  });

  it("gives way to a notice when the saved run could not be resumed", () => {
    const html = renderToStaticMarkup(<RunNotResumed />);
    expect(html).toContain("couldn&#x27;t be reopened");
    expect(html).toContain(">Dismiss</button>");
  });
});
