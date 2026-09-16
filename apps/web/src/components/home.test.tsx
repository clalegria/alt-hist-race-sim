/**
 * The star on an entry racing at home.
 *
 * Who is at home is the engine's rule, applied to the grid as it was raced, so
 * nothing here writes down a nationality or a count: each test picks a country
 * *out of the field* and then counts what that implies. The one thing asserted
 * directly is the agreement between the two — the mark on screen and
 * `homeAllegiances` — because a classification that starred a different set of
 * cars from the ones the race paid would be worse than no star at all.
 */

import { homeAllegiances, isAtHome, type RaceEntrant } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { homeAdvantageLabel } from "../lib/home.js";
import { seededWorld } from "../test-support.js";
import { HomeAdvantage } from "./HomeAdvantage.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";

const world = seededWorld();
const race = world.season.races[0];
if (race === undefined) {
  throw new Error("seeded world ran no races");
}

/** A country somebody on this grid is from, whatever the seed data says today. */
function countryOf(pick: (entrant: RaceEntrant) => string | undefined): string {
  for (const entrant of world.field) {
    const country = pick(entrant);
    if (country !== undefined && country !== "") {
      return country;
    }
  }
  throw new Error("no entrant on the grid carries that country");
}

/** How many cars the engine says are at home at a round held in `country`. */
function atHome(country: string | undefined): number {
  if (country === undefined) {
    return 0;
  }
  return world.field.filter((entrant) => isAtHome(homeAllegiances(entrant, { country }))).length;
}

/**
 * How many stars a sheet drew. Counted on the *tooltip attribute* rather than on
 * the phrase: the label is repeated inside the `<svg>` as an `aria-label` and a
 * `<title>`, so a plain text match counts every star three times.
 */
const stars = (html: string): number => (html.match(/title="Home race for/g) ?? []).length;

function quali(country?: string) {
  return renderToStaticMarkup(
    <HomeAdvantage field={world.field}>
      <QualifyingResults race={race as NonNullable<typeof race>} country={country} />
    </HomeAdvantage>,
  );
}

function classification(country?: string) {
  return renderToStaticMarkup(
    <HomeAdvantage field={world.field}>
      <RaceClassification
        race={race as NonNullable<typeof race>}
        points={world.points}
        country={country}
      />
    </HomeAdvantage>,
  );
}

describe("racing at home", () => {
  it("stars nobody at a round held nowhere the grid is from", () => {
    // A country code no entrant can carry, so the count is a rule rather than
    // a fact about which nationalities this season happens to enter.
    expect(stars(quali("ZZ"))).toBe(0);
    expect(stars(classification("ZZ"))).toBe(0);
  });

  it("stars nobody at all outside a round, where there is no host country", () => {
    expect(stars(quali())).toBe(0);
    expect(stars(classification())).toBe(0);
  });

  it("stars exactly the entries the race paid a home bonus to", () => {
    const home = countryOf((entrant) => entrant.driverCountry);
    const expected = atHome(home);
    // The country came off the grid, so somebody must be at home at it —
    // otherwise the two counts agreeing on zero would prove nothing.
    expect(expected).toBeGreaterThan(0);
    expect(stars(quali(home))).toBe(expected);
    expect(stars(classification(home))).toBe(expected);
  });

  it("stars a car whose team or engine is at home, not only its driver", () => {
    // Every allegiance counts separately in the engine, and a season where the
    // only home team is a driverless one would otherwise go unmarked.
    const base = countryOf((entrant) => entrant.teamCountry);
    const starred = world.field.filter((entrant) =>
      isAtHome(homeAllegiances(entrant, { country: base })),
    );
    const teamOnly = starred.filter(
      (entrant) => !homeAllegiances(entrant, { country: base }).driver,
    );
    expect(stars(classification(base))).toBe(starred.length);
    // The label has to name what was actually counted, so a team-only entry may
    // not be described as a home driver.
    for (const entrant of teamOnly) {
      const label = homeAdvantageLabel(homeAllegiances(entrant, { country: base }));
      expect(label).not.toContain("the driver");
    }
  });

  it("draws no star without the grid in scope, rather than throwing", () => {
    // Every DOM-less render of these tables is done outside a season, which is
    // the default the context exists to keep working.
    const home = countryOf((entrant) => entrant.driverCountry);
    const bare = renderToStaticMarkup(
      <RaceClassification race={race} points={world.points} country={home} />,
    );
    expect(stars(bare)).toBe(0);
  });
});
