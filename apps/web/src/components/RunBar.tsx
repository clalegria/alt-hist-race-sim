import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { Crumb, CrumbMenu, ReturnLink, RunBarState } from "../lib/run-bar.js";
import { Button, buttonClass } from "./ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";

/**
 * A crumb's siblings, behind a `▾` beside it: the other years, or the other
 * rounds of this one. Each is a `Link` inside the menu item (`asChild`), so it
 * is a real anchor — it opens in a new tab — with Radix's keyboard handling
 * around it. One still ahead is listed, disabled, so the season's length shows.
 */
function CrumbMenuButton({ menu }: { menu: CrumbMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={menu.label}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded px-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-48 overflow-y-auto">
        {menu.items.map((item) =>
          item.link === null ? (
            <DropdownMenuItem key={item.label} disabled>
              {item.label} <span className="text-muted-foreground ml-auto pl-3">not yet</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} asChild>
              <Link
                {...item.link}
                {...(item.current ? { "aria-current": "page" as const } : {})}
                className={item.current ? "font-semibold" : undefined}
              >
                {item.label}
                {item.current ? (
                  <span aria-hidden="true" className="ml-auto pl-3">
                    ✓
                  </span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Where this page sits in the run: `Era › 1984 ▾ › Round 3 ▾ › Race`.
 *
 * A real `<nav>` with an ordered list, the pattern screen readers announce as a
 * breadcrumb trail, and `aria-current="page"` on the last crumb. A crumb with a
 * link is a `Link`, so it can be opened in a new tab like any other. A crumb
 * with siblings has a menu of them beside it — the breadcrumb switcher — so
 * the trail moves across years and rounds as well as up.
 */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.label}>
              {index === 0 ? null : (
                <li aria-hidden="true" className="text-muted-foreground">
                  ›
                </li>
              )}
              <li className="flex items-center gap-0.5">
                {crumb.link !== undefined ? (
                  <Link
                    {...crumb.link}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    {...(last ? { "aria-current": "page" as const } : {})}
                    className={last ? "font-semibold tracking-tight" : "text-muted-foreground"}
                  >
                    {crumb.label}
                  </span>
                )}
                {crumb.menu === undefined ? null : <CrumbMenuButton menu={crumb.menu} />}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export interface RunActionsProps {
  readonly state: RunBarState;
  /** True while the grid is being rearranged, which is not a moment to step on. */
  readonly editingGrid: boolean;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
  /** Opens the jump dialog. */
  readonly onJump: () => void;
  /** Asks, then restarts this season. */
  readonly onRestartSeason: () => void;
  /** Asks, then restarts the whole era. */
  readonly onRestartEra: () => void;
  /** Asks, then exits the run. */
  readonly onExit: () => void;
  /**
   * The way back to where the run is, while the page on screen is elsewhere;
   * null or absent on the cursor's own page.
   */
  readonly returnTo?: ReturnLink | null;
}

/** One action, as both layouts draw it. */
interface Action {
  readonly label: string;
  readonly onSelect: () => void;
}

/**
 * The run's actions, in three kinds: **forward** (Continue, the skip to this
 * season's end, Jump to…), **over again** (Restart season, Restart era) and
 * **out** (Exit run). Nothing goes back in time; Back is the browser's, and
 * moves between pages.
 *
 * All of them are on the bar on a wide screen — Continue as the one primary
 * button, the other ways forward beside it, the ones that throw work away
 * quieter at the end. On a phone there is room for Continue alone, so the rest
 * fold into ⋯: the same list, so the two layouts cannot offer different things.
 * Both are rendered and CSS shows one, which keeps the choice in the stylesheet
 * (a media query, `md:`) rather than in script.
 *
 * Drawn twice, in the sticky bar and at the foot of the page, from one set of
 * props, so the two copies always show the same thing.
 */
export function RunActions(props: RunActionsProps) {
  if (props.editingGrid) {
    // No way forward while a grid is half-rearranged: the draft would go with
    // it, and the season simulated would be the one the reader was replacing.
    return (
      <span className="text-muted-foreground text-xs">
        Editing the grid. Apply or cancel it to carry on.
      </span>
    );
  }

  const { state } = props;
  // Away from the cursor's page, the way back takes the primary slot and
  // Continue steps aside: it would advance a run the reader is not looking at.
  const away = props.returnTo ?? null;
  const forward: Action[] = [
    ...(state.skip === null ? [] : [{ label: state.skip, onSelect: props.onSkip }]),
    ...(state.jump ? [{ label: "Jump to…", onSelect: props.onJump }] : []),
  ];
  // On a phone there is room for one button beside ⋯, so Continue joins the menu.
  const phoneForward: Action[] =
    away === null || state.next === null
      ? forward
      : [{ label: "Continue", onSelect: props.onContinue }, ...forward];
  const over: Action[] = [
    ...(state.restartSeason ? [{ label: "Restart season", onSelect: props.onRestartSeason }] : []),
    ...(state.restartEra ? [{ label: "Restart era", onSelect: props.onRestartEra }] : []),
    { label: "Exit run", onSelect: props.onExit },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {away === null ? null : (
        <Link {...away.link} className={buttonClass("primary")}>
          <span aria-hidden="true" className="mr-1.5">
            ↩
          </span>
          Back to {away.label}
        </Link>
      )}
      {state.next === null ? null : (
        <Button
          onClick={props.onContinue}
          title={`Next: ${state.next}`}
          variant={away === null ? "primary" : "outline"}
          // Away, it is on the ⋯ menu on a phone instead.
          className={away === null ? undefined : "hidden md:inline-flex"}
        >
          Continue
          <span aria-hidden="true" className="ml-1.5">
            ▸
          </span>
        </Button>
      )}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {forward.map((action) => (
          <Button key={action.label} variant="outline" onClick={action.onSelect}>
            {action.label}
          </Button>
        ))}
        {over.map((action) => (
          <Button key={action.label} variant="ghost" onClick={action.onSelect}>
            {action.label}
          </Button>
        ))}
      </div>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="More run actions" className="px-3">
              <span aria-hidden="true">⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {phoneForward.map((action) => (
              <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
                {action.label}
              </DropdownMenuItem>
            ))}
            {phoneForward.length === 0 ? null : <DropdownMenuSeparator />}
            {over.map((action) => (
              <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * The run bar's contents: the trail to this page on the left, how far the run
 * has got and the way on at the right — navigation is the right-hand end of
 * the bar on every page.
 */
export function RunBar({ crumbs, ...actions }: RunActionsProps & { crumbs: readonly Crumb[] }) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5 leading-tight">
        <Breadcrumbs crumbs={crumbs} />
        {actions.returnTo === undefined || actions.returnTo === null ? (
          <span className="text-muted-foreground text-xs">{actions.state.cursor}</span>
        ) : (
          <Link
            {...actions.returnTo.link}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Run is at {actions.state.cursor}
          </Link>
        )}
      </div>
      <RunActions {...actions} />
    </div>
  );
}
