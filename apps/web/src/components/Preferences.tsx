import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

/**
 * How the run is simulated, as opposed to what is simulated.
 *
 * One setting so far — randomness — but the panel is named for the category
 * rather than for its only occupant, because that is what it is going to be:
 * the ability mode is the obvious next one, and anything else that has to be
 * decided *before* a season exists belongs here too.
 *
 * **A setting is a direct child.** The padding and the rules between them are
 * applied here, so adding one is adding a child and nothing else — no wrapper
 * to remember, and no chance of two settings sitting at different insets. That
 * is the whole reason this is a component rather than a `Card` written out
 * twice in the picker.
 *
 * What does *not* belong here: anything a reader can still change once a season
 * is on screen. The ability toggle is on the grid today for that reason, and
 * moving it would be a decision about when it stops being changeable, not a
 * tidying-up.
 */
export function Preferences({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          How the racing is simulated. Chosen now, and fixed for the whole run.
        </CardDescription>
      </CardHeader>
      <div className="divide-border divide-y [&>*]:px-5 [&>*]:py-4">{children}</div>
    </Card>
  );
}
