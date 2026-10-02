/**
 * The router: the generated route tree, and the registration that types it.
 *
 * `routeTree.gen.ts` is written by TanStack's Vite plugin from the files in
 * `routes/` — one file per URL — whenever the dev server or a build runs. It is
 * committed so `pnpm typecheck` passes on a fresh clone; never edit it by hand.
 */

import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.js";

/** A router over the app's routes; tests hand it an in-memory history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history === undefined ? {} : { history }) });
}

/**
 * Tells TanStack which router this app uses, so every `Link`, `navigate` and
 * `redirect` is checked by `tsc` against the real routes: a link to a URL that
 * has no route fails the typecheck rather than the reader.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
