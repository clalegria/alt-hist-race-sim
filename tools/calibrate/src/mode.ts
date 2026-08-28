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
 * That is not a hypothetical. Fitting 2026 in `peak` puts McLaren's win share at
 * 6.5% against a real 16.7%, purely because a peak Hamilton outguns a peak
 * Norris; the same chassis in `aged` lands on 16.4%. The car was never the thing
 * that was wrong.
 *
 * `--mode peak` remains available on the harnesses that take it, for comparing
 * against the older race-level tables in `.claude/rules/calibration.md`, which
 * were all measured that way. It is a way to read a historical figure, not a way
 * to produce a new one.
 */
export const CALIBRATION_RATING_MODE = "aged" as const;
