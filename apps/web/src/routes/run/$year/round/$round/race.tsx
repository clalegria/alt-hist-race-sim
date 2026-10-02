import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../../../../run-routes.js";

/** `/run/1984/round/3/race` — one race, round counted from 1. */
export const Route = createFileRoute("/run/$year/round/$round/race")({
  beforeLoad: ({ params }) => {
    guardRunPage("race", params);
  },
  component: function RacePage() {
    return <RunPlacePage page="race" params={Route.useParams()} />;
  },
});
