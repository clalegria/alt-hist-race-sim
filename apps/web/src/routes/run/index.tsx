import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../run-routes.js";

/** `/run` — an era's roll of honour; a one-year run is sent on to its season. */
export const Route = createFileRoute("/run/")({
  beforeLoad: () => {
    guardRunPage("review", {});
  },
  component: () => <RunPlacePage page="review" params={{}} />,
});
