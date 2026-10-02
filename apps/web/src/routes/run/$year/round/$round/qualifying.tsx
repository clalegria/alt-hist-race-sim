import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../../../../run-routes.js";

/** `/run/1984/round/3/qualifying` — one qualifying session, round counted from 1. */
export const Route = createFileRoute("/run/$year/round/$round/qualifying")({
  beforeLoad: ({ params }) => {
    guardRunPage("qualifying", params);
  },
  component: function QualifyingPage() {
    return <RunPlacePage page="qualifying" params={Route.useParams()} />;
  },
});
