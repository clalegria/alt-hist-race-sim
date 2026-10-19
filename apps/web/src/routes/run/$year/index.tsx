import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { lastSeasonTab, rememberSeasonTab, seasonSearch } from "../../../lib/season-tabs.js";
import { guardRunPage, RunPlacePage } from "../../../run-routes.js";

/** `/run/1984?tab=calendar` — that year's season page, from its grid on. */
export const Route = createFileRoute("/run/$year/")({
  validateSearch: seasonSearch,
  beforeLoad: ({ params }) => {
    guardRunPage("season", params);
  },
  component: function SeasonRoutePage() {
    const { tab } = Route.useSearch();
    const shown = tab ?? lastSeasonTab();
    // In an effect, not during render: React expects rendering to change nothing.
    useEffect(() => {
      rememberSeasonTab(shown);
    }, [shown]);
    return <RunPlacePage page="season" params={Route.useParams()} tab={shown} />;
  },
});
