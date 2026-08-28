/**
 * Types for the authored seed data.
 *
 * These describe the JSON files in this folder as they actually are — every
 * field below was read off the files, and `type-checks.ts` asserts in both
 * directions that the declarations and the JSON still agree. They are seed /
 * authoring shapes, deliberately independent of the engine's runtime model.
 */

/** A driver's ratings at their peak. Higher is better on all five. */
export interface DriverPeak {
  /** The single season the driver is at 100% of the ratings below. */
  readonly season: number;
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly adaptability: number;
  /** Low composure = crash-prone. */
  readonly composure: number;
}

/**
 * A career-ending step down the normal decline curve would not produce — Keke
 * Rosberg in 1986, Nigel Mansell in 1995, Jody Scheckter in 1980. Persistent:
 * it applies from `season` onward, on top of the ordinary decline.
 */
export interface DriverStepDown {
  /** The first season the drop applies to. */
  readonly season: number;
  /** 0-1. Scaled by the engine's `stepDownMaxDrop`. */
  readonly severity: number;
}

/**
 * One season below the driver's own standard, and only that season — Prost in
 * 1989, in the author's opinion. Does not persist.
 */
export interface DriverOffSeason {
  readonly season: number;
  /** 0-1. Scaled by the engine's `offSeasonMaxDrop`. */
  readonly severity: number;
}

export interface Driver {
  readonly id: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly nationality: string;
  readonly birthYear: number;
  /** Their rookie season: the first season they raced in real life. */
  readonly debutSeason: number;
  /**
   * The last season they raced in real life. Informational for now — nothing
   * reads it, and no driver is withdrawn from a grid because of it.
   */
  readonly finalSeason: number;
  readonly peak: DriverPeak;
  /**
   * How many seasons the driver spends at or very near their peak, centred on
   * `peak.season`. A driver is only truly at 100% for one season, but plenty
   * stay close for years: Prost's 7 runs 1984-1990 around a 1987 peak.
   */
  readonly peakSeasons: number;
  /** 1-10. Shapes the climb from debut to plateau, not where it ends. */
  readonly developmentSpeed: number;
  /** 1-10. How fast ability falls away once the plateau ends. */
  readonly declineSpeed: number;
  readonly stepDown?: DriverStepDown;
  readonly offSeasons?: readonly DriverOffSeason[];
}

/**
 * An engine manufacturer's identity — immutable, like `Team` and `Driver`.
 *
 * What the unit is *worth* changes every season and lives in the season file;
 * this is only who made it. `base` is where it was built, which is why Ford is
 * GB: the DFV was a Cosworth design assembled in Northampton and badged for its
 * backer, and the flag beside it should be the one that built it.
 */
export interface EngineManufacturer {
  readonly id: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly base: string;
}

/**
 * One engine manufacturer's unit for one season.
 *
 * Three ratings, not four: an engine has no consistency of its own — that is a
 * chassis property. The engine package blends these with the chassis in
 * `powertrain()`: 0.3 of a car's pace against the chassis's 0.7, and an even
 * half of its reliability.
 */
export interface SeasonEngine {
  readonly engineId: string;
  readonly racing: number;
  readonly qualifying: number;
  readonly reliability: number;
}

/**
 * A team's colours: what a livery is reduced to for display.
 *
 * Not a rating and not simulated — nothing in the engine reads any of this. It
 * exists so the UI can colour a team consistently wherever it appears, and draw
 * a circular badge for it.
 *
 * The fields are spread flat across `LiveryEra` and `SeasonEntry` rather than
 * nested, so an era stays one line of JSON. This interface is the single
 * declaration of their shape; both sides extend it, and `LIVERY_KEYS` is the
 * runtime echo.
 */
export interface Livery {
  /** The team's dominant colour, as `#RRGGBB`. */
  readonly primaryColor: string;
  /** First accent, as `#RRGGBB`. The inner badge stripe when one is drawn. */
  readonly secondaryColor1: string;
  /** Second accent, as `#RRGGBB`. The outer badge stripe when two are drawn. */
  readonly secondaryColor2: string;
  /**
   * How many of the two accents the badge wears as stripes: 0 draws a plain
   * disc in the primary colour, 1 adds `secondaryColor1`, 2 adds both.
   *
   * Typed `number` rather than `0 | 1 | 2` because TypeScript infers `number`
   * for a JSON literal, and `type-checks.ts` requires the JSON to satisfy this
   * interface. The 0-2 range is enforced at runtime by `validateSeedData`, the
   * same division of labour as `base` and every rating.
   *
   * The colours stay authored either way — a team with 0 stripes still has
   * accents available for text and backgrounds.
   */
  readonly badgeStripes: number;
}

/**
 * The start of an era. Every era list is sorted by this and read the same way:
 * the era in force in a year is the last one whose `from` has arrived.
 *
 * `from` and no `until`, deliberately. An era runs until the next one starts,
 * so a boundary is stated once; a closing year as well would be a second place
 * to say the same thing, and the day the two disagreed the result would be a
 * silent gap or an overlap rather than an error.
 */
export interface Era {
  /** The first season the era applies to. */
  readonly from: number;
}

/**
 * What a team was called, and where it was registered, over one span of years.
 *
 * Teams are renamed far more often than they are replaced: Toleman became
 * Benetton, then Renault, then Lotus, then Renault again, then Alpine, and
 * every one of those is the same organisation in the same buildings. The team
 * `id` is that organisation and never changes; this is what it answered to at
 * the time, and `base` rides along because the flag moves with the name —
 * Toleman is GB, Renault is FR.
 *
 * The name is therefore **not** part of a team's identity in the sense the
 * architecture rules mean it. `id` is. Read a name through
 * `teamIdentityIn(team, year)`, never off a field.
 */
export interface TeamIdentity extends Era {
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly base: string;
}

/**
 * A livery, and the season it came in.
 *
 * A separate list from `TeamIdentity` because the two timelines genuinely do
 * not line up. Ferrari has one name and many liveries; McLaren raced in
 * Marlboro white for eighteen unbroken years under one name and then went
 * silver; Toleman changed both at once in 1986. Folding them into a single list
 * would force an invented name era every time a car was repainted, and the
 * union of two independent timelines has more rows than either.
 *
 * The grain is deliberately coarse. Real liveries drift every season — a
 * sponsor moves, a shade shifts — and reproducing that would make a team look
 * like a different team every year in a table. An era is a *substantial*
 * change; the small ones are noise and are not modelled.
 */
export interface LiveryEra extends Era, Livery {}

/**
 * A constructor, as one continuous organisation across every name it ever used.
 *
 * Identity here means the `id` and the lineage — not the name, which is a
 * per-era fact below, and not the colours, which are another. What survives a
 * rename is what belongs in this record.
 */
export interface Team {
  readonly id: string;
  /**
   * When the lineage began, which is the founding of its *first* incarnation —
   * 1981 for the team that is now Alpine, because that is when Toleman was
   * founded. Both era lists start at or before this year.
   */
  readonly foundedYear: number;
  /** Names and bases, earliest first. Never empty. */
  readonly identity: readonly TeamIdentity[];
  /** Liveries, earliest first. Never empty. */
  readonly liveries: readonly LiveryEra[];
}

/**
 * A team's *chassis* attributes for one season — the tub, with nothing in the
 * back of it.
 *
 * This is the authored rating and the only car-side rating anyone edits. It is
 * not what the race model scores: the engine package blends it with that year's
 * `SeasonEngine` in `powertrain()`, and the result of that blend is the car.
 */
export interface ChassisSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly reliability: number;
}

/**
 * One team's participation in one season: a team, a chassis, an engine, and its
 * drivers.
 *
 * The `Livery` fields are inherited as optional and override the team's livery
 * era for this season only. They are **all-or-nothing**: an entry carries all
 * four or none, which `validateSeedData` enforces. Partial overrides are banned
 * because the fields that fell back would combine into a livery nobody authored.
 *
 * This is the escape hatch, not the mechanism. A team that looked different for
 * a span of years has a `LiveryEra` in `teams.json`; an override here says
 * "this one season was deliberately unlike the years around it", and there
 * should be very few. They used to carry the era data itself — McLaren declared
 * the same four values in every season file from 1974 to 2016 — and the cost was
 * that an override meant nothing, because most of them meant "unchanged".
 */
export interface SeasonEntry extends Partial<Livery> {
  readonly teamId: string;
  /**
   * Which manufacturer supplies its engine that year. Must name one of the
   * season's own `engines` — a team cannot run a unit the season does not have,
   * and `validateSeedData` says so.
   */
  readonly engineId: string;
  /** The chassis the team built. The engine above is blended into it later. */
  readonly chassis: ChassisSpec;
  /** Driver ids. Length varies — some teams field a single car. */
  readonly drivers: readonly string[];
}

/**
 * One round of a season's calendar.
 *
 * Cosmetic. The race model has no notion of a circuit — every round is the same
 * race — so this exists purely so results can be labelled "Round 3, South
 * African Grand Prix at Kyalami" instead of "Round 3". If circuits ever gain
 * real character (a power track favouring the turbos, a street circuit
 * favouring grid position), it will hang off this record; nothing does yet.
 */
export interface CalendarRace {
  /** 1-based, and equal to the position in the array. */
  readonly round: number;
  readonly name: string;
  readonly circuit: string;
  /** ISO 3166-1 alpha-2 code for the host country, for the flag beside the name. */
  readonly country: string;
}

export interface SeasonSeed {
  readonly year: number;
  /**
   * Championship points by finishing position, best first: index 0 is the win.
   * A position past the end of the table scores nothing, so the length *is* how
   * many places score.
   *
   * Per season rather than a constant, because the scale is the part of the
   * sport that changed most and it changed on dates: 8-6-4-3-2 through the
   * fifties, 9-6-4-3-2-1 from 1961, 10 for a win from 1991, eight scorers from
   * 2003, and 25-18-15-12-10-8-6-4-2-1 to ten places from 2010. Each year
   * carries its own, and the engine is handed it rather than assuming one.
   *
   * Deliberately nothing but the array. Real championships bolted rules onto
   * it — dropped scores (1980 counted each driver's best five results from the
   * first seven races and best five from the last seven, so Jones scored 71
   * gross and 67 counted), a point for fastest lap, points for the sprint, half
   * points for a race stopped early — and none of them are modelled, on the
   * author's call. Every race counts, and a finishing position is the only
   * thing that scores.
   */
  readonly points: readonly number[];
  /** The season's rounds, in order. Its length is how many races the year has. */
  readonly calendar: readonly CalendarRace[];
  /**
   * How hard the year was on its cars: a 1-10 dial over how often a car
   * retires, 5 being the calibrated default and no change at all.
   *
   * A *fine-tuning* multiplier, not the main mechanism. Most of an era is
   * already in the authored chassis and engine `reliability` ratings, which are
   * far lower in 1954 than in 2018. What they cannot express is that the
   * mapping from a rating to a failure probability was itself fitted to 1980,
   * and that driver-error retirements have no era term at all — see
   * `retirement.ts` in the engine, which owns the mapping from this number to
   * the two risks it scales.
   *
   * Typed `number` rather than the engine's 1-10 union for the reason
   * `badgeStripes` is: TypeScript infers `number` for a JSON literal. The range
   * is enforced at runtime by `validateSeedData`, and narrowed to the union by
   * `parseRetirementFactor` where the engine is handed it.
   */
  readonly retirementFactor: number;
  /**
   * Every engine available that year, and what it was worth.
   *
   * Per season rather than per manufacturer, because an engine is not one thing
   * for a decade: Ferrari ran a flat-12 in 1980 and a turbo V6 in 1981, and the
   * Cosworth DFV slid steadily backwards as the turbos arrived.
   *
   * It is the season's *menu*, not a list of what was used — an engine nobody
   * entered is legal, and is exactly what the grid editor offers as an
   * alternative.
   */
  readonly engines: readonly SeasonEngine[];
  readonly entries: readonly SeasonEntry[];
}
