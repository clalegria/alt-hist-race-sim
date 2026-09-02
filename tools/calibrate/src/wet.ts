/**
 * Forcing a race's weather from the command line.
 *
 * The sim rolls its own weather — about one round in seven is wet — which is
 * exactly right for a season and useless for looking at one: a reader who wants
 * to see what a downpour does to the 1980 grid should not have to try seeds
 * until it rains.
 *
 *   pnpm race 7 --wet 0.8    # the same race, run in a soaking
 *   pnpm race 7 --wet 0      # forced dry, whatever the dice said
 *   pnpm race 7              # rolled, like a real round
 *
 * The roll still happens either way, so a forced afternoon costs nobody their
 * position in the RNG stream and `--wet` is a comparison rather than a
 * different race.
 *
 * Throws on anything outside 0-1, for the reason `parseYear` and `parsePhase`
 * do: a silent fallback prints one run's numbers under another run's heading.
 *
 * The *season* harnesses take no such flag, and for the same reason they take
 * no `--phase`: a season rolls its own weather round by round, and forcing
 * every round of a year to the same sky would measure something no season does.
 */

import { DRY, type RaceWeather, WEATHER_CONSTANTS } from "@alt-hist/engine";

/**
 * The weather named by `--wet <0-1>`, or undefined to let the round roll its
 * own.
 *
 * `--wet 0` is a forced *dry* race rather than a very slightly wet one: below
 * the wetness floor there is no such thing as a wet round, and "0% wet" is the
 * clearest way to ask for the dry comparison.
 */
export function parseWet(argv: readonly string[]): RaceWeather | undefined {
  const flag = argv.findIndex((arg) => arg === "--wet" || arg === "-w");
  if (flag === -1) {
    return undefined;
  }

  const raw = argv[flag + 1];
  const parsed = raw === undefined ? Number.NaN : Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`--wet needs a wetness from 0 to 1, received "${raw ?? ""}"`);
  }
  if (parsed === 0) {
    return DRY;
  }
  return { wet: true, wetness: Math.max(parsed, WEATHER_CONSTANTS.wetnessFloor) };
}

/** How a run says what the sky did, in its own heading. */
export function wetLabel(weather: RaceWeather): string {
  return weather.wet ? `wet — ${Math.round(weather.wetness * 100)}% wet` : "dry";
}
