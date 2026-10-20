import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../../run-routes.js";

/** `/run/1984/grid` — the grid the run is on, to edit; once raced, the season's Grid tab. */
export const Route = createFileRoute("/run/$year/grid")({
  beforeLoad: ({ params }) => {
    guardRunPage("grid", params);
  },
  component: function GridPage() {
    return <RunPlacePage page="grid" params={Route.useParams()} />;
  },
});
