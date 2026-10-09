import { useEffect, useState } from "react";
import { FIRST_PASS_MS, FORMATIONS, PASS_INTERVAL_MS, type Pass, planPass } from "../lib/parade.js";
import { LiveryCar } from "./TeamCar.js";

/**
 * A few cars from anywhere in history, driving across the home screen's
 * background now and then (`lib/parade.ts` picks them).
 *
 * **Between the page texture and the page.** The texture is `body::before` at
 * `z-index: -1`; this layer is fixed at the same `-1` and comes later in the
 * document, so it paints over the texture, and like any negative layer it paints
 * under the ordinary content — the opaque mode cards hide a car going behind
 * them. The browser moves the cars (a CSS animation on `transform`); React only
 * says when a pass sets off and what is in it.
 *
 * Gone for a reader who has asked for reduced motion: the layer is not drawn.
 */
export function Parade({ pass, onDone }: { pass: Pass; onDone?: () => void }) {
  const slots = FORMATIONS[pass.formation];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-1 overflow-hidden motion-reduce:hidden"
    >
      {pass.cars.map((car, i) => {
        const slot = slots[i] ?? { delay: 0, offset: 0 };
        return (
          <div
            key={`${car.teamId}-${car.year}`}
            className="absolute left-0 motion-safe:animate-drive"
            style={{
              top: `calc(${(pass.lane * 100).toFixed(2)}% + ${slot.offset}rem)`,
              animationDelay: `${slot.delay}s`,
              animationDuration: `${pass.duration.toFixed(2)}s`,
            }}
            {...(i === pass.cars.length - 1 && onDone !== undefined
              ? { onAnimationEnd: onDone }
              : {})}
          >
            <LiveryCar livery={car.livery} year={car.year} size="large" animated />
          </div>
        );
      })}
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
      setCurrent(
        (running) => running ?? { pass: planPass(Math.random, window.innerWidth), id: passes++ },
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
