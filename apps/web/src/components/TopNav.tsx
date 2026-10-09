import { Link } from "@tanstack/react-router";
import { AREAS, type Area, isAvailable } from "../lib/areas.js";
import { PARADE_COVER } from "../lib/parade.js";
import { ThemeToggle } from "./ThemeToggle.js";

/**
 * The bar across the top of every page: the app's name, its areas, and the
 * theme toggle.
 *
 * Every entry is a `Link` — a real `<a href>`, so it can be opened in a new tab
 * or copied, while a plain click is caught by the router and changes the page
 * without reloading it. The router marks the entry for the current URL with
 * `aria-current="page"`, which is what the active style hangs off.
 *
 * An unbuilt area is a disabled button, not a link: an anchor to nowhere is a
 * link that lies, the same reason the footer's pending entries are buttons.
 *
 * Not sticky: the page's own bar below it is the one that stays, because that
 * is where the way forward is. But it wears that bar's surface — the same
 * translucent background and blur over the page's texture — so the two read as
 * one header rather than two different strips stacked.
 *
 * `areas` is a prop only so the tests can hand it an entry that has a page but
 * an unbuilt mode, which today's list does not contain.
 */
export function TopNav({ areas = AREAS }: { areas?: readonly Area[] }) {
  return (
    <header {...PARADE_COVER} className="bg-background/85 border-border border-b backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span aria-hidden="true" className="bg-primary inline-block size-2.5 rotate-45" />
          alt-hist
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          {areas.map((area) =>
            area.to !== undefined && isAvailable(area) ? (
              <Link
                key={area.label}
                to={area.to}
                className="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground text-sm transition-colors"
              >
                {area.label}
              </Link>
            ) : (
              <button
                key={area.label}
                type="button"
                disabled
                title="Not available yet"
                className="text-muted-foreground cursor-not-allowed text-sm opacity-55"
              >
                {area.label}
              </button>
            ),
          )}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
