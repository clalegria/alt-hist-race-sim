/** A place in the window, in px. */
export interface Point {
  x: number;
  y: number;
}

/** How far the tooltip sits from the pointer, in px. */
const TOOLTIP_GAP_PX = 14;

/**
 * Which car it is, beside the pointer on the side with more room, under the
 * dialogs. The track's own, since its cars move under a still pointer; a still
 * car elsewhere takes a plain `title`, as every other tooltip does.
 */
export function CarTooltip({ line, at }: { line: string; at: Point }) {
  const leftward = at.x > window.innerWidth / 2;
  const upward = at.y > window.innerHeight / 2;
  return (
    <div
      aria-hidden="true"
      className="bg-card text-card-foreground border-border pointer-events-none fixed z-40 border px-3 py-2 text-sm whitespace-nowrap shadow-xl"
      style={{
        ...(leftward
          ? { right: window.innerWidth - at.x + TOOLTIP_GAP_PX }
          : { left: at.x + TOOLTIP_GAP_PX }),
        ...(upward
          ? { bottom: window.innerHeight - at.y + TOOLTIP_GAP_PX }
          : { top: at.y + TOOLTIP_GAP_PX }),
      }}
    >
      {line}
    </div>
  );
}
