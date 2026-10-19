/**
 * Team colours: how a livery is resolved for a season, how a badge is drawn
 * from it, and where both appear.
 *
 * **No authored colour is asserted here.** Which red Ferrari is, and whether a
 * team wears stripes, is seed data that will be edited for years — so the
 * geometry is checked against synthetic liveries, and everything that touches
 * the real files checks a *rule* over whatever those files happen to hold.
 */

import type { Livery, Team } from "@alt-hist/data";
import { seasonSeed, seasons, teamLiveryIn, teamsById } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { legible, liveryFor } from "../lib/livery.js";
import type { SeasonTab } from "../lib/season-tabs.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { NAME_TARGET, SeasonGrid } from "./SeasonGrid.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonView } from "./SeasonView.js";
import {
  BADGE_SHAPE,
  badgeBackground,
  CORNER_SASH,
  CORNER_SHAPE,
  cornerBackground,
  LiveryCorner,
  TeamBadge,
} from "./TeamBadge.js";

/** A livery whose four values are distinguishable in a gradient string. */
function livery(badgeStripes: number): Livery {
  return {
    primaryColor: "#111111",
    secondaryColor1: "#222222",
    secondaryColor2: "#333333",
    badgeStripes,
  };
}

/** Every colour stop in a gradient, as `[colour, percentage]` pairs, in order. */
function stops(background: string): readonly (readonly [string, number])[] {
  return [...background.matchAll(/(#[0-9A-Fa-f]{6}) (\d+(?:\.\d+)?)%/g)].map(
    ([, color, percent]) => [color as string, Number(percent)] as const,
  );
}

const someTeamId = [...teamsById().keys()][0] ?? "";

/**
 * Badges in a rendered tree, counted by the badge's own class string.
 *
 * Not by `aria-hidden`: chevrons, spacers and the theme toggle carry it too, so
 * that count is right only in a tree with none of them — which is exactly how
 * it passed here while silently counting the wrong things elsewhere.
 */
function badgeCount(html: string): number {
  return html.split(BADGE_SHAPE).length - 1;
}

describe("the badge", () => {
  it("draws a plain disc when a team wears no stripes", () => {
    // Not a gradient with two identical stops: nothing to draw is nothing to
    // draw, and the accents stay authored for use elsewhere.
    expect(badgeBackground(livery(0))).toBe("#111111");
  });

  it("draws one stripe in the first accent, and never the second", () => {
    const background = badgeBackground(livery(1));
    expect(background).toContain("#222222");
    expect(background).not.toContain("#333333");
    expect(stops(background).filter(([color]) => color === "#222222")).toHaveLength(2);
  });

  it("draws both accents when a team wears two stripes", () => {
    const background = badgeBackground(livery(2));
    expect(background).toContain("#222222");
    expect(background).toContain("#333333");
  });

  it("butts the two stripes together with no gap between them", () => {
    // The point of the shape: one sash split in two, not two separate marks.
    // A gap would be the first accent ending before the second begins.
    const parsed = stops(badgeBackground(livery(2)));
    const firstEnds = parsed.findLast(([color]) => color === "#222222")?.[1];
    const secondBegins = parsed.find(([color]) => color === "#333333")?.[1];
    expect(firstEnds).toBeDefined();
    expect(secondBegins).toBe(firstEnds);
  });

  it("centres the stripes, and gives one the same width as two", () => {
    // A 1-stripe badge and a 2-stripe badge carry the same weight of colour,
    // so a team is not made louder by splitting its sash.
    const span = (parsed: readonly (readonly [string, number])[]) =>
      [parsed[0]?.[1] ?? 0, parsed.at(-1)?.[1] ?? 0] as const;
    const one = span(stops(badgeBackground(livery(1))));
    expect(one).toEqual(span(stops(badgeBackground(livery(2)))));
    const [from, to] = one;
    expect(to).toBeGreaterThan(from);
    // Equidistant from the centre is what makes the sash sit across the middle.
    expect(from + to).toBe(100);
  });

  it("draws nothing for a team the seed data does not know", () => {
    expect(renderToStaticMarkup(<TeamBadge teamId="not-a-team" />)).toBe("");
  });

  it("is hidden from screen readers, since the team is named beside it", () => {
    expect(renderToStaticMarkup(<TeamBadge teamId={someTeamId} />)).toContain('aria-hidden="true"');
  });
});

describe("resolving a livery", () => {
  it("gives every authored team a complete, well-formed livery", () => {
    // The rule, over whatever the file holds — not a colour written down here.
    expect(teamsById().size).toBeGreaterThan(0);
    for (const [teamId] of teamsById()) {
      const resolved = liveryFor(teamId);
      expect(resolved, teamId).toBeDefined();
      for (const color of [
        resolved?.primaryColor,
        resolved?.secondaryColor1,
        resolved?.secondaryColor2,
      ]) {
        expect(color, teamId).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      expect([0, 1, 2], teamId).toContain(resolved?.badgeStripes);
    }
  });

  it("prefers a season's own override, and otherwise the era, in every season", () => {
    // Loops every authored year rather than naming one: a livery era added to
    // 1976 next week is covered without an edit here.
    let overrides = 0;
    for (const season of seasons.values()) {
      for (const entry of seasonSeed(season.year).entries) {
        const where = `${season.year} ${entry.teamId}`;
        const team = teamsById().get(entry.teamId);
        const resolved = liveryFor(entry.teamId, season.year);
        if (entry.primaryColor === undefined) {
          expect(resolved, where).toEqual(teamLiveryIn(team as Team, season.year));
          continue;
        }
        overrides += 1;
        expect(resolved?.primaryColor, where).toBe(entry.primaryColor);
        expect(resolved?.secondaryColor1, where).toBe(entry.secondaryColor1);
        expect(resolved?.secondaryColor2, where).toBe(entry.secondaryColor2);
        expect(resolved?.badgeStripes, where).toBe(entry.badgeStripes);
      }
    }
    // No season declares an override today — the eras absorbed all 83 of them —
    // so the branch above is unreached rather than passing vacuously, and this
    // says so out loud instead of leaving a silent zero.
    expect(overrides, "a season now declares a livery override; assert it").toBe(0);
  });

  it("changes a team's livery at an era boundary and not between", () => {
    // The guard the override count used to be. Without it every assertion in
    // the season loop above could be one unchanging colour per team and pass.
    const changed = [...teamsById().values()].filter((team) => {
      const drawn = [...seasons.keys()].map((year) => liveryFor(team.id, year)?.primaryColor);
      return new Set(drawn).size > 1;
    });
    expect(changed.length).toBeGreaterThan(0);
    for (const team of changed) {
      const boundaries = new Set(team.liveries.map((era) => era.from));
      for (const year of seasons.keys()) {
        const before = liveryFor(team.id, year - 1);
        const now = liveryFor(team.id, year);
        if (before !== undefined && now !== undefined && before.primaryColor !== now.primaryColor) {
          expect(boundaries, `${team.id} changed colour in ${year}`).toContain(year);
        }
      }
    }
  });

  it("falls back to the team's most recent livery outside a season", () => {
    for (const [teamId, team] of teamsById()) {
      expect(liveryFor(teamId), teamId).toEqual(team.liveries[team.liveries.length - 1]);
    }
  });

  it("does not throw on a year nobody has authored", () => {
    expect(() => liveryFor(someTeamId, 1066)).not.toThrow();
  });
});

describe("where liveries appear", () => {
  const world = seededWorld();
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }

  const classification = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <RaceClassification race={race} points={world.points} badge />
    </Liveries>,
  );

  it("puts a badge on every row of the race classification", () => {
    // Counted off the field rather than a written-down grid size.
    expect(badgeCount(classification)).toBe(race.entries.length);
  });

  it("draws the badge left of the driver's flag, not right of it", () => {
    // Two things, because either alone can be defeated: the badge comes first
    // in the markup, *and* nothing reverses the row visually afterwards. The
    // second half was added when flipping the container to `flex-row-reverse`
    // moved the badge to the right of the flag with this test still green.
    expect(classification.indexOf(BADGE_SHAPE)).toBeLessThan(classification.indexOf("<svg"));
    expect(classification).not.toContain("row-reverse");
  });

  it("still draws exactly one flag per row beside the badge", () => {
    // The badge is a styled span precisely so it does not disturb this count.
    expect(classification.split("<svg").length - 1).toBe(race.entries.length);
  });

  const grid = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={world.ratingMode} />,
  );

  /** Grid cards whose team has colours to draw — the rest wear no badge. */
  const badgedCards = [...new Set(world.field.map((entrant) => entrant.teamId))].filter(
    (teamId) => liveryFor(teamId, YEAR) !== undefined,
  ).length;

  it("puts a badge on every grid card beside the team's flag", () => {
    // Counted off the field rather than a written-down number of teams, and
    // against the flags in the same headers: one badge per card, no more.
    expect(badgeCount(grid)).toBe(badgedCards);
  });

  it("draws the grid card's badge after its flag and before the team name", () => {
    // Scoped to one card header rather than to the whole page: a bare
    // "an svg appears before a badge somewhere in this markup" would pass on
    // any icon anywhere above the grid, and assert nothing.
    const badgeAt = grid.indexOf(BADGE_SHAPE);
    const beforeTheBadge = grid.slice(grid.lastIndexOf(NAME_TARGET, badgeAt), badgeAt);
    expect(beforeTheBadge).toContain("<svg");
    // The name is the truncating span, and it has not been drawn yet.
    expect(beforeTheBadge).not.toContain("truncate");
    // As in the classification: order in the markup is only half of it if the
    // row is then flipped visually.
    expect(grid).not.toContain("row-reverse");
  });

  it("puts its team's sash in the corner of every grid card", () => {
    // Counted off the field, like the badges: one corner per card with colours.
    expect(grid.split(CORNER_SHAPE).length - 1).toBe(badgedCards);
    for (const entrant of world.field) {
      const resolved = liveryFor(entrant.teamId, YEAR);
      if (resolved === undefined) {
        continue;
      }
      expect(grid, entrant.teamId).toContain(`background:${cornerBackground(resolved)}`);
    }
  });

  /** The finished season's page, on one tab. */
  const summaryTab = (tab: SeasonTab) =>
    renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonView {...shownAt(world, { kind: "summary" })} tab={tab} />
      </Liveries>,
    );

  const qualifying = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <QualifyingResults race={race} />
    </Liveries>,
  );

  it("puts a badge in every slot of the starting grid", () => {
    expect(badgeCount(qualifying)).toBe(race.entries.length);
  });

  it("badges both champions, both standings tables and every pole and winner", () => {
    // Counted against what the season actually holds rather than a written-down
    // total: two champion boxes, a pole and a winner per round, and a row per
    // competitor in each championship table.
    const drivers = championshipStandings(world.season, world.points).length;
    const teams = constructorStandings(world.season, world.points).length;
    const rounds = world.season.races.length;
    // The champions head the standings tab; the tables, the calendar and the
    // grid panel (which badges its cards too) are one tab each.
    expect(badgeCount(summaryTab("standings"))).toBe(2 + drivers + teams);
    expect(badgeCount(summaryTab("calendar"))).toBe(2 * rounds);
    expect(badgeCount(summaryTab("grid"))).toBe(badgedCards);
  });
});

describe("keeping badges out of what a click opens", () => {
  // Everything that only appears after a click stays a step down in weight: an
  // expansion repeating the screen the reader just left is noise, not detail.
  const world = seededWorld();
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }

  it("draws none in a race sheet opened out of the calendar", () => {
    // The same component the race screen badges, asked not to here.
    const expansion = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <RaceClassification race={race} points={world.points} />
      </Liveries>,
    );
    expect(badgeCount(expansion)).toBe(0);
  });

  it("draws none in championship tables opened out of the roll of honour", () => {
    const expansion = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonStandings
          season={world.season}
          calendar={SEED.calendar}
          points={world.points}
          label="Final"
        />
      </Liveries>,
    );
    expect(badgeCount(expansion)).toBe(0);
  });

  it("badges the same tables when they are the screen rather than an expansion", () => {
    // The other half of the rule: the prop is what decides, so the summary's
    // own copy of these tables must still carry them.
    const onScreen = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonStandings
          season={world.season}
          calendar={SEED.calendar}
          points={world.points}
          label="Final"
          badge
        />
      </Liveries>,
    );
    expect(badgeCount(onScreen)).toBeGreaterThan(0);
  });
});

describe("the grid card's corner", () => {
  it("draws the badge's sash, with the same stripes", () => {
    // The badge's rule, along the corner's axis: every colour the badge shows,
    // and no accent it hides.
    for (const stripes of [0, 1, 2]) {
      const corner = cornerBackground(livery(stripes));
      for (const [colour] of stops(badgeBackground(livery(stripes)))) {
        expect(corner).toContain(colour);
      }
      expect(corner.includes("#222222")).toBe(stripes >= 1);
      expect(corner.includes("#333333")).toBe(stripes >= 2);
    }
  });

  it("edges the corner in the card's own border colour, even when it matches the card", () => {
    // A white sash on the light theme's white card is drawn by this line alone.
    const white: Livery = {
      primaryColor: "#FFFFFF",
      secondaryColor1: "#FFFFFF",
      secondaryColor2: "#FFFFFF",
      badgeStripes: 0,
    };
    const html = renderToStaticMarkup(<LiveryCorner livery={white} />);
    // The triangle is filled with the border colour, and the sash sits inside it.
    expect(CORNER_SHAPE).toContain("bg-border");
    expect(html.indexOf(CORNER_SASH)).toBeGreaterThan(html.indexOf(CORNER_SHAPE));
    expect(html.endsWith("</span></span>")).toBe(true);
    // Its diagonal moved in, so a line of the border colour shows along the cut.
    const inset = Number(/polygon\(([\d.]+)px_0/.exec(CORNER_SASH)?.[1]);
    expect(inset).toBeGreaterThan(0);
  });
});

describe("a team colour drawn as a line", () => {
  // The mechanism, not the numbers: the pull is toward a *theme variable*
  // rather than a baked colour, which is what lets it follow a light/dark switch.
  it("pulls toward the theme's foreground so it cannot vanish", () => {
    const line = legible("#FFFFFF");
    expect(line).toContain("var(--color-foreground)");
    expect(line).toContain("#FFFFFF");
  });

  it("uses only CSS the rest of the app already relies on", () => {
    // Relative colour syntax (`oklch(from ...)`) shipped once and is newer than
    // this app's baseline: where it is missing the declaration is invalid and
    // the colour silently vanishes.
    expect(legible("#FFFFFF")).not.toContain("oklch(from");
    expect(legible("#FFFFFF")).toContain("color-mix(");
  });

  it("never leaves the team colour at full strength", () => {
    // At 100% the mix is the raw colour again and the guarantee is gone, silently.
    const share = Number(/color-mix\(in oklab, [^,]+? (\d+)%/.exec(legible("#FFFFFF"))?.[1]);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(100);
  });
});
