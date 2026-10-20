/**
 * How a wet round is shown.
 *
 * The badge itself is a pure function of a `RaceWeather`, so most of this is
 * rendered straight; the two places it has to appear in a real season — the
 * calendar on the summary, and the round's own header — are rendered from a
 * world *searched* for one that rained, per the rule in `CLAUDE.md`: which
 * seeds are wet is a fact about the dice, not something a test may pin.
 */

import { type RaceWeather, WEATHER_CONSTANTS } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { findWorld, type seededWorld, shownAt } from "../test-support.js";
import { SeasonCalendar } from "./SeasonCalendar.js";
import { SeasonView } from "./SeasonView.js";
import { RAIN_WORDS, rainWord, WeatherBadge, wetnessPercent } from "./WeatherBadge.js";

const DRY_WEATHER: RaceWeather = { wet: false, wetness: 0 };

/** A season with at least one wet round, and which round it was. */
function wetSeason(): { world: ReturnType<typeof seededWorld>; round: number } {
  const world = findWorld((candidate) => candidate.season.races.some((race) => race.weather.wet), {
    seeds: 500,
  });
  const round = world.season.races.findIndex((race) => race.weather.wet);
  return { world, round };
}

describe("the weather badge", () => {
  it("says nothing at all about a dry race", () => {
    // Six rounds in seven are dry, and a calendar reading "Dry" all the way down
    // is a column that says nothing — the same argument the classification's
    // status column already makes.
    expect(renderToStaticMarkup(<WeatherBadge weather={DRY_WEATHER} />)).toBe("");
  });

  it("draws the cloud and a word on a wet one, with the percentage in its tooltip", () => {
    const weather = { wet: true, wetness: 0.62 };
    const html = renderToStaticMarkup(<WeatherBadge weather={weather} />);
    expect(html).toContain("<svg");
    expect(html).toContain(`>${rainWord(weather)}</span>`);
    expect(html).toMatch(/ title="[^"]*62% wet/);
  });

  it("cuts the engine's wetness range into one third per word, lightest first", () => {
    const { wetnessFloor, wetnessCeiling } = WEATHER_CONSTANTS;
    const at = (share: number) =>
      rainWord({ wet: true, wetness: wetnessFloor + share * (wetnessCeiling - wetnessFloor) });
    expect(at(0)).toBe(RAIN_WORDS[0]);
    expect(at(0.3)).toBe(RAIN_WORDS[0]);
    expect(at(0.36)).toBe(RAIN_WORDS[1]);
    expect(at(0.64)).toBe(RAIN_WORDS[1]);
    expect(at(0.7)).toBe(RAIN_WORDS[2]);
    expect(at(1)).toBe(RAIN_WORDS[2]);
  });

  it("reports wetness as whole percentage points", () => {
    // Not because a fraction would be wrong, but because nothing else on the
    // page claims a precision the model does not have.
    expect(wetnessPercent({ wet: true, wetness: 0.2 })).toBe(20);
    expect(wetnessPercent({ wet: true, wetness: 0.876 })).toBe(88);
    expect(wetnessPercent(DRY_WEATHER)).toBe(0);
  });
});

describe("a wet round in a season", () => {
  const { world, round } = wetSeason();

  it("is marked in the summary's calendar, and only where it rained", () => {
    const html = renderToStaticMarkup(
      <SeasonCalendar
        season={world.season}
        calendar={[]}
        points={world.points}
        teamFor={new Map()}
      />,
    );
    const wetRounds = world.season.races.filter((race) => race.weather.wet);
    // One badge per wet round, found by the percentage its tooltip states, so a
    // dry season would render none and a wet one cannot quietly render two.
    for (const race of wetRounds) {
      expect(html).toContain(`${wetnessPercent(race.weather)}% wet`);
    }
    // Counted on the badge's own `title` attribute: the label also appears
    // inside the icon twice over (`aria-label` and `<title>`), so a bare text
    // match would count three per round and say nothing about how many.
    expect((html.match(/ title="[^"]*% wet/g) ?? []).length).toBe(wetRounds.length);
  });

  it("is stated on the race screen and on its qualifying", () => {
    const race = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "race", round })} />);
    const qualifying = renderToStaticMarkup(
      <SeasonView {...shownAt(world, { kind: "qualifying", round })} />,
    );
    const weather = world.season.races[round]?.weather;
    if (weather === undefined) {
      throw new Error("no wet round found");
    }
    // Both sessions, because the weather belongs to the weekend: it widens
    // qualifying's noise and shifts its weights exactly as it does the race's.
    expect(race).toContain(`${wetnessPercent(weather)}%`);
    expect(qualifying).toContain(`${wetnessPercent(weather)}%`);
  });

  it("leaves a dry round's header alone", () => {
    const dryRound = world.season.races.findIndex((race) => !race.weather.wet);
    if (dryRound === -1) {
      // A season with no dry round at all is possible and would make this
      // vacuous, so say so rather than passing quietly.
      throw new Error("the searched season has no dry round to compare against");
    }
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(world, { kind: "race", round: dryRound })} />,
    );
    expect(html).not.toContain("Wet race");
  });
});
