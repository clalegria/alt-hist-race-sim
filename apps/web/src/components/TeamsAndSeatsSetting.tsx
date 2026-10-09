import { AGE_RANGE, type EmptySeatRules, withAge } from "@alt-hist/data";
import { useState } from "react";
import {
  OFFERED_SEAT_FILLS,
  OPENING_SEAT_RULES,
  type RunSettings,
  SEAT_FILL_LABELS,
} from "../lib/run-settings.js";
import { SettingNote, SettingSegments, SettingSub } from "./SettingSegments.js";
import { Input } from "./ui/input.js";

/** The age band as the pool filters hold one, so `withAge` keeps the two ends from crossing. */
function movedAge(rules: EmptySeatRules, end: "min" | "max", value: number): EmptySeatRules {
  const { minAge, maxAge } = withAge(
    { hideRetired: false, hideFuture: false, minAge: rules.minAge, maxAge: rules.maxAge },
    end,
    value,
  );
  return { ...rules, minAge, maxAge };
}

/** What *Yes* does, in two short sentences: the teams, then the seats. */
function note(rules: EmptySeatRules): string {
  const band = `aged ${rules.minAge} to ${rules.maxAge}${rules.activeOnly ? " from that season's real grid" : ""}`;
  const fill =
    rules.fill === "last"
      ? `An empty seat keeps last year's driver until they are older than ${rules.maxAge}, else goes to the best free driver ${band}.`
      : `Every empty seat goes to the best free driver ${band}, chosen again each season.`;
  return `Every season has the first season's teams and number of cars; a team that folded races on in its last real car. ${fill}`;
}

/**
 * Whether every year has the teams history gave it, or the first year's teams
 * at their first-year seat counts — and under *Yes*, who takes the seats that
 * leaves empty (`keptGrid.ts` in `@alt-hist/data`). Era only.
 *
 * The rows under *Yes* are set in beneath it, as Car performance's are under
 * *Random factor is added*, and are remembered while the dialog is open, so a
 * look at *No* and back keeps them. The age inputs are the grid editor's pool
 * filter's, and cannot cross.
 */
export function TeamsAndSeatsSetting({
  teamsAndSeats,
  onChange,
}: {
  /** Null is No, the historical answer. */
  teamsAndSeats: RunSettings["teamsAndSeats"];
  /** Absent in tests, where nothing is clicked. */
  onChange?: (teamsAndSeats: RunSettings["teamsAndSeats"]) => void;
}) {
  const [rules, setRules] = useState<EmptySeatRules>(teamsAndSeats ?? OPENING_SEAT_RULES);
  const keep = (to: EmptySeatRules) => {
    setRules(to);
    onChange?.(to);
  };

  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Keep the first season's teams"
        segments={[
          {
            key: "historical",
            label: "No",
            selected: teamsAndSeats === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "keep",
            label: "Yes",
            selected: teamsAndSeats !== null,
            onPick: () => {
              keep(rules);
            },
          },
        ]}
      />
      {teamsAndSeats === null ? null : (
        <>
          <SettingSub>
            <SettingSegments
              name="Empty seats go to"
              sub
              segments={OFFERED_SEAT_FILLS.map((fill) => ({
                key: fill,
                label: SEAT_FILL_LABELS[fill],
                selected: teamsAndSeats.fill === fill,
                onPick: () => {
                  keep({ ...teamsAndSeats, fill });
                },
              }))}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium">Drivers aged</span>
              <div className="flex items-center gap-1.5 text-xs">
                <Input
                  type="number"
                  aria-label="Youngest driver age"
                  min={AGE_RANGE.min}
                  max={AGE_RANGE.max}
                  value={teamsAndSeats.minAge}
                  onChange={(event) => {
                    keep(movedAge(teamsAndSeats, "min", event.target.valueAsNumber));
                  }}
                  className="h-7 w-14 px-1.5 text-center text-xs"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  aria-label="Oldest driver age"
                  min={AGE_RANGE.min}
                  max={AGE_RANGE.max}
                  value={teamsAndSeats.maxAge}
                  onChange={(event) => {
                    keep(movedAge(teamsAndSeats, "max", event.target.valueAsNumber));
                  }}
                  className="h-7 w-14 px-1.5 text-center text-xs"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={teamsAndSeats.activeOnly}
                onChange={(event) => {
                  keep({ ...teamsAndSeats, activeOnly: event.target.checked });
                }}
                className="accent-primary size-3.5 cursor-pointer"
              />
              Only sign drivers from that season's real grid
            </label>
          </SettingSub>
          <SettingNote>{note(teamsAndSeats)}</SettingNote>
        </>
      )}
    </div>
  );
}
