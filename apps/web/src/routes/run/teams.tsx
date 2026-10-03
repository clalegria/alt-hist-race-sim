import { createFileRoute } from "@tanstack/react-router";
import { indexSearch } from "../../lib/roster.js";
import { guardRosterPage, RosterPlacePage } from "../../run-routes.js";

/** `/run/teams?sort=wins` — every team that has entered the run so far. */
export const Route = createFileRoute("/run/teams")({
  validateSearch: indexSearch,
  beforeLoad: () => {
    guardRosterPage("teams");
  },
  component: function TeamsRoutePage() {
    const { sort } = Route.useSearch();
    return <RosterPlacePage page="teams" sort={sort ?? "titles"} />;
  },
});
