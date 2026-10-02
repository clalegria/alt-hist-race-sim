import { createFileRoute } from "@tanstack/react-router";
import { EraPicker } from "../../components/SeasonPicker.js";
import { SetupPage } from "../../run-routes.js";
import { useSeasonStore } from "../../store/season.js";

/** `/era/new` — choosing the year an era starts from, and its rules. */
export const Route = createFileRoute("/era/new")({ component: EraSetupPage });

function EraSetupPage() {
  const startEra = useSeasonStore((state) => state.startEra);
  return <SetupPage start={startEra} picker={(onStart) => <EraPicker onStart={onStart} />} />;
}
