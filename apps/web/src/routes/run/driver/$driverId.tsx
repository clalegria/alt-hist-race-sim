import { createFileRoute } from "@tanstack/react-router";
import { guardRosterPage, RosterPlacePage } from "../../../run-routes.js";

/** `/run/driver/piquet` — one driver, across the run so far. */
export const Route = createFileRoute("/run/driver/$driverId")({
  beforeLoad: ({ params }) => {
    guardRosterPage("driver", params.driverId);
  },
  component: function DriverRoutePage() {
    return <RosterPlacePage page="driver" id={Route.useParams().driverId} />;
  },
});
