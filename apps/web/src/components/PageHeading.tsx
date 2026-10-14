import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { Flag } from "./Flag.js";

/**
 * A page's one `<h1>`, in big narrow capitals, with a sub-line in mono
 * capitals under it. Every page has one except Home, whose hero is its own.
 *
 * `flag` is a country code drawn ahead of the title at the one size a heading's
 * flag has; `title` may carry more after the words, such as the wet pill.
 */
export function PageHeading({
  title,
  sub,
  flag,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  flag?: string | undefined;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <h1 className="narrow flex flex-wrap items-center gap-2.5 text-4xl leading-none font-extrabold tracking-[0.01em] uppercase md:text-5xl">
        {flag === undefined || flag === "" ? null : (
          <Flag country={flag} title={flag} className="h-5 w-7.5" />
        )}
        {title}
      </h1>
      {sub === undefined ? null : (
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">{sub}</p>
      )}
    </div>
  );
}
