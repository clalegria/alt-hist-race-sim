import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { Crumb, RunBarState } from "../lib/run-bar.js";
import { Button } from "./ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";

/**
 * Where this page sits in the run: `Era › 1984 › Round 3 › Race`.
 *
 * A real `<nav>` with an ordered list, the pattern screen readers announce as a
 * breadcrumb trail, and `aria-current="page"` on the last crumb. A crumb with a
 * link is a `Link`, so it can be opened in a new tab like any other.
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
              <li>
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
  const forward: Action[] = [
    ...(state.skip === null ? [] : [{ label: state.skip, onSelect: props.onSkip }]),
    ...(state.jump ? [{ label: "Jump to…", onSelect: props.onJump }] : []),
  ];
  const over: Action[] = [
    ...(state.restartSeason ? [{ label: "Restart season", onSelect: props.onRestartSeason }] : []),
    ...(state.restartEra ? [{ label: "Restart era", onSelect: props.onRestartEra }] : []),
    { label: "Exit run", onSelect: props.onExit },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.next === null ? null : (
        <Button onClick={props.onContinue} title={`Next: ${state.next}`}>
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
            {forward.map((action) => (
              <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
                {action.label}
              </DropdownMenuItem>
            ))}
            {forward.length === 0 ? null : <DropdownMenuSeparator />}
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
        <span className="text-muted-foreground text-xs">{actions.state.cursor}</span>
      </div>
      <RunActions {...actions} />
    </div>
  );
}
