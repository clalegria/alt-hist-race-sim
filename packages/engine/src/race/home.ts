/**
 * Who, on one entry, is racing at home.
 *
 * An entry has three allegiances — its driver, its team and its engine
 * supplier — and each is counted separately and stacks. A Frenchman in a
 * Ligier-Matra at Paul Ricard collects all three; a Brazilian in the same car
 * collects two; an Italian in a Cosworth-engined British car collects nothing
 * at Monza but its driver's share. A round with no host country hands out
 * nothing at all.
 *
 * Split out of `simulateRace` because the *flags* have a second reader: a
 * classification that marks a home entry has to mark exactly the ones the race
 * was scored on, and two spellings of "is this driver at home" would drift the
 * first time a country code was written with a stray space. The bonus is here
 * beside them for the same reason — one place that knows the rule.
 */

import type { RaceConstants } from "./constants.js";
import type { RaceEntrant, RoundContext } from "./types.js";

/** Which of an entry's three allegiances are at home this round. */
export interface HomeAllegiances {
  readonly driver: boolean;
  readonly team: boolean;
  readonly engine: boolean;
}

/** Nobody at home: a neutral round, and the shape a caller can compare against. */
export const AWAY: HomeAllegiances = { driver: false, team: false, engine: false };

/**
 * Whether two country codes are the same place. Case- and padding-insensitive,
 * and an absent code is nowhere: a field with no countries is never at home.
 */
export function sameCountry(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  const left = a.trim().toUpperCase();
  return left !== "" && left === b.trim().toUpperCase();
}

/** Which of this entry's allegiances the round is being held in. */
export function homeAllegiances(entrant: RaceEntrant, round: RoundContext): HomeAllegiances {
  return {
    driver: sameCountry(entrant.driverCountry, round.country),
    team: sameCountry(entrant.teamCountry, round.country),
    engine: sameCountry(entrant.engineCountry, round.country),
  };
}

/** Whether any of the three is at home — is this entry marked at all? */
export function isAtHome(allegiances: HomeAllegiances): boolean {
  return allegiances.driver || allegiances.team || allegiances.engine;
}

/** Rating points those allegiances are worth, added to *both* session scores. */
export function homeAdvantage(allegiances: HomeAllegiances, constants: RaceConstants): number {
  return (
    (allegiances.driver ? constants.homeAdvantageDriver : 0) +
    (allegiances.team ? constants.homeAdvantageTeam : 0) +
    (allegiances.engine ? constants.homeAdvantageEngine : 0)
  );
}
