import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import { SeasonCalendar } from "./components/SeasonCalendar.js";
import { StandingsTable } from "./components/StandingsTable.js";
import { Button } from "./components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./components/ui/card.js";
import { Input } from "./components/ui/input.js";
import { parseSeed } from "./lib/format.js";
import { driverName, teamName } from "./lib/names.js";
import { useSeasonStore } from "./store/season.js";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function Champion({ label, name, detail }: { label: string; name: string; detail: string }) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{name}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function App() {
  const world = useSeasonStore((state) => state.world);
  const simulate = useSeasonStore((state) => state.simulate);
  const [seedInput, setSeedInput] = useState(String(world.seed));

  // Standings are derived from results on read — the same rule the engine
  // follows — so they are recomputed when the world changes and never stored.
  const drivers = useMemo(() => championshipStandings(world.season), [world.season]);
  const constructors = useMemo(() => constructorStandings(world.season), [world.season]);

  // Every entry row carries its team, so the season is its own driver-to-team
  // index and nothing has to rebuild the field to label a name.
  const teamFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const race of world.season.races) {
      for (const entry of race.entries) {
        map.set(entry.driverId, entry.teamId);
      }
    }
    return map;
  }, [world.season]);

  const champion = drivers[0];
  const topTeam = constructors[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {world.year} Season
            <span className="text-muted-foreground ml-2 font-normal">alt-hist-race-sim</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Simulated from seed{" "}
            <span className="text-foreground font-mono tabular-nums">{world.seed}</span>. The same
            seed always produces the same season.
          </p>
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            simulate(parseSeed(seedInput, world.seed));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="seed"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Seed
            </label>
            <Input
              id="seed"
              className="w-28 font-mono tabular-nums"
              value={seedInput}
              inputMode="numeric"
              onChange={(event) => {
                setSeedInput(event.target.value);
              }}
            />
          </div>
          <Button type="submit">Simulate</Button>
          <Button
            variant="outline"
            onClick={() => {
              const next = world.seed + 1;
              setSeedInput(String(next));
              simulate(next);
            }}
          >
            Next
          </Button>
        </form>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Champion
          label="Drivers' champion"
          name={champion === undefined ? "—" : driverName(champion.driverId)}
          detail={
            champion === undefined
              ? "Nobody scored."
              : `${teamName(champion.teamId)} — ${champion.points} points from ${plural(champion.wins, "win")}.`
          }
        />
        <Champion
          label="Constructors' champion"
          name={topTeam === undefined ? "—" : teamName(topTeam.teamId)}
          detail={
            topTeam === undefined
              ? "Nobody scored."
              : `${topTeam.points} points from ${plural(topTeam.wins, "win")}.`
          }
        />
      </div>

      <SeasonCalendar season={world.season} teamFor={teamFor} />

      <StandingsTable
        title="Drivers' Championship"
        description="9-6-4-3-2-1 to the top six. Every race counts — the 1980 dropped-scores rule is not modelled."
        nameColumn="Driver"
        standings={drivers}
      />

      <StandingsTable
        title="Constructors' Championship"
        description="Both cars score, as they have since 1979. Starts and wins are per car; poles are per race."
        nameColumn="Team"
        standings={constructors}
      />

      <p className="text-muted-foreground text-xs">
        Ratings are authored placeholders: no ageing curve exists yet, so every driver races at
        their career peak all season.
      </p>
    </div>
  );
}
