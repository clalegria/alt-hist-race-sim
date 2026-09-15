/**
 * The rating mode every harness in this folder measures in.
 *
 * **Calibration runs on `aged`, and must never be run on `peak`.** A `peak`
 * field races every driver at their authored best regardless of the year, which
 * is a grid that has never existed: it puts a 41-year-old at his 2018 level and
 * a rookie at a peak he will not reach for a decade. Numbers measured off it
 * cannot be compared with a real season, so any rating fitted against them is
 * absorbing the difference between a driver and his own prime into the car.
 *
 * That is not a hypothetical. Fitting a modern season in `peak` can put a team
 * at a third of its real win share, purely because a rival's peak driver — from
 * a decade the season never saw — outguns its own; the identical chassis in
 * `aged` lands where the record says it should. The car was never the thing that
 * was wrong.
 *
 * `--mode peak` remains available on the harnesses that take it, for reading a
 * grid on its own terms. It is not a way to produce a figure.
 */
export const CALIBRATION_RATING_MODE = "aged" as const;
