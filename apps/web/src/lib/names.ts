/**
 * Display names for ids.
 *
 * The seed data is static and bundled, so these maps are built once at module
 * load rather than threaded through props. Ids are the fallback: a name that
 * cannot be resolved should show as something traceable, not as blank.
 */

import { driversById, enginesById, teamIdentityIn, teamsById } from "@alt-hist/data";

const drivers = driversById();
const teams = teamsById();
const engines = enginesById();

export function driverName(driverId: string): string {
  return drivers.get(driverId)?.name ?? driverId;
}

/**
 * What the team was called in `year` — Toleman in 1983, Benetton in 1991,
 * Alpine in 2024, all of them the same `teamId`.
 *
 * The year is optional and every caller inside a season should pass it. Without
 * one the team's most recent name is used, which is the right answer for a list
 * of teams with no season in hand and the wrong one inside a table of 1983
 * results — so the omission is the exception, not the default.
 */
export function teamName(teamId: string, year?: number): string {
  const team = teams.get(teamId);
  return team === undefined ? teamId : teamIdentityIn(team, year).name;
}

export function engineName(engineId: string): string {
  return engines.get(engineId)?.name ?? engineId;
}

/**
 * Which flag goes beside a name: a driver's nationality, a team's base.
 *
 * Here rather than in each component that draws one, because the alternative
 * was five more module-level `driversById()` / `teamsById()` maps and seven
 * copies of `.get(id)?.nationality`. Undefined for an id the seed data does not
 * know, which is what `Flag` and every caller already treat as "no flag".
 */
export function driverCountry(driverId: string): string | undefined {
  return drivers.get(driverId)?.nationality;
}

export function teamCountry(teamId: string, year?: number): string | undefined {
  const team = teams.get(teamId);
  return team === undefined ? undefined : teamIdentityIn(team, year).base;
}

/**
 * A team as an entry: chassis and engine, the way a season's entry list writes
 * it — "Williams-Ford", "Ligier-Matra", "Toleman-Hart".
 *
 * **A works team keeps its bare name.** Renault building its own engine is not
 * a "Renault-Renault", and neither is Ferrari; the hyphen exists to say who
 * *supplied* the engine, so when that is the team itself there is nothing to
 * say. Compared on the names rather than the ids, because that is the claim
 * being made — two records that happen to share an id spelling are not the
 * point, and the same manufacturer can be a team in one season and only a
 * supplier in another.
 *
 * With no engine it is just the team, which is what every table showed before
 * engines existed and what a component rendered outside a season still shows.
 *
 * `year` is passed through to `teamName`, and it matters here beyond the label:
 * the works-team test compares the two names, so the same lineage is
 * "Renault" in 2019 and "Lotus-Renault" in 2013.
 */
export function entryName(teamId: string, engineId?: string, year?: number): string {
  const team = teamName(teamId, year);
  if (engineId === undefined) {
    return team;
  }
  const engine = engineName(engineId);
  return engine.toLowerCase() === team.toLowerCase() ? team : `${team}-${engine}`;
}

/**
 * Words that trail a surname rather than being one: "Nelson Piquet Jr." keeps
 * its "Jr." through the abbreviation, because dropping it would turn a son into
 * his father.
 */
const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "i", "ii", "iii", "iv"]);

/** Does this word start lowercase — "de", "van", "di" — and so begin a surname? */
function isParticle(word: string): boolean {
  const first = word.charAt(0);
  return first === first.toLowerCase() && first !== first.toUpperCase();
}

/** "Jean-Pierre" → "J-P.", "Michael" → "M." — every part of a given name kept. */
function initials(word: string): string {
  return `${word
    .split("-")
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("-")}.`;
}

/**
 * A name cut down to initials and surname: "Michael Schumacher" →
 * "M. Schumacher", "Jean-Pierre Jarier" → "J-P. Jarier", "Juan Manuel Fangio" →
 * "J.M. Fangio".
 *
 * **Where the surname starts is the whole problem.** It is not "the last word":
 * "Emmanuel de Graffenried" and "Giedo van der Garde" carry particles, and a
 * particle is what marks the boundary — the first word after the first that
 * begins lowercase. With no particle the last word is the surname, after any
 * suffix has been set aside. Multi-word *given* names all become initials, so
 * Fangio reads "J.M." rather than losing a name he had.
 *
 * Two drivers can collapse onto the same short form — both Schumachers do — and
 * that is accepted: this is the fallback for a name that does not fit, and the
 * full name is a tooltip away. A name of one word is returned unchanged, since
 * there is nothing to abbreviate.
 *
 * Pure string work, on the display name and not on an id, so the rule is
 * testable without touching the seed data.
 */
export function shortName(full: string): string {
  const words = full
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  let end = words.length;
  while (end > 1 && SUFFIXES.has((words[end - 1] ?? "").toLowerCase())) {
    end -= 1;
  }
  const named = words.slice(0, end);
  if (named.length < 2) {
    return full;
  }
  const particle = named.findIndex((word, index) => index > 0 && isParticle(word));
  const surnameAt = particle === -1 ? named.length - 1 : particle;
  return [
    named
      .slice(0, surnameAt)
      .map((word) => initials(word))
      .join(""),
    ...named.slice(surnameAt),
    ...words.slice(end),
  ].join(" ");
}

/** A driver's name, abbreviated — see `shortName`. */
export function shortDriverName(driverId: string): string {
  return shortName(driverName(driverId));
}
