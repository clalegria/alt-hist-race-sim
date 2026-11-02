import { Link } from "@tanstack/react-router";
import type { RunLink } from "../lib/run-places.js";
import { cn, DISPLAY_CAPS, MONO_LABEL } from "../lib/utils.js";
import { RoundSegments } from "./RoundSegments.js";
import { Button, buttonClass } from "./ui/button.js";

/** A Home panel: bordered, with a head band darker than its body; tighter on a short window (`MainMenu`). */
function HomePanel({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border-border border">
      <div className="bg-card-header border-border flex items-center gap-2 border-b px-3 py-2 lg:short:py-1.5">
        {head}
      </div>
      <div className="flex flex-col gap-2 p-3 lg:short:gap-1.5 lg:short:p-2.5">{children}</div>
    </div>
  );
}

/**
 * The run in progress, from Home, as a live session: the way back into it, and
 * the way out of it.
 *
 * Going Home does not end a run — it waits, and this panel is where it waits.
 * Resume is a `Link` to the cursor's page rather than a button, so it is a real
 * address that can be opened in a new tab. Exit run sits beside it, not inside
 * it: an `<a>` cannot hold a button.
 */
export function ResumeRun({
  title,
  detail,
  rounds,
  roundsRun,
  car,
  link,
  onExit,
}: {
  /** Which run: "Era from 1980", "1984 season". */
  title: string;
  /** How far it has got, as the run bar says it. */
  detail: string;
  /** The cursor's season, as `runBarFor` counts it. */
  rounds: number;
  roundsRun: number;
  /** The championship leader's car (`runLeader`), once there is one, and who it is. */
  car?: { readonly drawing: React.ReactNode; readonly label: string };
  link: RunLink;
  /** Asks, when there is anything to lose, then ends the run. */
  onExit?: () => void;
}) {
  return (
    <HomePanel
      head={
        <>
          <span
            aria-hidden="true"
            className="bg-primary ring-primary/25 size-2 shrink-0 rounded-full ring-3"
          />
          <span className={MONO_LABEL}>In progress · Resume run</span>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            DISPLAY_CAPS,
            // A one-off headline size between the scale's text-2xl and text-3xl.
            "text-[1.625rem] leading-none lg:short:text-[1.375rem]",
          )}
        >
          {title}
        </span>
        {car === undefined ? null : (
          // A plain tooltip, as the people pages' cars have.
          <figure title={car.label} className="shrink-0">
            {car.drawing}
          </figure>
        )}
      </div>
      <span className={MONO_LABEL}>{detail}</span>
      <RoundSegments rounds={rounds} done={roundsRun} />
      <div className="mt-1 flex flex-wrap gap-2 lg:short:mt-0">
        <Link {...link} className={buttonClass("primary")}>
          Resume <span aria-hidden="true">▸</span>
        </Link>
        <Button variant="outline" onClick={onExit}>
          Exit run
        </Button>
      </div>
    </HomePanel>
  );
}

/**
 * Where the live session would be, when the run saved before a reload could
 * not be rebuilt (`store/persist.ts`): this build would replay it differently,
 * and a run quietly rewritten under the reader is worse than one that is gone.
 */
export function RunNotResumed({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <HomePanel head={<span className={MONO_LABEL}>Last run</span>}>
      <p className="text-muted-foreground text-sm">
        Your last run couldn't be reopened, because the app has been updated since.
      </p>
      <div className="mt-1 flex">
        <Button variant="outline" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </HomePanel>
  );
}
