import { useState } from "react";
import {
  type KeptTeams,
  OFFERED_SEAT_FILLS,
  OPENING_TEAMS,
  SEAT_FILL_LABELS,
} from "../lib/run-settings.js";
import { SettingNote, SettingSegments, SettingSub } from "./SettingSegments.js";

/** What *The first season's teams* does. Who gets the seats is the row under it. */
const NOTE =
  "The first year's teams race every year, even ones that closed down in real life, and new drivers are signed to fill their seats.";

/**
 * *Teams*: every year has the teams history gave it, or the first year's teams
 * at their first-year seat counts (`keptGrid.ts` in `@alt-hist/data`). Era
 * only. Under the first season's teams, *Empty seats go to*; hidden under a
 * reseat (`reseated`), which moves everyone anyway, so the seats go to the best
 * available (`settingsInForce`). The fill is remembered while the dialog is
 * open, so a look at Historical and back keeps it. Who can be signed is the
 * Drivers group's.
 */
export function TeamsSetting({
  teams,
  reseated,
  onChange,
}: {
  /** Null is Historical. */
  teams: KeptTeams | null;
  /** Whether *Who drives where* reseats the grid. */
  reseated: boolean;
  /** Absent in tests, where nothing is clicked. */
  onChange?: (teams: KeptTeams | null) => void;
}) {
  const [kept, setKept] = useState<KeptTeams>(teams ?? OPENING_TEAMS);
  const keep = (to: KeptTeams) => {
    setKept(to);
    onChange?.(to);
  };
  return (
    <div className="flex flex-col gap-2">
      <SettingSegments
        name="Teams"
        segments={[
          {
            key: "historical",
            label: "Historical",
            selected: teams === null,
            onPick: () => onChange?.(null),
          },
          {
            key: "first",
            label: "The first season's teams",
            selected: teams !== null,
            onPick: () => onChange?.(kept),
          },
        ]}
      />
      {teams === null ? null : (
        <>
          {reseated ? null : (
            <SettingSub>
              <SettingSegments
                name="Empty seats go to"
                sub
                segments={OFFERED_SEAT_FILLS.map((fill) => ({
                  key: fill,
                  label: SEAT_FILL_LABELS[fill],
                  selected: teams.fill === fill,
                  onPick: () => {
                    keep({ fill });
                  },
                }))}
              />
            </SettingSub>
          )}
          <SettingNote>{NOTE}</SettingNote>
        </>
      )}
    </div>
  );
}
