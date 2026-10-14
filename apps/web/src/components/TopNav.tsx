import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { AREAS, type Area, isAvailable } from "../lib/areas.js";
import { cn } from "../lib/utils.js";
import { ThemeToggle } from "./ThemeToggle.js";

/**
 * One area's entry. On a wide screen a tab in the band, the current one
 * underlined; in the phone's open menu a full-width row, the current one barred
 * on the left. The transparent bar on the other side keeps the label centred.
 */
const TAB =
  "narrow flex items-center px-2.5 py-2.5 text-[15px] font-bold tracking-wide whitespace-nowrap uppercase transition-colors md:py-0 border-l-3 border-transparent md:border-l-0 md:border-y-3";

/**
 * The bar across the top of every page: the Home link, the app's areas, and
 * the theme toggle, on the header band (`card-header`), darker than the run bar
 * below it as a table's header is darker than its rows.
 *
 * Every entry is a `Link` — a real `<a href>`, so it can be opened in a new tab
 * or copied, while a plain click is caught by the router and changes the page
 * without reloading it. The router marks the entry for the current URL with
 * `aria-current="page"`, which is what the active style hangs off.
 *
 * An unbuilt area is a disabled button, not a link: an anchor to nowhere is a
 * link that lies, the same reason the footer's pending entries are buttons.
 *
 * Below `md` the areas fold behind ☰. It is a disclosure — a button with
 * `aria-expanded` that shows and hides the same `<nav>` — not a Radix menu:
 * ARIA's `menu` role is for commands, and a disclosure renders no portal, so the
 * nav is one element at every width and the static tests see every entry. The
 * open list sits in the page's flow, pushing it down rather than covering it.
 *
 * `areas` is a prop only so the tests can hand it an entry that has a page but
 * an unbuilt mode, which today's list does not contain.
 */
export function TopNav({ areas = AREAS }: { areas?: readonly Area[] }) {
  const navId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // Any page change closes the menu: a tab, a Home card, Back. React's way to
  // reset state when a value changes is to compare during render, not an effect.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [shownAt, setShownAt] = useState(pathname);
  if (pathname !== shownAt) {
    setShownAt(pathname);
    setOpen(false);
  }

  // Escape closes it from anywhere, focus back on the button that opened it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="bg-card-header border-border border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-stretch gap-x-4 px-4 sm:px-6 md:h-[50px] md:flex-nowrap">
        <Link
          to="/"
          className="narrow flex h-[50px] items-center gap-2 text-[17px] font-extrabold tracking-wide uppercase md:h-auto"
        >
          <ChequeredFlag />
          Home
        </Link>
        <nav
          id={navId}
          aria-label="Main"
          className={cn(
            "min-w-0 md:flex md:flex-1 md:basis-auto md:flex-row md:gap-0.5 md:pb-0",
            open ? "order-last flex basis-full flex-col pb-2 md:order-none" : "hidden",
          )}
        >
          {areas.map((area) =>
            area.to !== undefined && isAvailable(area) ? (
              <Link
                key={area.label}
                to={area.to}
                className={cn(
                  TAB,
                  "text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:border-l-primary md:aria-[current=page]:border-b-primary",
                )}
              >
                {area.label}
              </Link>
            ) : (
              <button
                key={area.label}
                type="button"
                disabled
                title="Not available yet"
                className={cn(TAB, "text-subtle cursor-not-allowed")}
              >
                {area.label}
              </button>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            ref={toggle}
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => {
              setOpen(!open);
            }}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>
    </header>
  );
}

/** Three bars, or a cross while the menu is open: the convention for a menu button. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d={open ? "M5 5l14 14M19 5L5 19" : "M3 6h18M3 12h18M3 18h18"} />
    </svg>
  );
}

/** The flag's two colours, the favicon's: the dark theme's teal and its near-white. */
const FLAG = { teal: "#48b7c0", white: "#f5f3f0" } as const;

/**
 * The Home link's mark: a 4×4 chequered flag, one path per colour, in the same
 * teal and white in both themes, the favicon's (`index.html`). It is the app's
 * mark, so it does not follow the theme. `crispEdges` keeps each square sharp, as
 * `TeamCar` does for its pixels; at `size-3` a square is 3px. Decorative, so the
 * link's name is just "Home".
 */
function ChequeredFlag() {
  return (
    <svg aria-hidden="true" viewBox="0 0 4 4" shapeRendering="crispEdges" className="size-3">
      <path
        fill={FLAG.teal}
        d="M0 0h1v1H0zM2 0h1v1H2zM1 1h1v1H1zM3 1h1v1H3zM0 2h1v1H0zM2 2h1v1H2zM1 3h1v1H1zM3 3h1v1H3z"
      />
      <path
        fill={FLAG.white}
        d="M1 0h1v1H1zM3 0h1v1H3zM0 1h1v1H0zM2 1h1v1H2zM1 2h1v1H1zM3 2h1v1H3zM0 3h1v1H0zM2 3h1v1H2z"
      />
    </svg>
  );
}
