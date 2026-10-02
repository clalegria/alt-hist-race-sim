import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BackBar, Shell } from "../../App.js";
import { SeasonPicker } from "../../components/SeasonPicker.js";
import { useSeasonStore } from "../../store/season.js";

/** `/season/new` — choosing the year, and the rules, for a single season. */
export const Route = createFileRoute("/season/new")({ component: SeasonSetupPage });

function SeasonSetupPage() {
  const navigate = useNavigate();
  const startSeason = useSeasonStore((state) => state.startSeason);
  return (
    <Shell bar={<BackBar onBack={() => void navigate({ to: "/" })} />}>
      <SeasonPicker
        onStart={(year, randomness) => {
          startSeason(year, randomness);
          void navigate({ to: "/run" });
        }}
      />
    </Shell>
  );
}
