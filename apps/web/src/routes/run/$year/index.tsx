import { createFileRoute } from "@tanstack/react-router";
import { seasonSearch } from "../../../lib/season-tabs.js";
import { guardRunPage, RunPlacePage } from "../../../run-routes.js";

/** `/run/1984?tab=calendar` — that year's season page, from its grid on. */
export const Route = createFileRoute("/run/$year/")({
  validateSearch: seasonSearch,
  beforeLoad: ({ params }) => {
    guardRunPage("season", params);
  },
  component: function SeasonRoutePage() {
    const { tab } = Route.useSearch();
    return <RunPlacePage page="season" params={Route.useParams()} tab={tab ?? "standings"} />;
  },
});
