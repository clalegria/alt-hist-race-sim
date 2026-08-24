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
      className="cursor-not-allowed underline decoration-dotted underline-offset-2 opacity-60"
    >
      {label}
    </button>
  );
}

export function SiteFooter({ seed }: { seed?: number }) {
  return (
    <footer className="border-border text-subtle mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs">
      <span>Developed by Claudio Alegria, 2026, in collaboration with Anthropic Claude Code.</span>
      <Pending label="About this project" />
      <Pending label="Submit a bug report" />
      {seed === undefined ? null : (
        <span className="ml-auto">
          Seed <span className="font-mono tabular-nums">{seed}</span>
        </span>
      )}
    </footer>
  );
}
