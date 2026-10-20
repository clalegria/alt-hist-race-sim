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

/** One of the footer's parts: as it is in the strip, or on a board of its own on the verge. */
function Part({
  onVerge,
  className,
  children,
}: {
  onVerge: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(onVerge && "bg-card border-border border px-2 py-0.5", className)}>
      {children}
    </span>
  );
}

/**
 * A strip across the whole window, ruled off at its top; its text keeps to the
 * page's column.
 *
 * `onVerge` is for a page whose foot is the track (Home): the footer becomes the
 * track's lower verge, its parts trackside boards along it, so it sits in the
 * window with the track instead of a scroll below it.
 */
export function SiteFooter({
  seed,
  onVerge = false,
  className,
}: {
  seed?: number;
  onVerge?: boolean;
  className?: string;
}) {
  return (
    <footer className={cn(onVerge ? "track-verge" : "border-border border-t", className)}>
      <div
        className={cn(
          "text-subtle mx-auto flex max-w-5xl flex-wrap items-center px-4 text-xs sm:px-6",
          // On the verge, the track's own strip of grass is the space above the boards.
          onVerge
            ? "short:pb-1 justify-center gap-x-3 gap-y-1.5 pb-2"
            : "gap-x-4 gap-y-1.5 pt-4 pb-6 lg:pb-8",
        )}
      >
        <Part onVerge={onVerge}>
          Developed by Claudio Alegria, 2026, in collaboration with Anthropic Claude Code.
        </Part>
        <Part onVerge={onVerge}>
          <Pending label="About this project" />
        </Part>
        <Part onVerge={onVerge}>
          <Pending label="Submit a bug report" />
        </Part>
        {seed === undefined ? null : (
          <Part onVerge={onVerge} className={cn(!onVerge && "ml-auto")}>
            Run <span className="tabular-nums">{seed}</span>
          </Part>
        )}
      </div>
    </footer>
  );
}
