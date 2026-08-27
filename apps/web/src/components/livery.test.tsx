/**
 * Team colours: how a livery is resolved for a season, how a badge is drawn
 * from it, and where both appear.
 *
 * **No authored colour is asserted here.** Which red Ferrari is, and whether a
 * team wears stripes, is seed data that will be edited for years — so the
 * geometry is checked against synthetic liveries, and everything that touches
 * the real files checks a *rule* over whatever those files happen to hold.
 */

import type { Livery } from "@alt-hist/data";
import { seasonSeed, seasons, teamsById } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardOutline, cardTint, liveryFor } from "../lib/livery.js";
import { seededWorld, teamCount, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { badgeBackground, TeamBadge } from "./TeamBadge.js";

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

  it("prefers a season's own livery over the team's default, in every season", () => {
    // Loops every authored year rather than naming the one that carries
    // overrides today: a livery added to 1976 next week is covered without an
    // edit here, and years with none still exercise the fallback.
    let overrides = 0;
    for (const season of seasons.values()) {
      for (const entry of seasonSeed(season.year).entries) {
        const where = `${season.year} ${entry.teamId}`;
        const resolved = liveryFor(entry.teamId, season.year);
        if (entry.primaryColor === undefined) {
          expect(resolved, where).toEqual(teamsById().get(entry.teamId));
          continue;
        }
        overrides += 1;
        expect(resolved?.primaryColor, where).toBe(entry.primaryColor);
        expect(resolved?.secondaryColor1, where).toBe(entry.secondaryColor1);
        expect(resolved?.secondaryColor2, where).toBe(entry.secondaryColor2);
        expect(resolved?.badgeStripes, where).toBe(entry.badgeStripes);
      }
    }
    // Guards the loop itself: with no overrides anywhere, every assertion above
    // would be the fallback and the override path would go unchecked.
    expect(overrides).toBeGreaterThan(0);
  });

  it("falls back to the team default outside a season", () => {
    for (const [teamId, team] of teamsById()) {
      expect(liveryFor(teamId), teamId).toEqual(team);
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
      <RaceClassification race={race} points={world.points} />
    </Liveries>,
  );

  it("puts a badge on every row of the race classification", () => {
    // Counted off the field rather than a written-down grid size.
    expect(classification.split('aria-hidden="true"').length - 1).toBe(race.entries.length);
  });

  it("draws the badge left of the driver's flag, not right of it", () => {
    // Two things, because either alone can be defeated: the badge comes first
    // in the markup, *and* nothing reverses the row visually afterwards. The
    // second half was added when flipping the container to `flex-row-reverse`
    // moved the badge to the right of the flag with this test still green.
    expect(classification.indexOf('aria-hidden="true"')).toBeLessThan(
      classification.indexOf("<svg"),
    );
    expect(classification).not.toContain("row-reverse");
  });

  it("still draws exactly one flag per row beside the badge", () => {
    // The badge is a styled span precisely so it does not disturb this count.
    expect(classification.split("<svg").length - 1).toBe(race.entries.length);
  });

  const grid = renderToStaticMarkup(
    <SeasonGrid field={world.field} seasonYear={YEAR} ratingMode={world.ratingMode} />,
  );

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
