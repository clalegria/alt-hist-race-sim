/**
 * Every authored season, drawn end to end.
 *
 * The check that authoring a year is genuinely all it takes: each stage of the
 * reveal renders for each season, with that season's own calendar names — the
 * failure this catches is a component still reading a season pinned at import
 * time, which would label 1981 with 1980 round names and nobody would notice.
 */

import { seasons } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeasonView } from "./components/SeasonView.js";
import { driverName, teamName } from "./lib/names.js";
import { createWorld, type View } from "./store/season.js";

describe("each authored season, through the whole reveal", () => {
  for (const [year, seed] of seasons) {
    describe(`${year}`, () => {
      const world = createWorld(5, year);
      // Entities decoded: React escapes an apostrophe to `&#x27;`, and the
      // pool holds names with one in them. Every assertion here is against a
      // name, so decode once at the source rather than at each match.
      const render = (view: View): string =>
        renderToStaticMarkup(<SeasonView world={world} view={view} />)
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&");

      it("puts its own grid on the opening page", () => {
        const html = render({ kind: "grid" });
        for (const entry of seed.entries) {
          expect(html, entry.teamId).toContain(teamName(entry.teamId));
          for (const driverId of entry.drivers) {
            expect(html, driverId).toContain(driverName(driverId));
          }
        }
      });

      it("names each round from its own calendar", () => {
        // The coupling that mattered: round labels used to come from a season
        // fixed at import time, so every year read as 1980.
        seed.calendar.forEach((race, round) => {
          const html = render({ kind: "qualifying", round });
          expect(html, `${year} round ${race.round}`).toContain(race.name);
          expect(html, `${year} round ${race.round}`).toContain(race.circuit);
        });
      });

      it("lists every round of its own calendar on the summary", () => {
        const html = render({ kind: "summary" });
        for (const race of seed.calendar) {
          expect(html, `${year} ${race.name}`).toContain(race.name);
        }
        expect(html).toContain("Final classification.");
      });

      it("crowns a champion", () => {
        expect(render({ kind: "summary" })).toMatch(/points from \d+ wins?\./);
      });
    });
  }
});
