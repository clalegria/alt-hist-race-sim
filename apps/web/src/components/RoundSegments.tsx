/**
 * A season as one segment per round, done or to come: how far a run has got,
 * at a glance. The numbers are `runBarFor`'s (`rounds`, `roundsRun`).
 *
 * Hidden from screen readers: it always sits beside the cursor line, which
 * says the same in words. A segment's state is a `data-done` attribute, which
 * the fill reads through Tailwind's `data-` variant.
 */
export function RoundSegments({ rounds, done }: { rounds: number; done: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid w-full max-w-[260px] gap-[3px]"
      // The count is data, so the columns are too.
      style={{ gridTemplateColumns: `repeat(${rounds}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rounds }, (_, round) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a round is its position.
          key={round}
          {...(round < done ? { "data-done": "" } : {})}
          className="bg-border data-[done]:bg-primary h-1.5"
        />
      ))}
    </div>
  );
}
