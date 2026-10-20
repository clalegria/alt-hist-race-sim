import { cn } from "../lib/utils.js";

/**
 * The foot of every page.
 *
 * In `Shell` rather than on the screens themselves, so it cannot go missing
 * from one of them: the attribution is a claim about the whole app, not about
 * whichever screen happens to render it, and a credit that appears on three
 * screens out of five reads as an oversight.
 *
 * The seed rides along in the same strip because it is the same kind of thing —
 * a fact about the run rather than part of it — and it is handed in rather than
 * read from the store, since only the season screen has one to show.
 */

/**
 * A destination that does not exist yet.
 *
 * Deliberately not an `<a>`: an anchor with no `href` is not a link to anything,
 * and one pointing at `#` is a link that lies. A disabled button says what this
 * is — something that will be clickable and is not yet — to a screen reader as
 * well as to the eye.
 */
function Pending({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Not available yet"
      className="text-subtle cursor-not-allowed underline underline-offset-3"
    >
      {label}
    </button>
  );
}

/** A strip across the whole window, ruled off at its top; its text keeps to the page's column. */
export function SiteFooter({ seed, className }: { seed?: number; className?: string }) {
  return (
    <footer className={cn("border-border border-t", className)}>
      <div className="text-subtle mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-4 pb-6 text-xs sm:px-6 lg:pb-8">
        <span>
          Developed by Claudio Alegria, 2026, in collaboration with Anthropic Claude Code.
        </span>
        <Pending label="About this project" />
        <Pending label="Submit a bug report" />
        {seed === undefined ? null : (
          <span className="ml-auto">
            Run <span className="tabular-nums">{seed}</span>
          </span>
        )}
      </div>
    </footer>
  );
}
