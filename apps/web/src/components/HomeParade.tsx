import { useEffect, useRef, useState } from "react";
import {
  FIRST_PASS_MS,
  FORMATIONS,
  hitsAny,
  nextGame,
  PARADE_COVER_SELECTOR,
  PARADE_START,
  PASS_INTERVAL_MS,
  type ParadeGame,
  type Pass,
  paradeLabel,
  planPass,
} from "../lib/parade.js";
import { cn } from "../lib/utils.js";
import { LiveryCar } from "./TeamCar.js";

/** The keyframes that carry a car across (`--animate-drive` in `index.css`). */
const DRIVE = "drive";

/** What the page keeps the pointer for, whatever car is under or over it. */
const PAGE_CLAIMS = `${PARADE_COVER_SELECTOR}, a, button, input, select, textarea, label, [role], [tabindex]`;

/** A place in the window, in px. */
interface Point {
  x: number;
  y: number;
}

/** How far the tooltip sits from the pointer, in px. */
const TOOLTIP_GAP_PX = 14;

/**
 * Whether the page has the pointer at this point before the cars do: anything
 * marked as a cover or meant to be clicked, anything while a dialog is open,
 * and any text of the element under it. Only bare page is left for the cars.
 */
function claimedByPage(target: Element, x: number, y: number): boolean {
  if (
    target.closest(PAGE_CLAIMS) !== null ||
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  ) {
    return true;
  }
  for (const node of target.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      if (hitsAny({ x, y }, [...range.getClientRects()])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A few cars from anywhere in history, driving across the home screen now and
 * then (`lib/parade.ts` picks them, and where they run).
 *
 * **Between the page texture and the page**, where there is an open lane. The
 * texture is `body::before` at `z-index: -1`; this layer is fixed at the same
 * `-1` and comes later in the document, so it paints over the texture, and like
 * any negative layer it paints under the ordinary content. **Over the page**
 * where there is none — a phone scrolled past the heading is all cards — at a
 * `z-index` above the content but under the dialogs (`z-50`). The browser moves
 * the cars (a CSS animation on `transform`); React only says when a pass sets
 * off and what is in it.
 *
 * **The layer never takes the pointer**, so the page keeps every click and
 * hover. The hidden game (`ParadeGame`) watches the window instead, and counts
 * the pointer as on a car only where the page has nothing there
 * (`claimedByPage`). The cars move under a still pointer, so where it is is
 * checked every frame, not only when it moves. A hold and a turn steer the
 * drive through the animations' own objects (`getAnimations()`), which pause
 * and run backwards from wherever the car is.
 *
 * Gone for a reader who has asked for reduced motion: the layer is not drawn.
 */
export function Parade({ pass, onDone }: { pass: Pass; onDone?: () => void }) {
  const slots = FORMATIONS[pass.formation];
  const layer = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const [game, setGame] = useState<ParadeGame>(PARADE_START);
  // Where the tooltip is: pinned where a car was pressed, else following a pointer over a car.
  const [pressedAt, setPressedAt] = useState<Point | null>(null);
  const [hoverAt, setHoverAt] = useState<Point | null>(null);

  useEffect(() => {
    const element = layer.current;
    if (element === null) {
      return;
    }
    let state = PARADE_START;
    // The pointer's last place in the window, or null when it has left it (or a finger lifted).
    let pointer: Point | null = null;
    let frame = 0;
    // The animations a press paused, and only those: one already finished would
    // start over if played again.
    let paused: Animation[] = [];
    const onCar = (target: Element | null, { x, y }: Point) =>
      target !== null &&
      !claimedByPage(target, x, y) &&
      hitsAny(
        { x, y },
        [...element.children]
          .map((car) => car.getBoundingClientRect())
          .filter((box) => box.width > 0),
      );
    // Every frame, since a car can drive under a pointer that is not moving. The
    // same `pointer` object while it stays put, so React skips the re-render.
    const track = () => {
      setHoverAt(
        pointer !== null && onCar(document.elementFromPoint(pointer.x, pointer.y), pointer)
          ? pointer
          : null,
      );
      frame = requestAnimationFrame(track);
    };
    // Bumped each time the drive changes direction, so only the latest wait ends the pass.
    let waits = 0;
    const animations = () => element.getAnimations({ subtree: true });
    const drives = () =>
      animations().filter((a) => a instanceof CSSAnimation && a.animationName === DRIVE);
    const waitForExit = () => {
      waits += 1;
      const wait = waits;
      const running = drives();
      // None for a reader who asked for reduced motion: the pass stays, unseen.
      if (running.length === 0) {
        return;
      }
      Promise.all(running.map((a) => a.finished)).then(
        () => {
          if (wait === waits) {
            done.current?.();
          }
        },
        // Cancelled: the pass was taken off the page first.
        () => {},
      );
    };

    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leave = () => {
      pointer = null;
    };
    const press = (event: PointerEvent) => {
      const at = { x: event.clientX, y: event.clientY };
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        state.pressed ||
        !onCar(event.target instanceof Element ? event.target : null, at)
      ) {
        return;
      }
      event.preventDefault();
      state = nextGame(state, "press");
      // The whole pass stops while held, wheels too.
      paused = animations().filter((a) => a.playState === "running");
      for (const a of paused) {
        a.pause();
      }
      setPressedAt(at);
    };
    const end = (event: "release" | "cancel") => {
      const next = nextGame(state, event);
      if (next === state) {
        return;
      }
      for (const a of paused) {
        a.play();
      }
      paused = [];
      if (next.reversed !== state.reversed) {
        // Each drive runs on from where it is, in the other direction.
        for (const a of drives()) {
          a.reverse();
        }
        waitForExit();
      }
      state = next;
      setPressedAt(null);
      setGame(state);
    };
    const release = (event: PointerEvent) => {
      end("release");
      // A finger lifted is no longer anywhere; a mouse still is.
      if (event.pointerType !== "mouse") {
        pointer = null;
      }
    };
    const cancel = () => {
      end("cancel");
      pointer = null;
    };
    // Pressing and holding must not start a text selection across the page.
    const noSelecting = (event: Event) => {
      if (state.pressed) {
        event.preventDefault();
      }
    };

    waitForExit();
    frame = requestAnimationFrame(track);
    const root = document.documentElement;
    window.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("selectstart", noSelecting);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("selectstart", noSelecting);
    };
  }, []);

  const tooltipAt = pressedAt ?? hoverAt;

  return (
    <>
      <div
        ref={layer}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden",
          pass.inFront ? "z-30" : "-z-1",
        )}
      >
        {pass.cars.map((car, i) => {
          const slot = slots[i] ?? { delay: 0, offset: 0 };
          return (
            <div
              key={`${car.teamId}-${car.year}`}
              className="absolute left-0 motion-safe:animate-drive"
              style={{
                top: `${Math.round(pass.lane + slot.offset)}px`,
                animationDelay: `${slot.delay}s`,
                animationDuration: `${pass.duration.toFixed(2)}s`,
              }}
            >
              {/* Flipped on a wrapper of its own: on the moving element it would flip the drive too. */}
              <div className={cn(game.reversed && "-scale-x-100")}>
                <LiveryCar livery={car.livery} year={car.year} size="large" animated />
              </div>
            </div>
          );
        })}
      </div>
      {tooltipAt === null ? null : <ParadeTooltip lines={paradeLabel(pass.cars)} at={tooltipAt} />}
    </>
  );
}

/**
 * Who the cars are, beside the pointer on the side with more room. Over
 * the page and an in-front pass, under the dialogs.
 */
function ParadeTooltip({ lines, at }: { lines: readonly string[]; at: Point }) {
  const leftward = at.x > window.innerWidth / 2;
  const upward = at.y > window.innerHeight / 2;
  return (
    <div
      aria-hidden="true"
      className="bg-card text-card-foreground border-border pointer-events-none fixed z-40 rounded-xl border px-3 py-2 text-sm whitespace-nowrap shadow-xl"
      style={{
        ...(leftward
          ? { right: window.innerWidth - at.x + TOOLTIP_GAP_PX }
          : { left: at.x + TOOLTIP_GAP_PX }),
        ...(upward
          ? { bottom: window.innerHeight - at.y + TOOLTIP_GAP_PX }
          : { top: at.y + TOOLTIP_GAP_PX }),
      }}
    >
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/** The parade on its timer: a first pass soon after the page opens, then one every so often. */
export function HomeParade() {
  // The pass under way and a number of its own, so each pass is new elements and
  // its animation starts afresh.
  const [current, setCurrent] = useState<{ pass: Pass; id: number } | null>(null);
  useEffect(() => {
    let passes = 0;
    const start = () => {
      // Not while the tab is in the background, and never two at once.
      if (document.hidden) {
        return;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const covers = [...document.querySelectorAll(PARADE_COVER_SELECTOR)].map((element) =>
        element.getBoundingClientRect(),
      );
      setCurrent(
        (running) => running ?? { pass: planPass(Math.random, viewport, covers), id: passes++ },
      );
    };
    let interval: number | undefined;
    const first = window.setTimeout(() => {
      start();
      interval = window.setInterval(start, PASS_INTERVAL_MS);
    }, FIRST_PASS_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
  if (current === null) {
    return null;
  }
  return <Parade key={current.id} pass={current.pass} onDone={() => setCurrent(null)} />;
}
