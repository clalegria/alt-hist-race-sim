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
import { cardOutline, cardTint, liveryFor } from "../lib/livery.js";
import { SEED, seededWorld, teamCount, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { NAME_TARGET, SeasonGrid } from "./SeasonGrid.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonView } from "./SeasonView.js";
import { BADGE_SHAPE, badgeBackground, TeamBadge } from "./TeamBadge.js";

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

  it("washes every grid card toward its team's primary colour", () => {
    const cards = teamCount(world);
    expect(grid.split("background-image:").length - 1).toBe(cards);
    for (const entrant of world.field) {
      const resolved = liveryFor(entrant.teamId, YEAR);
      if (resolved === undefined) {
        continue;
      }
      expect(grid, entrant.teamId).toContain(resolved.primaryColor);
    }
  });

  const summary = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <SeasonView world={world} view={{ kind: "summary" }} />
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
    // Plus the grid panel below the tables, which badges its cards too.
    expect(badgeCount(summary)).toBe(2 + drivers + teams + 2 * rounds + badgedCards);
  });

  it("outlines every grid card in its team's first accent", () => {
    const cards = teamCount(world);
    expect(grid.split("border-color:").length - 1).toBe(cards);
    for (const entrant of world.field) {
      const resolved = liveryFor(entrant.teamId, YEAR);
      if (resolved === undefined) {
        continue;
      }
      expect(grid, entrant.teamId).toContain(resolved.secondaryColor1);
    }
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
          description="Final classification."
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
          description="Final classification."
          badge
        />
      </Liveries>,
    );
    expect(badgeCount(onScreen)).toBeGreaterThan(0);
  });
});

describe("keeping team colours off the theme", () => {
  // The mechanism, not the numbers: both the wash and the outline are mixed
  // against a *theme variable* rather than baked, which is what lets them
  // follow a light/dark switch instead of being computed for one of them.
  const white: Livery = {
    primaryColor: "#FFFFFF",
    secondaryColor1: "#FFFFFF",
    secondaryColor2: "#FFFFFF",
    badgeStripes: 0,
  };

  const black: Livery = {
    primaryColor: "#000000",
    secondaryColor1: "#000000",
    secondaryColor2: "#000000",
    badgeStripes: 0,
  };

  it("never washes a card with the team colour as authored", () => {
    // The bug this replaced: mixing a colour toward a surface it already
    // matches produces no wash at all — white teams looked ungradiented on the
    // light theme, near-black ones on the dark theme. Every team colour has to
    // go through the foreground pull before it reaches a surface, so the raw
    // value must never appear as a colour stop in its own right.
    for (const [colour, tinted] of [
      ["#FFFFFF", cardTint(white)],
      ["#000000", cardTint(black)],
    ] as const) {
      expect([...tinted.matchAll(new RegExp(colour, "g"))]).toHaveLength(1);
      expect(tinted).toContain(`${colour} ${100 - 28}%, var(--color-foreground)`);
    }
  });

  it("uses only CSS the rest of the app already relies on", () => {
    // Relative colour syntax (`oklch(from ...)`) clamped the lightness more
    // precisely and shipped once, but it is newer than this app's baseline:
    // where it is missing the whole declaration is invalid and the wash simply
    // vanishes, which is indistinguishable from the bug above.
    for (const value of [cardTint(white), cardOutline(white)]) {
      expect(value).not.toContain("oklch(from");
      expect(value).toContain("color-mix(");
    }
  });

  it("mixes a card's wash against the card colour, not a fixed one", () => {
    // The token has to be inside the `color-mix`, not merely somewhere in the
    // gradient: the wash ends on `var(--color-card)` regardless, so a plain
    // `toContain` stayed green when the mix itself was baked to a hex value.
    expect(cardTint(white)).toMatch(/color-mix\([^)]*var\(--color-card\)/);
    expect(cardTint(white)).toContain("#FFFFFF");
  });

  it("pulls an outline toward the theme's foreground so it cannot vanish", () => {
    // A white outline was invisible on the light theme. `--color-foreground` is
    // the far end of whichever theme is live, so mixing toward it separates the
    // outline from the card in both.
    const outline = cardOutline(white);
    expect(outline).toContain("var(--color-foreground)");
    expect(outline).toContain("#FFFFFF");
    expect(outline).not.toBe("#FFFFFF");
  });

  it("leaves neither colour at full strength", () => {
    // At 100% a mix is the raw team colour again and the guarantee is gone,
    // silently. Read off the mixes themselves rather than the whole string: the
    // wash legitimately ends on a `100%` gradient stop, which is a position and
    // not a share, and matching that made this test pass by accident.
    for (const mixed of [cardTint(white), cardOutline(white)]) {
      const shares = [...mixed.matchAll(/color-mix\(in oklab, [^,]+? (\d+)%/g)].map((match) =>
        Number(match[1]),
      );
      expect(shares.length).toBeGreaterThan(0);
      for (const share of shares) {
        expect(share).toBeGreaterThan(0);
        expect(share).toBeLessThan(100);
      }
    }
  });
});
