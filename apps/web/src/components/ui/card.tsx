import type { ComponentProps, ReactNode } from "react";
import { cn, MONO_LABEL } from "../../lib/utils.js";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground border-border overflow-hidden rounded-xl border",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "bg-card-header border-border flex flex-col gap-1 border-b px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("narrow text-lg font-extrabold uppercase", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

/**
 * A panel's slim head band, as a timing screen draws one: the title, and a
 * short label in mono capitals on the right (a count, how far the season has
 * got). Never a sentence: one that needs saying goes in the panel's body.
 */
export function CardBand({ title, label }: { title: ReactNode; label?: ReactNode }) {
  return (
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
      <CardTitle>{title}</CardTitle>
      {label === undefined ? null : <p className={MONO_LABEL}>{label}</p>}
    </CardHeader>
  );
}
