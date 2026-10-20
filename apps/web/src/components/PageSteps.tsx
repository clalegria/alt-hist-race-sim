import { Link } from "@tanstack/react-router";
import type { PageSteps, Step } from "../lib/page-steps.js";
import { cn } from "../lib/utils.js";

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
 * One arrow: a link with its place in the tooltip, or a dimmed square — still
 * drawn, so the other arrow never moves — while the place is ahead or there is
 * none. Its tap area reaches up and down past the square, not sideways onto
 * its neighbour.
 */
function StepArrow({ step, direction }: { step: Step | null; direction: "previous" | "next" }) {
  if (step === null || step.link === null) {
    return (
      <span
        aria-disabled="true"
        {...(step === null
          ? { "aria-hidden": true }
          : { title: step.title, "aria-label": step.title })}
        className={cn(TRAIL_SQUARE, "text-subtle text-sm opacity-60")}
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
      className={cn(
        TRAIL_SQUARE,
        TRAIL_SQUARE_LIVE,
        "text-sm before:absolute before:-inset-y-2.5 before:inset-x-0",
      )}
    >
      {GLYPH[direction]}
    </Link>
  );
}

/**
 * The page either side, as two arrows after the run bar's trail. Both are
 * always drawn, so a reader stepping along clicks the same spot each time; the
 * place each leads to is in its tooltip, and in words at the foot of the page
 * (`StepLinks`).
 */
export function StepArrows({ steps }: { steps: PageSteps }) {
  return (
    <nav aria-label="Previous and next" className="-my-0.5 flex shrink-0 items-center gap-1.5">
      <StepArrow step={steps.previous} direction="previous" />
      <StepArrow step={steps.next} direction="next" />
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
