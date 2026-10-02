import { createFileRoute } from "@tanstack/react-router";
import { SeasonPicker } from "../../components/SeasonPicker.js";
import { SetupPage } from "../../run-routes.js";
import { useSeasonStore } from "../../store/season.js";

/** `/season/new` — choosing the year, and the rules, for a single season. */
export const Route = createFileRoute("/season/new")({ component: SeasonSetupPage });

function SeasonSetupPage() {
  const startSeason = useSeasonStore((state) => state.startSeason);
  return <SetupPage start={startSeason} picker={(onStart) => <SeasonPicker onStart={onStart} />} />;
}
