import type { CalendarRace } from "@alt-hist/data";
import type { RaceWeather } from "@alt-hist/engine";
import type { SessionNav } from "../lib/session-nav.js";
import { PageHeading } from "./PageHeading.js";
import { Tabs } from "./Tabs.js";
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
  const circuit = race === undefined || race.circuit === "" ? null : race.circuit;
  return (
    <header>
      <PageHeading
        flag={race?.country}
        title={
          <>
            {race?.name ?? `Round ${round + 1}`}
            {/* Only when it rained: `WeatherBadge` draws nothing for a dry weekend. */}
            <WeatherBadge weather={weather} />
          </>
        }
        // On a phone the round and the circuit are two lines, so the longest
        // circuit still fits beside the switch and every round's header is the
        // same shape: the switch never jumps under the title for a long name.
        sub={
          <>
            <span className="block sm:inline">{`Round ${round + 1} of ${rounds}`}</span>
            {circuit === null ? null : (
              <>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{circuit}</span>
              </>
            )}
          </>
        }
        aside={
          nav === undefined ? undefined : (
            <Tabs
              label="Session"
              className="shrink-0"
              links={[
                {
                  key: "qualifying",
                  label: "Qualifying",
                  current: session === "qualifying",
                  link: nav.qualifying,
                },
                { key: "race", label: "Race", current: session === "race", link: nav.race },
              ]}
            />
          )
        }
      />
    </header>
  );
}
