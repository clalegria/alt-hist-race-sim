import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../../run-routes.js";

/** `/run/1984/grid` — that year's grid, editable while the run is on it. */
export const Route = createFileRoute("/run/$year/grid")({
  beforeLoad: ({ params }) => {
    guardRunPage("grid", params);
  },
  component: function GridPage() {
    return <RunPlacePage page="grid" params={Route.useParams()} />;
  },
});
