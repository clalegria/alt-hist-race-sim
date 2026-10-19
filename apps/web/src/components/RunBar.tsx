import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  type ContinueSlot,
  type Crumb,
  type CrumbMenu,
  type ReturnLink,
  type RunBarState,
  type RunCommand,
  type RunMenuEntry,
  runActionsFor,
} from "../lib/run-bar.js";
import { cn } from "../lib/utils.js";
import { RoundSegments } from "./RoundSegments.js";
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
 *
 * The trigger is an outlined 24px square, so it reads as a button without a
 * hover to show it. Its tap area is bigger than what is drawn: an invisible
 * `::before` reaching up and right, not down onto the cursor line under the
 * trail nor left onto the crumb's own link.
 */
function CrumbMenuButton({ menu }: { menu: CrumbMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={menu.label}
        className="text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground focus-visible:ring-ring border-border relative -my-0.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-md border text-xs transition-colors before:absolute before:-top-3 before:-right-2.5 before:-bottom-1 before:-left-0.5 focus-visible:ring-2 focus-visible:outline-none"
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
              <Link {...item.link} {...(item.current ? { "aria-current": "page" as const } : {})}>
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
      <ol className="flex flex-wrap items-center gap-x-1.5 font-mono text-xs tracking-wider uppercase">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.label}>
              {index === 0 ? null : (
                <li aria-hidden="true" className="text-muted-foreground">
                  ›
                </li>
              )}
              <li className="flex items-center gap-1">
                {crumb.link !== undefined ? (
                  <Link
                    {...crumb.link}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    {...(last ? { "aria-current": "page" as const } : {})}
                    className={last ? "text-foreground font-semibold" : "text-muted-foreground"}
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

/** One action that does something, as the bar and ⋯ draw it. */
interface Action {
  readonly label: string;
  readonly onSelect: () => void;
}

/** Continue, in its slot: disabled rather than removed when it cannot be pressed. */
function ContinueButton({
  slot,
  next,
  onContinue,
  className,
}: {
  slot: ContinueSlot;
  next: string | null;
  onContinue: () => void;
  className?: string;
}) {
  return (
    // A disabled button takes no pointer events (`buttonClass`), so the reason
    // it cannot be pressed is the wrapper's tooltip.
    <span
      className={cn("inline-flex shrink-0", className)}
      {...(slot.disabled === null ? {} : { title: slot.disabled })}
    >
      <Button
        onClick={onContinue}
        disabled={slot.disabled !== null}
        {...(slot.disabled === null && next !== null ? { title: `Next: ${next}` } : {})}
        variant={slot.primary ? "primary" : "outline"}
      >
        Continue
        <span aria-hidden="true" className="ml-1.5">
          ▸
        </span>
      </Button>
    </span>
  );
}

/**
 * The run's restart in Continue's slot, at the run's end: the way on once
 * there is nowhere further to go. It still asks first, like any restart.
 */
function RestartButton({
  primary,
  action,
  className,
}: {
  primary: boolean;
  action: Action;
  className?: string;
}) {
  return (
    <Button
      onClick={action.onSelect}
      variant={primary ? "primary" : "outline"}
      className={cn("shrink-0", className)}
    >
      {action.label}
      <span aria-hidden="true" className="ml-1.5">
        ↻
      </span>
    </Button>
  );
}

/** Which of ⋯'s groups an entry is in: on, over again, or out. */
function menuGroup(entry: RunMenuEntry): "forward" | "over" | "out" {
  return entry.key === "exit" ? "out" : entry.destructive ? "over" : "forward";
}

/** The way back to the cursor's page: it navigates, so a link in a button's clothes. */
function BackLink({ to, className }: { to: ReturnLink; className?: string }) {
  return (
    <Link
      {...to.link}
      title={`Back to ${to.label}`}
      className={buttonClass("primary", cn("shrink-0", className))}
    >
      <span aria-hidden="true" className="mr-1.5">
        ↩
      </span>
      Back to run
    </Link>
  );
}

/**
 * The run's actions, in three kinds: **forward** (Continue, the skip to this
 * season's end, Jump to…), **over again** (Restart season, Restart era) and
 * **out** (Exit run). Nothing goes back in time; Back is the browser's, and
 * moves between pages.
 *
 * **The way on is always the right-hand end, with ⋯ just left of it**, so
 * neither moves as the set changes from beat to beat (`runActionsFor` decides
 * where each goes): Continue, or at the run's end, its restart. The other ways forward are buttons to their left on a wide
 * screen, and the only part of the bar that wraps; the ones that throw work
 * away, and Exit run, are in ⋯. On a phone there is room for one button beside
 * ⋯, so the other ways forward fold into it too: one list, its phone-only
 * entries hidden from `md` up, so the two layouts cannot offer different
 * things. Both are rendered and CSS shows one, which keeps the choice in the
 * stylesheet (a media query, `md:`) rather than in script.
 *
 * Drawn twice, in the sticky bar and at the foot of the page, from one set of
 * props, so the two copies always show the same thing.
 */
export function RunActions(props: RunActionsProps) {
  const { state } = props;
  const away = props.returnTo ?? null;
  const layout = runActionsFor(state, { away: away !== null, editingGrid: props.editingGrid });
  const actions: Record<RunCommand, Action> = {
    continue: { label: "Continue", onSelect: props.onContinue },
    skip: { label: state.skip ?? "", onSelect: props.onSkip },
    jump: { label: "Jump to…", onSelect: props.onJump },
    restartSeason: { label: "Restart season", onSelect: props.onRestartSeason },
    restartEra: { label: "Restart era", onSelect: props.onRestartEra },
    exit: { label: "Exit run", onSelect: props.onExit },
  };

  return (
    // `flex-auto`, not `flex-1`: starting from its own width, a crowded line
    // shrinks the trail; starting from nothing, it would overflow it instead.
    <div className="flex flex-auto items-start justify-end gap-2">
      {props.editingGrid ? (
        // No way forward while a grid is half-rearranged: the draft would go
        // with it, and the season simulated would be the one being replaced.
        <span className="text-muted-foreground self-center text-right text-xs">
          Editing the grid. Apply or cancel it to carry on.
        </span>
      ) : (
        <div className="hidden flex-1 flex-wrap justify-end gap-2 md:flex">
          {layout.bar.map((key) =>
            key === "back" ? (
              away === null ? null : (
                <BackLink key={key} to={away} />
              )
            ) : (
              <Button key={key} variant="outline" onClick={actions[key].onSelect}>
                {actions[key].label}
              </Button>
            ),
          )}
        </div>
      )}
      {layout.menu.length === 0 ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="More run actions" className="shrink-0 px-3">
              <span aria-hidden="true">⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {layout.menu.map((entry, index) => {
              const action = actions[entry.key];
              const before = layout.menu[index - 1];
              // A rule between the groups; leaving the run sits apart from the
              // restarts, which keep it. Phone-only entries come first, so after
              // one, an entry is ⋯'s first from `md` up and needs no rule there.
              const rule = before !== undefined && menuGroup(before) !== menuGroup(entry);
              return (
                <Fragment key={entry.key}>
                  {rule ? (
                    <DropdownMenuSeparator
                      {...(before.phoneOnly ? { className: "md:hidden" } : {})}
                    />
                  ) : null}
                  <DropdownMenuItem
                    onSelect={action.onSelect}
                    destructive={entry.destructive}
                    {...(entry.phoneOnly ? { className: "md:hidden" } : {})}
                  >
                    {action.label}
                  </DropdownMenuItem>
                </Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {layout.wideSlot.kind === "restart" ? (
        <RestartButton
          primary={layout.wideSlot.primary}
          action={actions[layout.wideSlot.key]}
          // Away, a phone's slot is the way back's.
          {...(layout.phoneSlot.kind === "back" ? { className: "hidden md:inline-flex" } : {})}
        />
      ) : (
        <ContinueButton
          slot={layout.wideSlot}
          next={state.next}
          onContinue={props.onContinue}
          // Away, a phone's slot is the way back's.
          {...(layout.phoneSlot.kind === "back" ? { className: "hidden md:inline-flex" } : {})}
        />
      )}
      {layout.phoneSlot.kind !== "back" || away === null ? null : (
        <BackLink to={away} className="md:hidden" />
      )}
    </div>
  );
}

/**
 * The run as a live session: a dot, the trail to this page, and under them
 * the season's rounds. The dot is lit on the cursor's own page and dims on
 * any other, like a stream's LIVE badge once you have scrolled back. Away,
 * a "Run is at" link joins the rounds (on their row from `sm` up); on the
 * cursor's page the trail already says where the run is, so the place is
 * there for screen readers only.
 */
function RunPlace({ crumbs, state, returnTo }: RunActionsProps & { crumbs: readonly Crumb[] }) {
  const live = returnTo === undefined || returnTo === null;
  return (
    <div className="flex flex-col gap-1.5 leading-tight">
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          title={live ? "Live" : "Looking back"}
          {...(live ? { "data-live": "" } : {})}
          className="bg-subtle data-[live]:bg-primary ring-subtle/25 data-[live]:ring-primary/25 mt-1.5 size-2 shrink-0 rounded-full ring-3"
        />
        <Breadcrumbs crumbs={crumbs} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
        <div className="flex min-w-24 flex-1 sm:w-[260px] sm:flex-initial">
          <RoundSegments rounds={state.rounds} done={state.roundsRun} />
        </div>
        {live ? (
          // The segments are hidden from screen readers, so this says them in words.
          <span className="sr-only">{state.cursor}</span>
        ) : (
          <Link
            {...returnTo.link}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring font-mono text-xs underline-offset-4 sm:whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Run is at {state.cursor}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * The run bar's contents: where the run is on the left, the way on at the
 * right — navigation is the right-hand end of the bar on every page.
 *
 * One line that never wraps, top-aligned, so the actions cannot drop under
 * the trail and take the way on with them. Short of room, the trail and the
 * buttons left of ⋯ wrap inside themselves instead: a flex item will not
 * shrink below its own narrowest layout, so ⋯ and the way on keep their width.
 */
export function RunBar({ crumbs, ...actions }: RunActionsProps & { crumbs: readonly Crumb[] }) {
  return (
    <div className="flex flex-1 items-start gap-3">
      <RunPlace crumbs={crumbs} {...actions} />
      <RunActions {...actions} />
    </div>
  );
}
