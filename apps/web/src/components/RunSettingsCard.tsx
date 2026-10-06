import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

/**
 * The setup screen's run settings: how the run is simulated, as opposed to
 * which year. "Run settings" rather than "Preferences", which reads as app
 * options like the theme.
 *
 * **Made of groups, and a setting is a direct child of its group.** The headings
 * are what the reader scans (Races, Cars, Drivers, Teams over the years); the
 * padding and the rules between settings are applied here, so adding one is
 * adding a child and nothing else — no wrapper to remember, and no chance of two
 * settings sitting at different insets.
 *
 * What does *not* belong here: anything a reader can still change once a season
 * is on screen. The ability toggle is on the grid for that reason.
 */
export function RunSettingsCard({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run settings</CardTitle>
        <CardDescription>Chosen now, and fixed for the whole {unit}.</CardDescription>
      </CardHeader>
      <div className="divide-border divide-y">{children}</div>
    </Card>
  );
}

/** One headed group of settings inside `RunSettingsCard`. */
export function RunSettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="text-subtle px-5 pt-4 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      <div className="divide-border divide-y [&>*]:px-5 [&>*]:py-4">{children}</div>
    </section>
  );
}
