/**
 * Every tunable number in the weather model, in one place.
 *
 * The same rule the race constants follow: no literal magic numbers in the
 * logic, one module per subsystem. These are judgements (see
 * `.claude/rules/wet-weather.md`): reasoned starting points chosen to make a wet
 * race feel like a wet race, and the first thing to move if the author wants the
 * rain to behave differently.
 *
 * Everything here is expressed against **wetness**, a 0-1 number saying how wet
 * the race actually was. Nothing is a step change: a 20%-wet race is a dry race
 * with a damp patch in it, and every effect below scales from "no change at all"
 * at wetness 0 to its full value at wetness 1.
 */

export interface WeatherConstants {
  /**
   * How often a round is declared wet, before any per-round modulation.
   *
   * ~15% is the author's read of the sport: rain-affected races are a handful a
   * year, not one in three. A round may say otherwise — `RoundContext.wetChance`
   * overrides this — which is the seam *circuit character* will use to make
   * Spa and Suzuka wetter than Bahrain.
   */
  readonly wetRaceProbability: number;

  /**
   * How wet a wet race is: the range wetness is drawn from, and the shape of
   * the draw within it.
   *
   * **A range, not a switch.** Most wet races are not the 1996 Spanish Grand
   * Prix; most are a shower over a dry weekend, a damp opening lap, a track
   * that dries by half distance. So a declared-wet round draws a wetness rather
   * than turning everything up to maximum, and the draw is skewed toward the
   * bottom of the range: `floor + (ceiling - floor) * u ** skew`, with a skew
   * above 1 pushing mass toward the floor. At 1.6 the mean wetness of a wet
   * race is about 0.51 and a genuinely biblical one — above 0.9 — turns up in
   * roughly one wet race in eight, which is about one race every five seasons.
   *
   * The floor is not 0: a race declared wet and then scored as though it were
   * dry would be a lie in the results table, where it is labelled.
   */
  readonly wetnessFloor: number;
  readonly wetnessCeiling: number;
  readonly wetnessSkew: number;

  /**
   * What a fully wet race multiplies both noise sigmas by.
   *
   * The headline effect and the reason the feature exists: a wet race is where
   * the field genuinely reorders. It is a **separate multiplier from the
   * randomness level**, not a share of the same constant — the slider says how
   * much the dice decide across a whole run, this says how much *this
   * afternoon* did, and a chaotic run in the rain gets both.
   */
  readonly noiseScaleAtFullWetness: number;

  /**
   * What a fully wet race multiplies the two retirement risks by.
   *
   * Driver error rises far more than mechanical failure, because that is what
   * actually happens: cars do not break more in the rain so much as they leave
   * the road. The mechanical share is above 1 all the same — standing water
   * ends races through the electrics and through contact.
   */
  readonly driverErrorScaleAtFullWetness: number;
  readonly mechanicalScaleAtFullWetness: number;

  /**
   * How much of the score moves from the car to the driver at full wetness,
   * applied to both sessions.
   *
   * In the dry the car is most of it. In the wet the loads come down, the
   * differences between cars shrink against the differences between the people
   * driving them, and a driver can make up an amount of time no dry lap would
   * give him. Subtracted from the car's weight and added to the driver's, so
   * the pair still sums to 1 and scores stay on the rating scale.
   */
  readonly driverWeightShiftAtFullWetness: number;

  /**
   * How much of a car's pace moves from the engine to the chassis at full
   * wetness.
   *
   * The same argument one level down: nobody uses the top end of the power
   * curve in the rain, and what is left deciding a car is mechanical grip,
   * balance and how it puts its power down — the chassis' business. Subtracted
   * from `weightEnginePerformance` and added to `weightChassisPerformance`.
   *
   * Reliability is untouched: an engine drowns as readily as a gearbox.
   */
  readonly chassisWeightShiftAtFullWetness: number;

  /**
   * How much of a driver's `racing` and `qualifying` is replaced by their
   * `wetWeather` rating at full wetness.
   *
   * The large one, and the whole point of authoring the rating: at 0.75 a
   * downpour is three-quarters a test of how good someone is in the rain and
   * only a quarter of how quick they are. A driver whose wet rating equals
   * their dry one is unaffected at every wetness, which is most of the pool —
   * this term does nothing at all except to the exceptions, which is exactly
   * what it should do.
   */
  readonly abilityShareAtFullWetness: number;

  /**
   * The same blend into `composure` for the driver-error roll, and smaller.
   *
   * Staying on the road in the wet is partly wet skill and partly the ordinary
   * discipline that keeps a driver out of the barrier in the dry, so this one
   * is a half share rather than three-quarters. It is what stops the rising
   * error rate above from falling equally on a wet specialist and on someone
   * who was always going to spin.
   */
  readonly composureShareAtFullWetness: number;
}

/** The defaults every caller gets unless it says otherwise. */
export const WEATHER_CONSTANTS: WeatherConstants = Object.freeze({
  wetRaceProbability: 0.15,

  wetnessFloor: 0.2,
  wetnessCeiling: 1.0,
  wetnessSkew: 1.6,

  noiseScaleAtFullWetness: 1.9,

  driverErrorScaleAtFullWetness: 2.6,
  mechanicalScaleAtFullWetness: 1.25,

  driverWeightShiftAtFullWetness: 0.12,
  chassisWeightShiftAtFullWetness: 0.12,

  abilityShareAtFullWetness: 0.75,
  composureShareAtFullWetness: 0.5,
});
