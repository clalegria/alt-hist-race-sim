import { Button } from "./ui/button.js";

/**
 * The way back from an era's first grid to its setup page, for a reader who
 * wants another year after all.
 *
 * The era's counterpart of `SeasonSwitcher`, in the same slot: an era's year
 * is the run's, so the grid cannot step to the next one, but until the reader
 * has changed anything there is nothing to lose by picking again. Greyed out
 * once they have (`backToSetupLock`), with the reason on the wrapper, since a
 * disabled button takes no pointer events.
 */
export function BackToSetup({
  lock,
  onBack,
}: {
  /** Why it cannot go back, or null while it can. */
  lock: string | null;
  /** Absent in tests, where nothing is clicked. The button still renders. */
  onBack?: () => void;
}) {
  return (
    <span className="inline-flex" {...(lock === null ? {} : { title: lock })}>
      <Button
        variant="outline"
        size="sm"
        disabled={lock !== null}
        onClick={() => {
          onBack?.();
        }}
      >
        <span aria-hidden="true">&larr;</span>
        Back to setup
      </Button>
    </span>
  );
}
