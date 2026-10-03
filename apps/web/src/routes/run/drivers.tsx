import { createFileRoute } from "@tanstack/react-router";
import { indexSearch } from "../../lib/roster.js";
import { guardRosterPage, RosterPlacePage } from "../../run-routes.js";

/** `/run/drivers?sort=wins` — everyone who has driven in the run so far. */
export const Route = createFileRoute("/run/drivers")({
  validateSearch: indexSearch,
  beforeLoad: () => {
    guardRosterPage("drivers");
  },
  component: function DriversRoutePage() {
    const { sort } = Route.useSearch();
    return <RosterPlacePage page="drivers" sort={sort ?? "titles"} />;
  },
});
