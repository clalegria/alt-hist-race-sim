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
 * Where this page sits in the run: `Era 1980 › 1984 › Round 3 › Race`.
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
  /** True while the reader is being asked whether to start the season again. */
  readonly confirmingRestart: boolean;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
  readonly onJump: () => void;
  readonly onStartAgain: () => void;
  readonly onRestart: () => void;
  readonly onCancelRestart: () => void;
  readonly onExit: () => void;
}

/**
 * The run's actions: Continue, and an overflow menu for everything else.
 *
 * **Continue is the only thing that moves the run forward a beat**; the rest
 * are rarer and live behind ⋯ — skipping, jumping, starting the season again,
 * leaving the run. Start again still asks inline, on the same row, because it
 * only re-runs this year; leaving the whole run asks in a dialog
 * (`RunDialogs.tsx`), which is also what the browser's Back is caught by.
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

  if (props.confirmingRestart) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">
          Start this season again on fresh dice?
        </span>
        <Button variant="outline" onClick={props.onRestart}>
          Start again
        </Button>
        <Button variant="ghost" onClick={props.onCancelRestart}>
          Cancel
        </Button>
      </div>
    );
  }

  const { state } = props;
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="More run actions" className="px-3">
            <span aria-hidden="true">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {state.skip === null ? null : (
            <DropdownMenuItem onSelect={props.onSkip}>{state.skip}</DropdownMenuItem>
          )}
          {state.jump ? (
            <DropdownMenuItem onSelect={props.onJump}>Jump forward…</DropdownMenuItem>
          ) : null}
          {state.restart ? (
            <DropdownMenuItem onSelect={props.onStartAgain}>Start again</DropdownMenuItem>
          ) : null}
          {state.skip === null && !state.jump && !state.restart ? null : <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={props.onExit}>Exit run</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
