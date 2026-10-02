import { createFileRoute } from "@tanstack/react-router";
import { guardRunPage, RunPlacePage } from "../../../run-routes.js";

/** `/run/1984` — that year's season, which today is its summary. */
export const Route = createFileRoute("/run/$year/")({
  beforeLoad: ({ params }) => {
    guardRunPage("summary", params);
  },
  component: function SummaryPage() {
    return <RunPlacePage page="summary" params={Route.useParams()} />;
  },
});
