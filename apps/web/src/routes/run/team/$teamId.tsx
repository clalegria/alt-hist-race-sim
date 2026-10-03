import { createFileRoute } from "@tanstack/react-router";
import { guardRosterPage, RosterPlacePage } from "../../../run-routes.js";

/** `/run/team/tyrrell` — one team's lineage, every name it raced under, across the run so far. */
export const Route = createFileRoute("/run/team/$teamId")({
  beforeLoad: ({ params }) => {
    guardRosterPage("team", params.teamId);
  },
  component: function TeamRoutePage() {
    return <RosterPlacePage page="team" id={Route.useParams().teamId} />;
  },
});
