/**
 * The season's page, the links around a session, and the era overview's year
 * in progress — each rendered at a cursor partway through the year, as the
 * gate hands it to a page. Counts come off the world, never a seed's outcome.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eraChampions } from "../lib/era.js";
import { STANDOUT_ROW } from "../lib/highlight.js";
import { teamRounds } from "../lib/results.js";
import { revealYear } from "../lib/reveal.js";
import { PAGE_OF } from "../lib/roster-places.js";
import { seasonTabLinks } from "../lib/season-tabs.js";
import { racePage, roundPages, sessionNav } from "../lib/session-nav.js";
import type { Beat } from "../lib/timeline.js";
import { inRouter } from "../test-router.js";
import { SEED, seededWorld, YEAR } from "../test-support.js";
import { ChampionRow, EraChampions } from "./EraChampions.js";
import { RaceByRace } from "./RaceByRace.js";
import { CalendarRow, NOT_YET } from "./SeasonCalendar.js";
import { SeasonHistoryProvider } from "./SeasonHistory.js";
import { SeasonView } from "./SeasonView.js";

const world = seededWorld(3, "aged", YEAR);
const ROUNDS = world.season.races.length;
/** A round in the middle of the season, so rounds lie on both sides of it. */
const MID = Math.floor(ROUNDS / 2);

/** The season's page as a reader at `cursor` gets it: the year cut there, not finished. */
const seasonPage = (cursor: Beat, tab: "standings" | "calendar" | "grid") =>
  renderToStaticMarkup(
    <SeasonView
      world={revealYear(world, cursor)}
      view={{ kind: "summary" }}
      finished={cursor.kind === "summary"}
      tab={tab}
    />,
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("the season's page, partway through the year", () => {
  it("lists every round on the calendar, opening only the ones raced", () => {
    const html = seasonPage({ kind: "race", round: MID }, "calendar");
    expect(count(html, "<tr")).toBe(1 + SEED.calendar.length);
    expect(count(html, "aria-expanded")).toBe(MID + 1);
    for (const race of SEED.calendar) {
      expect(html, race.name).toContain(race.name);
    }
  });

  it("names no pole or winner for a round not reached", () => {
    const html = seasonPage({ kind: "race", round: MID }, "calendar");
    expect(count(html, `title="${NOT_YET}"`)).toBe(2 * (ROUNDS - MID - 1));
  });

  it("shows the pole of a round whose qualifying alone is revealed, and not its winner", () => {
    const html = seasonPage({ kind: "qualifying", round: MID }, "calendar");
    expect(count(html, `title="${NOT_YET}"`)).toBe(2 * (ROUNDS - MID) - 1);
    expect(count(html, "aria-expanded")).toBe(MID);
  });

  it("says how far the season has got, and crowns nobody", () => {
    const html = seasonPage({ kind: "race", round: MID }, "standings");
    expect(html).toContain(`After round ${MID + 1} of ${ROUNDS}.`);
    expect(html).not.toContain("champion");
    expect(html).toContain("Drivers’ Championship");
  });

  it("has no tables to show before the first race", () => {
    const html = seasonPage({ kind: "grid" }, "standings");
    expect(html).toContain("No round raced yet.");
    expect(html).not.toContain("Drivers’ Championship");
  });

  it("crowns the champions once the summary is reached", () => {
    const html = seasonPage({ kind: "summary" }, "standings");
    expect(html).toContain("Drivers’ champion");
    expect(html).toContain("Final classification.");
  });

  it("links every tab but the one on screen, the standings at the season's own address", async () => {
    const html = await inRouter(
      <SeasonView
        world={revealYear(world, { kind: "race", round: MID })}
        view={{ kind: "summary" }}
        finished={false}
        tab="calendar"
        tabs={seasonTabLinks(YEAR, "calendar")}
      />,
    );
    const tabs = html.slice(html.indexOf('<nav aria-label="Season"'), html.indexOf("</nav>"));
    expect(tabs).toMatch(/aria-current="page"[^>]*>Calendar</);
    expect(count(tabs, 'aria-current="page"')).toBe(1);
    expect(tabs).toContain(`href="/run/${YEAR}"`);
    expect(tabs).toContain(`href="/run/${YEAR}?tab=grid"`);
    expect(tabs).not.toContain("?tab=calendar");
  });
});

describe("the links around a session", () => {
  const page = (cursor: Beat, shown: Beat) =>
    inRouter(
      <SeasonView
        world={revealYear(world, cursor)}
        view={shown as Exclude<Beat, { kind: "review" }>}
        sessionNav={sessionNav({ year: YEAR, beat: cursor }, { year: YEAR, beat: shown }, ROUNDS)}
      />,
    );

  it("disable the race and the next round while the cursor is on this qualifying", async () => {
    const html = await page({ kind: "qualifying", round: MID }, { kind: "qualifying", round: MID });
    expect(html).toMatch(/aria-disabled="true"[^>]*>Race</);
    expect(html).toContain(`Round ${MID + 2} (not yet)`);
    expect(html).not.toContain(`/round/${MID + 2}/`);
    expect(html).toContain(`href="/run/${YEAR}/round/${MID}/qualifying"`);
  });

  it("link the next round once it is reached, and the race beside its qualifying", async () => {
    const html = await page({ kind: "summary" }, { kind: "qualifying", round: MID });
    expect(html).toContain(`href="/run/${YEAR}/round/${MID + 1}/race"`);
    expect(html).toContain(`href="/run/${YEAR}/round/${MID + 2}/qualifying"`);
    expect(html).not.toContain("(not yet)");
  });

  it("name the round in the page's header", async () => {
    const html = await page({ kind: "summary" }, { kind: "race", round: MID });
    expect(html).toContain(SEED.calendar[MID]?.name ?? "missing");
    expect(html).toContain(`Round ${MID + 1} of ${ROUNDS}`);
  });
});

describe("the era overview's year in progress", () => {
  const next = seededWorld(4, "aged", YEAR + 1);
  const run = { startYear: YEAR, seasons: [world] };

  it("follows the crowned years with the year under way, without the accent", () => {
    const html = renderToStaticMarkup(
      <EraChampions run={run} inProgress={revealYear(next, { kind: "race", round: 0 })} />,
    );
    expect(html).toContain("in progress, leaders after round 1");
    expect(html).toContain(`${YEAR + 1} is under way.`);
    expect(count(html, STANDOUT_ROW)).toBe(1);
  });

  it("is left off on the review, where the year has been crowned", () => {
    const html = renderToStaticMarkup(<EraChampions run={run} inProgress={null} />);
    expect(html).not.toContain("in progress");
    expect(html).toContain(`Next comes`);
  });

  it("is all there is before the first year is crowned", () => {
    const html = renderToStaticMarkup(
      <EraChampions
        run={{ startYear: YEAR, seasons: [] }}
        inProgress={revealYear(world, { kind: "grid" })}
      />,
    );
    expect(html).toContain("No season finished yet.");
    expect(html).toContain("on the grid");
    expect(count(html, STANDOUT_ROW)).toBe(0);
  });
});

describe("the links out of an opened row", () => {
  const race = world.season.races[MID];
  const teamFor = new Map(world.field.map((entrant) => [entrant.driverId, entrant.teamId]));
  const calendarRow = (pages: boolean) => (
    <table>
      <tbody>
        {race === undefined ? null : (
          <CalendarRow
            index={MID}
            round={SEED.calendar[MID]}
            race={race}
            points={world.points}
            teamFor={teamFor}
            open
            onToggle={() => {}}
            pages={pages ? roundPages(YEAR, MID) : undefined}
          />
        )}
      </tbody>
    </table>
  );

  it("lead from a calendar round to its race page, from the row itself", async () => {
    const html = await inRouter(calendarRow(true));
    expect(html).toContain(`href="/run/${YEAR}/round/${MID + 1}/race"`);
  });

  it("link every round raced from the calendar, the pending round's qualifying, and none ahead", async () => {
    const html = await inRouter(
      <SeasonView
        world={revealYear(world, { kind: "qualifying", round: MID })}
        view={{ kind: "summary" }}
        finished={false}
        tab="calendar"
        pagesOf={(round) => roundPages(YEAR, round)}
      />,
    );
    const races = [...html.matchAll(/href="[^"]*\/round\/(\d+)\/race"/g)].map((m) => Number(m[1]));
    expect(races).toEqual(Array.from({ length: MID }, (_, round) => round + 1));
    const qualifying = [...html.matchAll(/href="[^"]*\/round\/(\d+)\/qualifying"/g)].map((m) =>
      Number(m[1]),
    );
    expect(qualifying).toEqual([MID + 1]);
  });

  it("lead from every year of the roll of honour to its season page, without opening it", async () => {
    // The row itself carries the link, so a closed row has it too — the
    // crowned years and the year in progress alike, one link apiece.
    const next = seededWorld(4, "aged", YEAR + 1);
    const html = await inRouter(
      <EraChampions
        run={{ startYear: YEAR, seasons: [world] }}
        inProgress={revealYear(next, { kind: "race", round: 0 })}
        seasonLink={PAGE_OF.season}
      />,
    );
    expect(html).not.toContain('aria-expanded="true"');
    for (const year of [YEAR, YEAR + 1]) {
      expect(count(html, `href="/run/${year}"`), `${year}`).toBe(1);
    }
  });

  it("leave an opened year's panel to the tables, the link staying on its row", async () => {
    const champions = eraChampions([world])[0];
    if (champions === undefined) {
      throw new Error("no season to crown");
    }
    const html = await inRouter(
      <table>
        <tbody>
          <ChampionRow
            season={champions}
            latest
            open
            onToggle={() => {}}
            seasonLink={PAGE_OF.season}
          />
        </tbody>
      </table>,
    );
    expect(count(html, `href="/run/${YEAR}"`)).toBe(1);
    expect(html).not.toContain("season page →");
  });

  it("lead from each round of a race by race to its race, once a round, inside a run only", async () => {
    // A team's, so a round with two cars in it still links once; cut partway,
    // so only the rounds the reader has reached are there to link.
    const live = revealYear(world, { kind: "race", round: MID });
    const teamId = world.field[0]?.teamId ?? "";
    const rounds = teamRounds(live.season, live.points, teamId);
    const raced = [...new Set(rounds.map((each) => each.round + 1))];
    expect(raced.length).toBeGreaterThan(0);
    const panel = <RaceByRace rounds={rounds} calendar={SEED.calendar} year={YEAR} showDriver />;
    const html = await inRouter(
      <SeasonHistoryProvider seasons={[live]} racePage={racePage}>
        {panel}
      </SeasonHistoryProvider>,
    );
    const linked = [...html.matchAll(/href="\/run\/(\d+)\/round\/(\d+)\/race"/g)];
    expect(linked.map((m) => Number(m[1]))).toEqual(raced.map(() => YEAR));
    expect(linked.map((m) => Number(m[2]))).toEqual(raced);
    expect(renderToStaticMarkup(panel)).not.toContain("<a ");
  });

  it("are not drawn without the links, as in a test with no router", () => {
    expect(renderToStaticMarkup(calendarRow(false))).not.toContain("<a ");
  });
});
