import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { PageSteps } from "../lib/page-steps.js";
import {
  type BarWidth,
  type ContinueSlot,
  type Crumb,
  type CrumbMenu,
  type ReturnLink,
  type RunBarState,
  type RunCommand,
  type RunMenuEntry,
  runActionsFor,
} from "../lib/run-bar.js";
import { cn, MONO_LINE } from "../lib/utils.js";
import { StepArrows, TRAIL_SQUARE, TRAIL_SQUARE_LIVE } from "./PageSteps.js";
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
        className={cn(
          TRAIL_SQUARE,
          TRAIL_SQUARE_LIVE,
          "data-[state=open]:bg-accent data-[state=open]:text-foreground -my-0.5 text-xs before:absolute before:-top-3 before:-right-2.5 before:-bottom-1 before:-left-0.5",
        )}
      >
        ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-48 overflow-y-auto">
        {menu.items.map((item) =>
          item.link === null ? (
            <DropdownMenuItem key={item.label} disabled>
              {item.label}{" "}
              <span className="text-muted-foreground ml-auto pl-3">not reached yet</span>
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
 * A crumb's words. Below `md` its short form shows (`R11`, `Qualy`) and the
 * full one is kept for screen readers (`sr-only`, not `hidden`), so the
 * crumb's name is the same at every width.
 */
function CrumbLabel({ crumb }: { crumb: Crumb }) {
  if (crumb.short === undefined) {
    return crumb.label;
  }
  return (
    <>
      <span aria-hidden="true" className="md:hidden">
        {crumb.short}
      </span>
      <span className="sr-only md:not-sr-only">{crumb.label}</span>
    </>
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
 *
 * `after` follows the last crumb in the trail's own flow — the arrows to the
 * page either side — so it wraps like one more crumb rather than narrowing the
 * trail beside it. Wrapped lines are spaced so a square's tap area, which
 * reaches up, stays off the middle of one on the line above.
 */
export function Breadcrumbs({
  crumbs,
  after,
}: {
  crumbs: readonly Crumb[];
  after?: React.ReactNode;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={cn(MONO_LINE, "flex flex-wrap items-center gap-x-1.5 gap-y-2")}>
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
                    <CrumbLabel crumb={crumb} />
                  </Link>
                ) : (
                  <span
                    {...(last ? { "aria-current": "page" as const } : {})}
                    className={last ? "text-foreground font-semibold" : "text-muted-foreground"}
                  >
                    <CrumbLabel crumb={crumb} />
                  </span>
                )}
                {crumb.menu === undefined ? null : <CrumbMenuButton menu={crumb.menu} />}
              </li>
            </Fragment>
          );
        })}
        {/* Not a crumb, so no list item to a screen reader; clear of a ▾'s reach. */}
        {after === undefined ? null : (
          <li role="none" className="ml-1 flex items-center">
            {after}
          </li>
        )}
      </ol>
    </nav>
  );
}

export interface RunActionsProps {
  readonly state: RunBarState;
  /** True while the grid is being rearranged, which is not a moment to step on. */
  readonly editingGrid: boolean;
  /** True on a round's qualifying or race page, whose trail leaves the least room. */
  readonly roundPage: boolean;
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
  /** Layout from outside: the widths this copy shows at. */
  readonly className?: string;
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

/*
 * A bar button from its width up, and a ⋯ entry below it. Spelled whole, never
 * built from the width: Tailwind writes only the classes it finds in the source.
 */
const SHOWN_FROM: Record<BarWidth, string> = {
  md: "hidden md:inline-flex",
  lg: "hidden lg:inline-flex",
};
const HIDDEN_FROM: Record<BarWidth, string> = { md: "md:hidden", lg: "lg:hidden" };

/**
 * The width from which none of `entries` is in ⋯ any more, each having moved
 * onto the bar; null while one of them is in ⋯ at every width.
 */
function goneFrom(entries: readonly RunMenuEntry[]): BarWidth | null {
  if (entries.some((entry) => entry.onBarFrom === null)) {
    return null;
  }
  return entries.some((entry) => entry.onBarFrom === "lg") ? "lg" : "md";
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
 * where each goes): Continue, or at the run's end, its restart. The other ways
 * forward are buttons to their left on a wide screen; the ones that throw work
 * away, and Exit run, are in ⋯. Short of room, a way forward folds into ⋯:
 * all but one on a phone, and Jump to… below `lg` or on a round's page. One list, each entry hidden
 * from the width its button shows, so the layouts cannot offer different
 * things. Both are rendered and CSS shows one, which keeps the choice in the
 * stylesheet (media queries, `md:` and `lg:`) rather than in script.
 *
 * As wide as its buttons and no wider, so the foot of the page right-aligns it.
 * Drawn twice, in the run bar and at the foot of the page, from one set of
 * props, so the two copies always show the same thing. On a phone only the
 * foot's is drawn, pinned to the bottom of the screen (`RunFrame`).
 */
export function RunActions(props: RunActionsProps) {
  const { state } = props;
  const away = props.returnTo ?? null;
  const layout = runActionsFor(state, {
    away: away !== null,
    editingGrid: props.editingGrid,
    roundPage: props.roundPage,
  });
  const actions: Record<RunCommand, Action> = {
    continue: { label: "Continue", onSelect: props.onContinue },
    skip: { label: state.skip ?? "", onSelect: props.onSkip },
    jump: { label: "Jump to…", onSelect: props.onJump },
    restartSeason: { label: "Restart season", onSelect: props.onRestartSeason },
    restartEra: { label: "Restart era", onSelect: props.onRestartEra },
    exit: { label: "Exit run", onSelect: props.onExit },
  };

  return (
    // `flex-initial`: its own width, never more; less only for the editing
    // note, which wraps, while the buttons' labels never do.
    <div className={cn("flex flex-initial items-start justify-end gap-2", props.className)}>
      {props.editingGrid ? (
        // No way forward while a grid is half-rearranged: the draft would go
        // with it, and the season simulated would be the one being replaced.
        <span className="text-muted-foreground self-center text-right text-xs">
          Editing the grid. Apply or cancel your edit to carry on.
        </span>
      ) : (
        <div className="hidden flex-wrap justify-end gap-2 md:flex">
          {layout.bar.map(({ key, from }) =>
            key === "back" ? (
              away === null ? null : (
                <BackLink key={key} to={away} className={SHOWN_FROM[from]} />
              )
            ) : (
              <Button
                key={key}
                variant="outline"
                onClick={actions[key].onSelect}
                className={SHOWN_FROM[from]}
              >
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
              // restarts, which keep it. Entries that move onto the bar come
              // first, so once every one above has, this entry is ⋯'s first and
              // needs no rule.
              const rule = before !== undefined && menuGroup(before) !== menuGroup(entry);
              const ruleGoneFrom = goneFrom(layout.menu.slice(0, index));
              return (
                <Fragment key={entry.key}>
                  {rule ? (
                    <DropdownMenuSeparator
                      {...(ruleGoneFrom === null ? {} : { className: HIDDEN_FROM[ruleGoneFrom] })}
                    />
                  ) : null}
                  <DropdownMenuItem
                    onSelect={action.onSelect}
                    destructive={entry.destructive}
                    {...(entry.onBarFrom === null
                      ? {}
                      : { className: HIDDEN_FROM[entry.onBarFrom] })}
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
 * any other, like a stream's LIVE badge once you have scrolled back. Where
 * the run is, in words, is for screen readers only, which cannot see the
 * segments: on the cursor's page the trail says it, and away, Back to run
 * names it in its tooltip.
 *
 * `flex-1` from nothing: it takes what the actions leave, never the reverse.
 */
function RunPlace({
  crumbs,
  steps,
  state,
  returnTo,
}: RunActionsProps & { crumbs: readonly Crumb[]; steps: PageSteps | null }) {
  const live = returnTo === undefined || returnTo === null;
  return (
    <div className="flex flex-1 flex-col gap-1.5 leading-tight">
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          title={live ? "Live" : "Looking back"}
          {...(live ? { "data-live": "" } : {})}
          className="bg-subtle data-[live]:bg-primary ring-subtle/25 data-[live]:ring-primary/25 mt-1.5 size-2 shrink-0 rounded-full ring-3"
        />
        <Breadcrumbs
          crumbs={crumbs}
          // On a phone the arrows are in the pinned foot band instead (`RunFrame`).
          {...(steps === null
            ? {}
            : { after: <StepArrows steps={steps} className="hidden md:flex" /> })}
        />
      </div>
      <RoundSegments rounds={state.rounds} done={state.roundsRun} />
      <span className="sr-only">{live ? state.cursor : `Run is at ${state.cursor}`}</span>
    </div>
  );
}

/**
 * The run bar's contents: where the run is on the left, the way on at the
 * right — navigation is the right-hand end of the bar on every page.
 *
 * One line that never wraps, top-aligned, so the actions cannot drop under
 * the trail and take the way on with them. The actions take their full width
 * first and the place gets the rest, its trail wrapping and its rounds
 * narrowing to fit: in a toolbar the controls hold their size and the text
 * beside them gives way. `runActionsFor` folds into ⋯ whatever would not fit.
 *
 * Below `md` the bar is the place alone, its trail the full width, and it
 * scrolls away with the page: the actions are the foot's copy, pinned to the
 * bottom of the screen where a thumb reaches (`RunFrame`).
 */
export function RunBar({
  crumbs,
  steps = null,
  ...actions
}: RunActionsProps & {
  crumbs: readonly Crumb[];
  /** The page either side, as arrows after the trail; null on a page with none. */
  steps?: PageSteps | null;
}) {
  return (
    <div className="flex flex-1 items-start gap-3">
      <RunPlace crumbs={crumbs} steps={steps} {...actions} />
      <RunActions {...actions} className="hidden md:flex" />
    </div>
  );
}
