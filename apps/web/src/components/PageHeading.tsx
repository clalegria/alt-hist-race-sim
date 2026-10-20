import type { ReactNode } from "react";
import { cn, DISPLAY_CAPS, MONO_LINE } from "../lib/utils.js";
import { Flag } from "./Flag.js";

/**
 * A page's one `<h1>`, in big narrow capitals, with a sub-line in mono
 * capitals under it. Every page has one except Home, whose hero is its own.
 *
 * `flag` is a country code drawn ahead of the title at the one size a heading's
 * flag has, and `badge` a team's livery badge ahead of that, badge then flag as
 * every name has them; `title` may carry more after the words, such as the wet
 * pill.
 */
export function PageHeading({
  title,
  sub,
  flag,
  badge,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  flag?: string | undefined;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <h1
        className={cn(
          DISPLAY_CAPS,
          "flex flex-wrap items-center gap-2.5 text-4xl leading-none md:text-5xl",
        )}
      >
        {badge}
        {flag === undefined || flag === "" ? null : <Flag country={flag} className="h-5 w-7.5" />}
        {title}
      </h1>
      {sub === undefined ? null : <p className={cn(MONO_LINE, "text-muted-foreground")}>{sub}</p>}
    </div>
  );
}
