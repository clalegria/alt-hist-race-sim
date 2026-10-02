/**
 * Renders a URL through the real router, for tests.
 *
 * An in-memory history stands in for the browser's address bar, and
 * `router.load()` resolves the route before the static render, so what comes
 * back is the page a reader at that URL would get. With no DOM the router runs
 * as it would on a server, where a redirect is reported rather than followed,
 * so a route's redirect is tested by calling its guard instead.
 *
 * The store is read at its *initial* state: Zustand serves that as the server
 * snapshot to `renderToStaticMarkup`, so a page that needs a run in progress
 * cannot be rendered this way. Those screens are rendered as components.
 */

import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { createAppRouter } from "./router.js";

export async function renderRoute(path: string): Promise<{ html: string; pathname: string }> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  await router.load();
  return {
    html: renderToStaticMarkup(<RouterProvider router={router} />),
    pathname: router.state.location.pathname,
  };
}
