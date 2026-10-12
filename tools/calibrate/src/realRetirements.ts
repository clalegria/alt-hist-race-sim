/**
 * What each real season actually did: how many of its starters failed to see
 * the flag.
 *
 * The target set for the per-season retirement factor, and the only measured
 * target here that covers every authored year rather than the two the tuner
 * fits. Counted from the Ergast/Jolpica classification of every world
 * championship race from 1950 to 2026:
 *
 *  - **A starter** is any entry the classification lists as having taken the
 *    start. Entries marked withdrawn are dropped, and **cars that failed to
 *    qualify never appear in a classification at all** — which is what keeps
 *    DNQs out of both halves of the rate. An over-subscribed 1989 grid must not
 *    read as a fragile one.
 *  - **A retirement** is a starter the classification marks retired rather than
 *    giving a finishing position. A car classified in a position despite
 *    stopping — out of fuel on the last lap, running to the flag on three
 *    cylinders — counted as a finisher, because that is what the classification
 *    did with it, and it is the same line the engine draws between
 *    `retirements` and `classifiedCount`.
 *  - **Disqualifications** stay in as finishers. There are barely a hundred in
 *    seventy-seven years and most followed a completed race.
 *
 * The definition is worth stating precisely because it is the one number here
 * that could be counted three defensible ways. This one reproduces the figures
 * that get quoted for the seasons people have written about — 53.9% for 1984
 * against a published 54%, 51.6% for 1989 against ~51%, 44.3% for 1999 against
 * ~45%, 33.3% for 2003 against ~32% — which is the check that it is counting
 * what everyone else counts.
 *
 * Raw counts rather than a percentage, so the sample size behind each year is
 * visible: a 1950s season is ~170 starts and a modern one ~440, and a rate off
 * the smaller sample carries about twice the noise.
 */

/** One real season's classification, reduced to what a retirement rate needs. */
export interface RealRetirements {
  /** Rounds the championship actually ran. */
  readonly races: number;
  /** Entries that took the start, across every round. */
  readonly starters: number;
  /** Those that did not see the flag. */
  readonly retirements: number;
}

/** Every championship season, by year. */
export const REAL_RETIREMENTS: ReadonlyMap<number, RealRetirements> = new Map([
  [1950, { races: 7, starters: 157, retirements: 74 }],
  [1951, { races: 8, starters: 176, retirements: 86 }],
  [1952, { races: 8, starters: 201, retirements: 84 }],
  [1953, { races: 9, starters: 246, retirements: 119 }],
  [1954, { races: 9, starters: 219, retirements: 107 }],
  [1955, { races: 7, starters: 170, retirements: 85 }],
  [1956, { races: 8, starters: 181, retirements: 88 }],
  [1957, { races: 8, starters: 165, retirements: 76 }],
  [1958, { races: 11, starters: 224, retirements: 110 }],
  [1959, { races: 9, starters: 179, retirements: 83 }],
  [1960, { races: 10, starters: 204, retirements: 70 }],
  [1961, { races: 8, starters: 187, retirements: 72 }],
  [1962, { races: 9, starters: 173, retirements: 66 }],
  [1963, { races: 10, starters: 200, retirements: 83 }],
  [1964, { races: 10, starters: 192, retirements: 73 }],
  [1965, { races: 10, starters: 186, retirements: 68 }],
  [1966, { races: 9, starters: 160, retirements: 91 }],
  [1967, { races: 11, starters: 200, retirements: 103 }],
  [1968, { races: 12, starters: 226, retirements: 129 }],
  [1969, { races: 11, starters: 175, retirements: 84 }],
  [1970, { races: 13, starters: 261, retirements: 128 }],
  [1971, { races: 11, starters: 257, retirements: 115 }],
  [1972, { races: 12, starters: 304, retirements: 126 }],
  [1973, { races: 15, starters: 351, retirements: 154 }],
  [1974, { races: 15, starters: 384, retirements: 171 }],
  [1975, { races: 14, starters: 335, retirements: 138 }],
  [1976, { races: 16, starters: 390, retirements: 163 }],
  [1977, { races: 17, starters: 403, retirements: 182 }],
  [1978, { races: 16, starters: 387, retirements: 173 }],
  [1979, { races: 15, starters: 355, retirements: 182 }],
  [1980, { races: 14, starters: 332, retirements: 161 }],
  [1981, { races: 15, starters: 356, retirements: 172 }],
  [1982, { races: 16, starters: 394, retirements: 203 }],
  [1983, { races: 15, starters: 384, retirements: 185 }],
  [1984, { races: 16, starters: 412, retirements: 222 }],
  [1985, { races: 16, starters: 396, retirements: 210 }],
  [1986, { races: 16, starters: 406, retirements: 228 }],
  [1987, { races: 16, starters: 409, retirements: 212 }],
  [1988, { races: 16, starters: 420, retirements: 191 }],
  [1989, { races: 16, starters: 417, retirements: 215 }],
  [1990, { races: 16, starters: 414, retirements: 190 }],
  [1991, { races: 16, starters: 415, retirements: 191 }],
  [1992, { races: 16, starters: 417, retirements: 201 }],
  [1993, { races: 16, starters: 402, retirements: 183 }],
  [1994, { races: 16, starters: 413, retirements: 204 }],
  [1995, { races: 17, starters: 412, retirements: 200 }],
  [1996, { races: 16, starters: 327, retirements: 150 }],
  [1997, { races: 17, starters: 371, retirements: 153 }],
  [1998, { races: 16, starters: 343, retirements: 140 }],
  [1999, { races: 16, starters: 348, retirements: 154 }],
  [2000, { races: 17, starters: 370, retirements: 138 }],
  [2001, { races: 17, starters: 372, retirements: 145 }],
  [2002, { races: 17, starters: 354, retirements: 140 }],
  [2003, { races: 16, starters: 318, retirements: 106 }],
  [2004, { races: 18, starters: 360, retirements: 94 }],
  [2005, { races: 19, starters: 361, retirements: 78 }],
  [2006, { races: 18, starters: 396, retirements: 118 }],
  [2007, { races: 17, starters: 374, retirements: 91 }],
  [2008, { races: 18, starters: 368, retirements: 80 }],
  [2009, { races: 17, starters: 338, retirements: 58 }],
  [2010, { races: 19, starters: 452, retirements: 105 }],
  [2011, { races: 19, starters: 452, retirements: 76 }],
  [2012, { races: 20, starters: 476, retirements: 74 }],
  [2013, { races: 19, starters: 417, retirements: 48 }],
  [2014, { races: 19, starters: 404, retirements: 76 }],
  [2015, { races: 19, starters: 371, retirements: 67 }],
  [2016, { races: 21, starters: 457, retirements: 74 }],
  [2017, { races: 20, starters: 399, retirements: 85 }],
  [2018, { races: 21, starters: 420, retirements: 77 }],
  [2019, { races: 21, starters: 419, retirements: 47 }],
  [2020, { races: 17, starters: 338, retirements: 51 }],
  [2021, { races: 22, starters: 437, retirements: 48 }],
  [2022, { races: 22, starters: 439, retirements: 63 }],
  [2023, { races: 22, starters: 435, retirements: 45 }],
  [2024, { races: 24, starters: 476, retirements: 43 }],
  [2025, { races: 24, starters: 476, retirements: 46 }],
  // Partial: 12 rounds fetched. Re-fit 2026's factor once the season finishes.
  [2026, { races: 12, starters: 257, retirements: 46 }],
]);

/**
 * The share of a real season's starters that retired, or `null` for a year with
 * no record.
 *
 * `null` rather than a fallback, for the reason `seasonSeed` throws on an
 * unauthored year: a fitted factor is only as good as the target behind it, and
 * a year quietly fitted against its neighbour's rate would look calibrated.
 */
export function realRetirementRate(year: number): number | null {
  const real = REAL_RETIREMENTS.get(year);
  return real === undefined ? null : real.retirements / real.starters;
}
