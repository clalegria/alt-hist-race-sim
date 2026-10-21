import { Link } from "@tanstack/react-router";
import type { PageSteps, Step } from "../lib/page-steps.js";
import { cn } from "../lib/utils.js";
import { buttonClass } from "./ui/button.js";

/**
 * The outlined 24px square a control in the trail is drawn as: the ▾ beside a
 * crumb and the two arrows after it, so they cannot drift apart.
 */
export const TRAIL_SQUARE =
  "border-border relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors";

/** A live square's colours: muted at rest, lit under the pointer and the keyboard. */
export const TRAIL_SQUARE_LIVE =
  "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none";

const GLYPH = { previous: "‹", next: "›" } as const;

/**
 * Where a pair of arrows is drawn: after the run bar's trail, as its 24px
 * squares, or in a phone's band pinned to the screen's foot, as 36px buttons
 * beside the run's actions, the size a thumb wants.
 */
export type ArrowsAt = "trail" | "foot";

/** An arrow's look, by where it is drawn: live, and dimmed while it leads nowhere. */
const ARROW: Record<ArrowsAt, { readonly live: string; readonly dead: string }> = {
  trail: {
    // The tap area reaches up and down past the square, not sideways onto its neighbour.
    live: cn(
      TRAIL_SQUARE,
      TRAIL_SQUARE_LIVE,
      "text-sm before:absolute before:-inset-y-2.5 before:inset-x-0",
    ),
    dead: cn(TRAIL_SQUARE, "text-subtle text-sm opacity-60"),
  },
  foot: {
    live: buttonClass("outline", "w-9 px-0 text-lg"),
    dead: buttonClass(
      "outline",
      "text-subtle w-9 cursor-default px-0 text-lg hover:bg-transparent",
    ),
  },
};

/**
 * One arrow: a link with its place in the tooltip, or a dimmed one — still
 * drawn, so the other arrow never moves — while the place is ahead or there is
 * none.
 */
function StepArrow({
  step,
  direction,
  at,
}: {
  step: Step | null;
  direction: "previous" | "next";
  at: ArrowsAt;
}) {
  if (step === null || step.link === null) {
    return (
      <span
        aria-disabled="true"
        {...(step === null
          ? { "aria-hidden": true }
          : { title: step.title, "aria-label": step.title })}
        className={ARROW[at].dead}
      >
        {GLYPH[direction]}
      </span>
    );
  }
  return (
    <Link
      {...step.link}
      rel={direction === "previous" ? "prev" : "next"}
      aria-label={step.title}
      title={step.title}
      className={ARROW[at].live}
    >
      {GLYPH[direction]}
    </Link>
  );
}

/**
 * The page either side, as two arrows: after the run bar's trail from `md`
 * up, and at the left of a phone's pinned foot band below it, opposite the
 * way on (`RunFrame`). Both are always drawn, so a reader stepping along
 * presses the same spot each time; the place each leads to is in its tooltip,
 * and in words at the foot of the page (`StepLinks`).
 *
 * `className` says the widths this copy shows at.
 */
export function StepArrows({
  steps,
  at = "trail",
  className,
}: {
  steps: PageSteps;
  at?: ArrowsAt;
  className?: string;
}) {
  return (
    <nav
      aria-label="Previous and next"
      className={cn(
        "flex shrink-0 items-center",
        at === "trail" ? "-my-0.5 gap-1.5" : "gap-2",
        className,
      )}
    >
      <StepArrow step={steps.previous} direction="previous" at={at} />
      <StepArrow step={steps.next} direction="next" at={at} />
    </nav>
  );
}

/** One side of the foot's pair: the arrow and where it leads, or that it is not yet. */
function StepLink({ step, direction }: { step: Step; direction: "previous" | "next" }) {
  const label = step.link === null ? `${step.label} (not reached yet)` : step.label;
  const text = direction === "previous" ? `${GLYPH.previous} ${label}` : `${label} ${GLYPH.next}`;
  const align = direction === "next" && "text-right";
  return step.link === null ? (
    <span aria-disabled="true" title={step.title} className={cn("text-subtle text-sm", align)}>
      {text}
    </span>
  ) : (
    <Link
      {...step.link}
      rel={direction === "previous" ? "prev" : "next"}
      title={step.title}
      className={cn("text-primary text-sm font-medium underline-offset-4 hover:underline", align)}
    >
      {text}
    </Link>
  );
}

/**
 * The page either side, at the foot of the page, named: where a reader who
 * has just finished reading is, and where a phone, with no tooltips, says
 * where the arrows go.
 */
export function StepLinks({ steps }: { steps: PageSteps }) {
  if (steps.previous === null && steps.next === null) {
    return null;
  }
  return (
    <nav aria-label="Previous and next" className="flex items-start justify-between gap-6">
      {steps.previous === null ? <span /> : <StepLink step={steps.previous} direction="previous" />}
      {steps.next === null ? <span /> : <StepLink step={steps.next} direction="next" />}
    </nav>
  );
}
