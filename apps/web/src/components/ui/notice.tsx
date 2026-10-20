import type { ReactNode } from "react";
import { cn, MONO_LABEL } from "../../lib/utils.js";

const TONES = {
  /** A caveat: an edited grid, a kept one. Never the accent, which means a win. */
  muted: "border-border bg-muted/40",
  /**
   * An instruction the reader has to act on before going on: empty seats to fill.
   * Teal outside a win, like the grid's top overall chips: the author's call.
   */
  accent: "border-primary/50 bg-primary/5",
} as const;

/**
 * A dashed box inside a panel, saying something about what is below it. Dashed
 * so it never reads as a panel of its own; its head is a mono label, with an
 * optional control opposite it.
 */
export function Notice({
  title,
  action,
  tone = "muted",
  className,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border border-dashed px-3 py-2", TONES[tone], className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <p className={cn(MONO_LABEL, "text-foreground")}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
