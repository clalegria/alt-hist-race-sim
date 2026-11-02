/**
 * Every authored season, drawn end to end.
 *
 * The check that authoring a year is genuinely all it takes: each stage of the
 * reveal renders for each season, with that season's own calendar names — the
 * failure this catches is a component still reading a season pinned at import
 * time, which would label 1981 with 1980 round names and nobody would notice.
 *
 * Simulating and drawing every season is slow, and Vitest runs one file on one
 * worker, so the seasons are split across the `part-*.test.tsx` files beside
 * this one: each takes its share of `seasons` by position, never by year, so a
 * newly authored season lands in the last part without anyone writing it down.
 * Not a `.test.tsx` file, so Vitest does not collect it.
 */

import { seasons } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeasonView } from "../components/SeasonView.js";
import { driverName, teamName } from "../lib/names.js";
import type { SeasonTab } from "../lib/season-tabs.js";
import type { View } from "../lib/timeline.js";
import { createWorld } from "../store/season.js";
import { shownAt, textOf } from "../test-support.js";

/** How many `part-*.test.tsx` files share the seasons out. */
export const SMOKE_PARTS = 8;

/** The seasons of part `part` (1 to `SMOKE_PARTS`), each drawn end to end. */
export function smokeSeasons(part: number): void {
  const all = [...seasons];
  const size = Math.ceil(all.length / SMOKE_PARTS);
  const share = all.slice((part - 1) * size, part === SMOKE_PARTS ? undefined : part * size);
  describe(`each authored season, through the whole reveal (part ${part} of ${SMOKE_PARTS})`, () => {
    for (const [year, seed] of share) {
      describe(`${year}`, () => {
        const world = createWorld(5, year);
        // Entities decoded: React escapes an apostrophe to `&#x27;`, and the
        // pool holds names with one in them. Every assertion here is against a
        // name, so decode once at the source rather than at each match.
        const render = (view: View, tab?: SeasonTab): string =>
          renderToStaticMarkup(
            <SeasonView {...shownAt(world, view)} {...(tab === undefined ? {} : { tab })} />,
          )
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");

        it("puts its own grid on the opening page", () => {
          const html = render({ kind: "grid" });
          for (const entry of seed.entries) {
            expect(html, entry.teamId).toContain(teamName(entry.teamId, year));
            for (const driverId of entry.drivers) {
              expect(textOf(html), driverId).toContain(driverName(driverId));
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

        it("lists every round of its own calendar on the season's calendar tab", () => {
          const html = render({ kind: "summary" }, "calendar");
          for (const race of seed.calendar) {
            expect(html, `${year} ${race.name}`).toContain(race.name);
          }
          expect(render({ kind: "summary" })).toContain("Final classification");
        });

        it("crowns a champion", () => {
          expect(render({ kind: "summary" })).toMatch(/points from \d+ wins?\./);
        });
      });
    }
  });
}
