import { STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { cn, DISPLAY_CAPS } from "../lib/utils.js";
import { Flag } from "./Flag.js";

/**
 * The moment a championship stops being a contest.
 *
 * Shown on the round it happens and only that round. Repeating it afterwards
 * turns the beat the season has been building to into a standing notice, and the
 * champion's row in the standings already carries the accent from then on.
 */
export function TitleBanner({
  title,
  name,
  country,
}: {
  /** "Drivers" or "Constructors". */
  title: string;
  name: string;
  country?: string | undefined;
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 border px-4 py-3 text-sm",
        STANDOUT_SURFACE,
      )}
    >
      {country === undefined || country === "" ? null : (
        <Flag country={country} title={country} className="h-4 w-6" />
      )}
      {/* The name as the tower sets a name, and the words after it plain. */}
      <span className={cn(DISPLAY_CAPS, "text-2xl leading-none", STANDOUT_TEXT)}>{name}</span>
      <span>{`wins the ${title}’ Championship!`}</span>
    </p>
  );
}
