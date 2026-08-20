/**
 * Calibration targets: what the 1980 season actually produced.
 *
 * These are the numbers the seed ratings are tuned against. They are a
 * 14-race sample, so they carry real sampling noise — a team whose true win
 * probability is 15% can easily win 3 of 14. The goal is for the observed 1980
 * season to be a *plausible* draw from the model, not for the model's expected
 * values to reproduce it exactly. Chasing an exact match would be overfitting
 * to one season.
 */

export const RACES_IN_1980 = 14;

/**
 * Race winners, 1980. This is a complete and reliable record.
 *
 * Jones 5, Piquet 3, Arnoux 2, Reutemann 1, Laffite 1, Pironi 1, Jabouille 1.
 */
export const DRIVER_WINS_1980: Readonly<Record<string, number>> = {
  jones: 5,
  piquet: 3,
  arnoux: 2,
  reutemann: 1,
  laffite: 1,
  pironi: 1,
  jabouille: 1,
};

/** Constructor wins, 1980: Williams 6, Brabham 3, Renault 3, Ligier 2. */
export const TEAM_WINS_1980: Readonly<Record<string, number>> = {
  williams: 6,
  brabham: 3,
  renault: 3,
  ligier: 2,
};

/**
 * Approximate pole distribution, 1980.
 *
 * Less reliable than the win record — treat these as the shape of the season
 * (Renault's turbo was the qualifying weapon, with Ligier and Williams next,
 * and Giacomelli's Alfa Romeo stealing one) rather than exact counts. Weighted
 * accordingly in the objective.
 */
export const TEAM_POLES_1980: Readonly<Record<string, number>> = {
  renault: 6,
  ligier: 3,
  williams: 3,
  brabham: 1,
  alfa_romeo: 1,
};

/** Roughly 40-45% of a 1980 field failed to see the flag. */
export const RETIREMENT_RATE_1980 = 0.42;

export function share(counts: Readonly<Record<string, number>>, key: string): number {
  return (counts[key] ?? 0) / RACES_IN_1980;
}
