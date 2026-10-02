import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shell } from "../App.js";
import { MainMenu } from "../components/MainMenu.js";

/** `/` — the opening screen: what this is, and which mode to run. */
export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const navigate = useNavigate();
  return (
    <Shell>
      <MainMenu
        onChoose={(mode) => {
          if (mode === "season") {
            void navigate({ to: "/season/new" });
          } else if (mode === "era-basic") {
            void navigate({ to: "/era/new" });
          }
        }}
      />
    </Shell>
  );
}
