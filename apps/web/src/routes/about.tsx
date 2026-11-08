import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "../App.js";
import { AboutProject } from "../components/AboutProject.js";
import { bugReportUrl } from "../components/bug-report.js";
import { aboutSearch, aboutTabLinks } from "../lib/about-tabs.js";
import { RELEASES } from "../lib/whats-new.js";
import { useSeasonStore } from "../store/season.js";

/** `/about?tab=whats-new` — who made this and why, and what's new in each release. */
export const Route = createFileRoute("/about")({
  validateSearch: aboutSearch,
  component: function AboutRoutePage() {
    const { tab } = Route.useSearch();
    const shown = tab ?? "about";
    const run = useSeasonStore((state) => state.run);
    return (
      <Shell top>
        <AboutProject
          tab={shown}
          tabs={aboutTabLinks(shown)}
          releases={RELEASES}
          bugReport={bugReportUrl(run)}
        />
      </Shell>
    );
  },
});
