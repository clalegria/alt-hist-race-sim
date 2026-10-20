import type { ComponentProps, ReactNode } from "react";
import { cn, DISPLAY_CAPS, MONO_LABEL } from "../../lib/utils.js";

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

/** An `h2`, or an `h3` for a card under a section's own heading. */
export function CardTitle({
  className,
  as: Heading = "h2",
  ...props
}: ComponentProps<"h2"> & { as?: "h2" | "h3" | undefined }) {
  return <Heading className={cn(DISPLAY_CAPS, "text-lg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

/**
 * A panel's slim head band, as a timing screen draws one: the title, and a
 * short label in mono capitals on the right (a count, how far the season has
 * got). Never a sentence: one that needs saying goes in the panel's body.
 *
 * `children` are the panel's controls (a sort switch, its buttons), set at the
 * right with the label beside the title instead.
 */
export function CardBand({
  title,
  label,
  as,
  children,
}: {
  title: ReactNode;
  label?: ReactNode;
  /** The title's level: `h3` for a card under a section's heading. */
  as?: "h2" | "h3";
  children?: ReactNode;
}) {
  const labelled = label === undefined ? null : <p className={MONO_LABEL}>{label}</p>;
  return (
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5">
      {children === undefined ? (
        <>
          <CardTitle as={as}>{title}</CardTitle>
          {labelled}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <CardTitle as={as}>{title}</CardTitle>
            {labelled}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
        </>
      )}
    </CardHeader>
  );
}
