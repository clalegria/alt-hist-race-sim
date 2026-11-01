import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "../App.js";
import { AboutProject } from "../components/AboutProject.js";
import { aboutSearch, aboutTabLinks, lastAboutTab, rememberAboutTab } from "../lib/about-tabs.js";
import { RELEASES } from "../lib/whats-new.js";

/** `/about?tab=whats-new` — who made this and why, and what's new in each release. */
export const Route = createFileRoute("/about")({
  validateSearch: aboutSearch,
  component: function AboutRoutePage() {
    const { tab } = Route.useSearch();
    const shown = tab ?? lastAboutTab();
    // In an effect, not during render: React expects rendering to change nothing.
    useEffect(() => {
      rememberAboutTab(shown);
    }, [shown]);
    return (
      <Shell top>
        <AboutProject tab={shown} tabs={aboutTabLinks(shown)} releases={RELEASES} />
      </Shell>
    );
  },
});
