import type { Livery } from "@alt-hist/data";
import { memo, useEffect, useRef, useState } from "react";
import {
  carLabel,
  nextGame,
  PARADE_START,
  type ParadeCar,
  type ParadeGame,
} from "../lib/parade.js";
import { carAt, type Field, START_LINE, spreadField, startField, stepField } from "../lib/track.js";
import { cn } from "../lib/utils.js";
import { CarTooltip, type Point } from "./CarTooltip.js";
import { LiveryCar } from "./TeamCar.js";

/**
 * One car's sprite. Memoised, since the track re-renders every frame to move
 * the cars and a sprite never changes once it is on.
 */
const Sprite = memo(function Sprite({ livery, year }: { livery: Livery; year: number }) {
  return <LiveryCar livery={livery} year={year} size="large" animated />;
});

/**
 * The track as drawn: verge, kerb, tarmac with its dashed line and chequered
 * start/finish line, kerb, verge, and the field on the tarmac where `field`
 * puts it. A screen reader skips the whole band: it is decoration.
 *
 * Props-driven, so it renders without a DOM; `HomeTrack` drives it.
 */
export function Track({
  field,
  game = PARADE_START,
  tarmac,
}: {
  field: Field | null;
  game?: ParadeGame;
  tarmac?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div aria-hidden="true" className="border-border border-t select-none">
      <div className="track-verge h-2" />
      <div className="track-kerb h-2" />
      <div
        ref={tarmac}
        className={cn(
          "track-tarmac relative h-28 overflow-hidden",
          // A held car stops the whole field, wheels too.
          game.pressed && "[&_*]:[animation-play-state:paused]",
        )}
      >
        <span
          className="track-start absolute inset-y-0 w-3"
          style={{ left: `${START_LINE * 100}%` }}
        />
        {/* 10.5px: a map label tucked in a thin band; the scale has no size this small. */}
        <span
          className="track-label absolute top-1.5 font-mono text-[10.5px] tracking-widest"
          style={{ left: `calc(${START_LINE * 100}% + 18px)` }}
        >
          S/F
        </span>
        {field?.cars.map((car) => (
          <div
            key={car.id}
            className="absolute top-0 left-0"
            // Whole px, so the pixel art stays sharp; the lower lane drawn over the upper.
            style={{
              transform: `translate(${Math.round(car.x)}px, ${Math.round(car.y)}px)`,
              zIndex: Math.round(car.y) + 1,
            }}
          >
            <div className={cn(game.reversed && "-scale-x-100")}>
              <Sprite livery={car.livery} year={car.year} />
            </div>
          </div>
        ))}
      </div>
      <div className="track-kerb h-2" />
      <div className="track-verge h-2" />
    </div>
  );
}

/**
 * The track along the foot of Home, with the parade lapping it (`lib/track.ts`
 * moves the field, `lib/parade.ts` picks the cars).
 *
 * The field is stepped once a frame by `requestAnimationFrame` and handed to
 * `Track` as state: a few cars re-rendering at the display's rate is cheap, and
 * the sprites themselves are memoised. The field leaves the grid in formation
 * on opening. For a reader who has asked for reduced motion it stands still,
 * spread along the track.
 *
 * **The hidden game** (`ParadeGame`): pointing at a car names it; pressing one
 * stops the field and pins the name where it was pressed; letting go turns the
 * cars round. The cars move under a still pointer, so what is under it is
 * checked every frame, not only when it moves. The pointer counts as on a car
 * only where the tarmac is the top thing there, so an open dialog keeps it.
 */
export function HomeTrack() {
  const tarmac = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<Field | null>(null);
  const [game, setGame] = useState<ParadeGame>(PARADE_START);
  const [tooltip, setTooltip] = useState<{ car: ParadeCar; at: Point } | null>(null);

  useEffect(() => {
    const element = tarmac.current;
    if (element === null) {
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = (still ? spreadField : startField)(Math.random, element.clientWidth);
    setField(current);
    let state = PARADE_START;
    // The pointer's last place in the window, or null when it has left it (or a finger lifted).
    let pointer: Point | null = null;
    // Where a press pinned the tooltip, and on which car.
    let pinned: { car: ParadeCar; at: Point } | null = null;
    let last = performance.now();
    let frame = 0;

    // The car under a point in the window, if the tarmac is what is there.
    const under = (at: Point, target: Element | null) => {
      if (target === null || !element.contains(target)) {
        return undefined;
      }
      const box = element.getBoundingClientRect();
      return carAt(current, { x: at.x - box.left, y: at.y - box.top });
    };
    // The tooltip, kept the same object while nothing about it changes so React skips the render.
    let shown: { car: ParadeCar; at: Point } | null = null;
    const show = (next: { car: ParadeCar; at: Point } | null) => {
      if (next?.car !== shown?.car || next?.at !== shown?.at) {
        shown = next;
        setTooltip(next);
      }
    };

    const tick = (time: number) => {
      const dt = (time - last) / 1000;
      last = time;
      if (!still && !state.pressed) {
        current = stepField(current, {
          dt,
          width: element.clientWidth,
          direction: state.reversed ? -1 : 1,
          random: Math.random,
        });
        setField(current);
      }
      const car =
        pointer === null
          ? undefined
          : under(pointer, document.elementFromPoint(pointer.x, pointer.y));
      show(pinned ?? (car === undefined || pointer === null ? null : { car, at: pointer }));
      frame = requestAnimationFrame(tick);
    };

    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leave = () => {
      pointer = null;
    };
    const press = (event: PointerEvent) => {
      const at = { x: event.clientX, y: event.clientY };
      const car =
        event.isPrimary && event.button === 0 && !state.pressed
          ? under(at, event.target instanceof Element ? event.target : null)
          : undefined;
      if (car === undefined) {
        return;
      }
      event.preventDefault();
      state = nextGame(state, "press");
      pinned = { car, at };
      setGame(state);
    };
    const end = (event: "release" | "cancel") => {
      const next = nextGame(state, event);
      if (next !== state) {
        state = next;
        pinned = null;
        setGame(state);
      }
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

    frame = requestAnimationFrame(tick);
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

  return (
    <>
      <Track field={field} game={game} tarmac={tarmac} />
      {tooltip === null ? null : <CarTooltip line={carLabel(tooltip.car)} at={tooltip.at} />}
    </>
  );
}
