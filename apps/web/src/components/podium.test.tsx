/**
 * The podium at the head of the race screen's classification: the top three
 * stand on it above the table, and nowhere else draws one.
 */

import type { RaceEntryResult, RaceResult } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatGap } from "../lib/format.js";
import { PODIUM_POSITION, STANDOUT_POSITION } from "../lib/highlight.js";
import { rowName, seededWorld, shownAt } from "../test-support.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld();
const race = world.season.races[0];
if (race === undefined) {
  throw new Error("seeded world has no races");
}

const PODIUM = 'aria-label="Podium"';

/** The podium's markup, list open to list close; empty when there is none. */
function podiumOf(html: string): string {
  const start = html.indexOf(PODIUM);
  return start === -1 ? "" : html.slice(start, html.indexOf("</ol>", start));
}

/** Each step of the podium, in the order the list holds them. */
function stepsOf(html: string): string[] {
  return podiumOf(html).split("<li").slice(1);
}

/** The table's body rows: the rows with cells rather than column heads. */
function bodyRows(html: string): string[] {
  return html
    .split("<tr")
    .slice(1)
    .filter((row) => row.includes("<td"));
}

/** The classified finishers in the top three, in finishing order. */
function podiumOrder(of: RaceResult): RaceEntryResult[] {
  return of.entries
    .filter((entry) => entry.finishPosition !== null && entry.finishPosition <= 3)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
}

function sheet(of: RaceResult, podium: boolean): string {
  return renderToStaticMarkup(
    <RaceClassification race={of} points={world.points} podium={podium} />,
  );
}

describe("the podium", () => {
  const html = sheet(race, true);
  const top = podiumOrder(race);

  it("stands the top three on it, in finishing order, and leaves them in the table", () => {
    const steps = stepsOf(html);
    expect(steps).toHaveLength(top.length);
    // The winner's name is drawn with emphasis, a weight up.
    top.forEach((entry, index) => {
      expect(steps[index]).toContain(rowName(entry.driverId, index === 0));
    });
    const rows = bodyRows(html);
    expect(rows).toHaveLength(race.entries.length);
    top.forEach((entry, index) => {
      expect(rows[index]).toContain(rowName(entry.driverId, index === 0));
    });
  });

  it("puts the gap and the points on one line under the number", () => {
    const [, second] = top;
    if (second?.raceGapToWinner == null) {
      throw new Error("the race has no classified second place");
    }
    const [, step] = stepsOf(html);
    expect(step).toContain(`${formatGap(second.raceGapToWinner)} · `);
  });

  it("puts second on the left and third on the right of the winner", () => {
    const [first, second, third] = stepsOf(html);
    expect(first).toContain("col-start-2");
    expect(second).toContain("col-start-1");
    expect(third).toContain("col-start-3");
  });

  it("fills the winner's block and marks the other two a step below", () => {
    const [first, ...rest] = stepsOf(html);
    expect(first).toContain(STANDOUT_POSITION);
    for (const step of rest) {
      expect(step).toContain(PODIUM_POSITION);
      expect(step).not.toContain(STANDOUT_POSITION);
    }
  });

  it("stands only the steps that have someone on them", () => {
    // The winner alone classified in the top three: second and third stopped.
    const [, second, third] = top;
    const stopped = new Set([second?.driverId, third?.driverId]);
    const short: RaceResult = {
      ...race,
      entries: race.entries.map((entry) =>
        stopped.has(entry.driverId)
          ? { ...entry, finishPosition: null, retired: true, raceGapToWinner: null }
          : entry,
      ),
    };
    const steps = stepsOf(sheet(short, true));
    expect(steps).toHaveLength(1);
    expect(steps[0]).toContain("col-start-2");
  });

  it("is drawn only when asked, so a round opened from the calendar keeps its whole table", () => {
    const whole = sheet(race, false);
    expect(whole).not.toContain(PODIUM);
    expect(bodyRows(whole)).toHaveLength(race.entries.length);
  });

  it("is on a race's page, and never on its qualifying", () => {
    const at = (view: Parameters<typeof shownAt>[1]) =>
      renderToStaticMarkup(<SeasonView {...shownAt(world, view)} />);
    expect(at({ kind: "race", round: 0 })).toContain(PODIUM);
    expect(at({ kind: "qualifying", round: 0 })).not.toContain(PODIUM);
  });
});
