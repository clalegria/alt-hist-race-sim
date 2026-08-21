/**
 * The driver ageing curve.
 *
 * Three phases either side of a plateau:
 *
 * ```
 *  debut          plateau start   peak   plateau end
 *    |------ development ------|----- • -----|------ decline ------>
 * ```
 *
 * Development runs from the debut season to the start of the plateau, rising
 * from a rookie level set by how much runway the driver has. The plateau is the
 * authored `peakSeasons` window centred on the peak season — not flat, but
 * within a few percent of peak throughout. Decline runs from the end of the
 * plateau and accelerates.
 *
 * On top of that sit three authored events: the rookie season, an optional
 * persistent steep decline, and any number of one-off off-form seasons.
 *
 * Deterministic by design — no `Rng` parameter, and none is coming without a
 * decision from the author. See `constants.ts`.
 */

import type { DriverRatings } from "../model/index.js";
import { AGEING_CONSTANTS, type AgeingConstants } from "./constants.js";
import type { DriverCareer, PeakWindow } from "./types.js";

/**
 * The seasons a driver spends at or near peak, centred on the peak season.
 *
 * An even `peakSeasons` cannot be centred exactly; the extra season goes after
 * the peak rather than before, since a driver holds form on longer than they
 * take to find it. `peakSeasons` below 1 is treated as 1 — every driver has at
 * least the season they peak in.
 */
export function peakWindow(career: DriverCareer): PeakWindow {
  const span = Math.max(1, Math.round(career.peakSeasons));
  const before = Math.floor((span - 1) / 2);
  return { start: career.peakSeason - before, end: career.peakSeason - before + span - 1 };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** How steeply a driver climbs towards their plateau. See `developmentExponent*`. */
function developmentExponent(speed: number, constants: AgeingConstants): number {
  const t = clamp((speed - 1) / 9, 0, 1);
  return lerp(constants.developmentExponentAtSpeedOne, constants.developmentExponentAtSpeedTen, t);
}

/** The three buckets a season's shortfall is split across, before sensitivities. */
interface Deficits {
  readonly development: number;
  readonly decline: number;
  readonly form: number;
}

/**
 * The raw shortfall for a season, split by cause.
 *
 * Exported because the terminal tool reports which phase a season is in, and
 * re-deriving that from the ratings would be guesswork.
 */
export function seasonDeficits(
  career: DriverCareer,
  season: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): Deficits {
  const window = peakWindow(career);
  let development = 0;
  let decline = 0;
  let form = 0;

  if (season < window.start) {
    // Development. Runway is measured to the plateau, not to the peak itself:
    // a driver is essentially there by the time the plateau opens.
    const runway = Math.max(1, window.start - career.debutSeason);
    const rookieDeficit = Math.min(
      constants.maxRookieDeficit,
      constants.deficitPerDevelopmentSeason * runway,
    );
    const progress = clamp((season - career.debutSeason) / runway, 0, 1);
    const shaped = progress ** developmentExponent(career.developmentSpeed, constants);
    development = rookieDeficit * (1 - shaped);
  } else if (season <= window.end) {
    // Plateau: 100% in the peak season, easing to the edge deficit at the ends.
    const distance = Math.abs(season - career.peakSeason);
    const halfSpan = Math.max(
      1,
      Math.max(career.peakSeason - window.start, window.end - career.peakSeason),
    );
    form = constants.plateauEdgeDeficit * (distance / halfSpan) ** 2;
  } else {
    // Decline, continuous with the plateau edge it starts from.
    const years = season - window.end;
    const rate = constants.declineBaseRate * (career.declineSpeed / constants.nominalDeclineSpeed);
    decline = constants.plateauEdgeDeficit + rate * years ** constants.declineExponent;
  }

  // The rookie penalty covers the debut season and everything before it, so the
  // curve never rewards a driver for not having started yet.
  if (season <= career.debutSeason) {
    development += constants.rookieSeasonPenalty;
  }

  // Before the debut the development curve above has bottomed out, so the climb
  // towards the first Grand Prix is added here instead.
  if (season < career.debutSeason) {
    development += Math.min(
      constants.maxPreDebutDeficit,
      constants.preDebutDeficitPerSeason * (career.debutSeason - season),
    );
  }

  if (career.steepDecline !== undefined && season >= career.steepDecline.season) {
    decline += clamp(career.steepDecline.severity, 0, 1) * constants.steepDeclineMaxDrop;
  }

  for (const off of career.offSeasons ?? []) {
    if (off.season === season) {
      form += clamp(off.severity, 0, 1) * constants.offSeasonMaxDrop;
    }
  }

  return { development, decline, form };
}

const ATTRIBUTES = [
  "racing",
  "qualifying",
  "consistency",
  "adaptability",
  "composure",
] as const satisfies readonly (keyof DriverRatings)[];

/**
 * A driver's ratings in a given season.
 *
 * Seasons outside the career are answered rather than refused: the terminal tool
 * sweeps whole lifetimes, and a career is a window on a curve that exists either
 * side of it. Before the debut the curve keeps falling away as it goes back, so
 * a driver is never better in the years before his first race than in it.
 */
export function ratingsForSeason(
  career: DriverCareer,
  season: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): DriverRatings {
  const deficits = seasonDeficits(career, season, constants);

  const rated = {} as Record<keyof DriverRatings, number>;
  for (const attribute of ATTRIBUTES) {
    const deficit =
      deficits.development * constants.developmentSensitivity[attribute] +
      deficits.decline * constants.declineSensitivity[attribute] +
      deficits.form;
    rated[attribute] = Math.round(
      clamp(career.peak[attribute] * (1 - deficit), constants.minRating, constants.maxRating),
    );
  }

  return rated;
}
