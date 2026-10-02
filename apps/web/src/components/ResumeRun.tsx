import { Link } from "@tanstack/react-router";
import type { RunLink } from "../lib/run-places.js";
import { Button } from "./ui/button.js";

/**
 * The run in progress, from Home: the way back into it, and the way out of it.
 *
 * Going Home does not end a run — it waits, and this card is where it waits.
 * The resume half is a `Link` to the cursor's page rather than a button, so it
 * is a real address that can be opened in a new tab. Exit run sits beside it,
 * not inside it: an `<a>` cannot hold a button, and the two are different
 * answers to the same card.
 */
export function ResumeRun({
  title,
  detail,
  link,
  onExit,
}: {
  /** Which run: "Era from 1980", "1984 season". */
  title: string;
  /** How far it has got, as the run bar says it. */
  detail: string;
  link: RunLink;
  /** Asks, when there is anything to lose, then ends the run. */
  onExit?: () => void;
}) {
  return (
    <div className="bg-card border-primary/60 flex flex-wrap items-center gap-3 rounded-xl border shadow-sm">
      <Link
        {...link}
        className="hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 flex-col items-start gap-1 rounded-xl p-5 text-left transition focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Resume run
        </span>
        <span className="text-base font-semibold tracking-tight">{title}</span>
        <span className="text-muted-foreground text-sm">{detail}</span>
      </Link>
      <Button variant="ghost" className="mr-4" onClick={onExit}>
        Exit run
      </Button>
    </div>
  );
}

/**
 * Where the Resume card would be, when the run saved before a reload could not
 * be rebuilt (`store/persist.ts`): this build would replay it differently, and
 * a run quietly rewritten under the reader is worse than one that is gone.
 */
export function RunNotResumed({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-5 shadow-sm">
      <p className="text-muted-foreground min-w-0 flex-1 text-sm">
        Your last run couldn't be resumed: it was made on a different version of the simulator.
      </p>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
