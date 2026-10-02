import { createFileRoute, redirect } from "@tanstack/react-router";
import { RunLayout } from "../run-routes.js";
import { useSeasonStore } from "../store/season.js";

/**
 * `/run` and everything under it — the run in progress, one page per beat
 * (`run-routes.tsx`). This is their layout: the run bar, the exit guard, and
 * an outlet for the page.
 *
 * `beforeLoad` runs before any page inside renders, on every navigation to one,
 * and sends a reader with no run home: a typed URL, a reload (nothing survives
 * one yet), or browser-forward onto a run that has since been exited.
 */
export const Route = createFileRoute("/run")({
  beforeLoad: () => {
    if (useSeasonStore.getState().run === null) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: RunLayout,
});
