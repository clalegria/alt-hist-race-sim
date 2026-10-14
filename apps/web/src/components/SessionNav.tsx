import type { CalendarRace } from "@alt-hist/data";
import type { RaceWeather } from "@alt-hist/engine";
import { Link } from "@tanstack/react-router";
import type { RoundLink, SessionNav } from "../lib/session-nav.js";
import { Flag } from "./Flag.js";
import { TabLinks } from "./TabLinks.js";
import { WeatherBadge } from "./WeatherBadge.js";

/**
 * The top of a session's page: where the round is held, how far through the
 * year, the switch between its qualifying and its race, and what the sky did.
 *
 * `nav` is absent in a test without a router; the round is still named.
 */
export function SessionHeader({
  session,
  round,
  rounds,
  race,
  weather,
  nav,
}: {
  session: "qualifying" | "race";
  /** Zero-based. */
  round: number;
  rounds: number;
  race: CalendarRace | undefined;
  weather: RaceWeather;
  nav?: SessionNav | undefined;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <h1 className="narrow flex flex-wrap items-center gap-2.5 text-4xl leading-none font-extrabold tracking-[0.01em] uppercase md:text-5xl">
          {race === undefined || race.country === "" ? null : (
            <Flag country={race.country} title={race.country} className="h-5 w-7.5" />
          )}
          {race?.name ?? `Round ${round + 1}`}
          {/* Only when it rained: `WeatherBadge` draws nothing for a dry weekend. */}
          <WeatherBadge weather={weather} />
        </h1>
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
          Round {round + 1} of {rounds}
          {race === undefined || race.circuit === "" ? "" : ` · ${race.circuit}`}
        </p>
      </div>
      {nav === undefined ? null : (
        <TabLinks
          label="Session"
          tabs={[
            {
              key: "qualifying",
              label: "Qualifying",
              current: session === "qualifying",
              link: nav.qualifying,
            },
            { key: "race", label: "Race", current: session === "race", link: nav.race },
          ]}
        />
      )}
    </header>
  );
}

/** A round either side, as a link — or, while it is still ahead, as words. */
function RoundStep({ step, direction }: { step: RoundLink; direction: "previous" | "next" }) {
  const text = direction === "previous" ? `‹ ${step.label}` : `${step.label} ›`;
  return step.link === null ? (
    <span aria-disabled="true" className="text-subtle text-sm">
      {step.label} (not yet) ›
    </span>
  ) : (
    <Link
      {...step.link}
      rel={direction === "previous" ? "prev" : "next"}
      className="text-primary text-sm font-medium underline-offset-4 hover:underline"
    >
      {text}
    </Link>
  );
}

/**
 * The rounds either side of a session, at the foot of its page. They move
 * between places and never reveal: a round ahead is drawn but not linked, and
 * the way there is Continue.
 */
export function RoundLinks({ nav }: { nav: SessionNav }) {
  if (nav.previous === null && nav.next === null) {
    return null;
  }
  return (
    <nav aria-label="Rounds" className="flex items-center justify-between gap-3">
      {nav.previous === null ? <span /> : <RoundStep step={nav.previous} direction="previous" />}
      {nav.next === null ? <span /> : <RoundStep step={nav.next} direction="next" />}
    </nav>
  );
}
