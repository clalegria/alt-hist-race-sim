import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BackBar, Shell } from "../../App.js";
import { EraPicker } from "../../components/SeasonPicker.js";
import { useSeasonStore } from "../../store/season.js";

/** `/era/new` — choosing the year an era starts from, and its rules. */
export const Route = createFileRoute("/era/new")({ component: EraSetupPage });

function EraSetupPage() {
  const navigate = useNavigate();
  const startEra = useSeasonStore((state) => state.startEra);
  return (
    <Shell bar={<BackBar onBack={() => void navigate({ to: "/" })} />}>
      <EraPicker
        onStart={(year, randomness) => {
          startEra(year, randomness);
          void navigate({ to: "/run" });
        }}
      />
    </Shell>
  );
}
