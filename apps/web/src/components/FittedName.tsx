import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { driverName, nameParts, shortDriverName } from "../lib/names.js";
import { cn } from "../lib/utils.js";

/**
 * A name that shortens before it is cut: the full name where there is room for
 * it, "M. Schumacher" where there is not, and only then the ellipsis.
 *
 * An ellipsis costs the reader the *end* of the name — "Michael Schum…" — which
 * is the half that identifies the driver. Initials cost them the start, which
 * they can nearly always supply themselves, so the abbreviation is tried first
 * and the truncation is the last resort. The full name stays reachable as the
 * element's `title`.
 *
 * **How the fit is measured.** The visible text cannot answer the question on
 * its own: once it has been shortened it fits by definition, and the box would
 * never widen back. So an invisible probe carrying the full name sits inside the
 * box, positioned absolutely so it takes no space, and its natural width is
 * compared against the room the box has. That comparison holds in both
 * directions, which is what lets a window that grows put the full name back.
 *
 * **The caller must give the box the width it is allowed to use** — `flex-1` in
 * a row, or any block in a column — because the box's own `clientWidth` *is*
 * "the room". A content-sized box would report the width of the short name and
 * stay stuck on it.
 *
 * With no DOM — the static renders the test suite does — the effect never runs
 * and the full name is what renders, which is also the right first paint.
 */
export function FittedName({
  full,
  short,
  className,
  render = (name) => name,
}: {
  full: string;
  /** Usually `shortDriverName(id)`. Equal to `full` means "never abbreviate". */
  short: string;
  className?: string | undefined;
  /**
   * How a form of the name is drawn. The probe is drawn the same way, so it
   * measures the styled width: capitals and weights move it either way.
   */
  render?: (name: string) => ReactNode;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const element = box.current;
    const measure = probe.current;
    if (element === null || measure === null || full === short) {
      return;
    }
    const fit = () => {
      // Both widths fractional, and compared with no slack to speak of. A
      // browser draws the ellipsis on an overflow of half a pixel, and the
      // ellipsis then eats two or three characters to make room for itself —
      // so a tolerance of a whole pixel, or a comparison against the integer
      // `clientWidth`, hands back exactly the "Alessandro Zanard…" this
      // component exists to prevent. Erring the other way costs nothing: a
      // name shortened a pixel early still reads.
      const room = element.getBoundingClientRect().width;
      const need = measure.getBoundingClientRect().width;
      // A box with no width yet — before layout, or inside a closed panel —
      // has nothing to say, and the full name is the safe answer.
      setFits(room === 0 || need <= room + 0.05);
    };
    fit();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    // Both boxes, because a name can stop fitting without the box it sits in
    // changing size at all: the first measurement happens before the webfont
    // has loaded, and swapping Archivo in for the fallback moves every text
    // width while the flex layout around it stands still. That was a real bug —
    // a name a hair too long for its column in Archivo but not in the fallback
    // was measured as fitting, and then truncated. Watching the probe catches
    // the font, the reader's text size and page zoom in the one mechanism.
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    observer.observe(measure);

    // Two more measurements, because the observer alone was measurably not
    // enough: a sweep of column widths in a real browser found a handful of
    // rows a run — always names within a pixel or two of their column — left
    // showing a name the browser then truncated. Both re-measure a settled
    // layout rather than the one the first commit saw: the frame after mount,
    // and the moment the webfont is in. Cheap, idempotent, and they turn a
    // race that showed up once in twenty page loads into nothing.
    const frame = requestAnimationFrame(fit);
    let live = true;
    const settled = () => {
      if (live) {
        fit();
      }
    };
    void document.fonts?.ready.then(settled, settled);

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [full, short]);

  return (
    <span
      ref={box}
      className={cn("relative block truncate", className)}
      title={fits ? undefined : full}
    >
      {render(fits ? full : short)}
      <span
        ref={probe}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 whitespace-pre"
      >
        {render(full)}
      </span>
    </span>
  );
}

/**
 * A name as a timing screen sets it: the given name plain, the SURNAME in bold
 * narrow capitals. For names in tables; prose and headings keep `driverName`.
 *
 * The capitals are CSS, so the text keeps its own case, and the space between
 * the two is real text, so the name still reads whole with the tags stripped.
 */
export function SplitName({ name }: { name: string }) {
  const { given, surname } = nameParts(name);
  return (
    <>
      {given === "" ? null : (
        <>
          <span>{given}</span>{" "}
        </>
      )}
      <span className="narrow font-extrabold uppercase">{surname}</span>
    </>
  );
}

function splitName(name: string): ReactNode {
  return <SplitName name={name} />;
}

/** The same, for a driver id: both forms come from `lib/names.ts`. */
export function FittedDriverName({
  driverId,
  className,
  split = false,
}: {
  driverId: string;
  className?: string;
  /** Set both forms as `SplitName` does: "Nelson PIQUET", "N. PIQUET". */
  split?: boolean;
}) {
  return (
    <FittedName
      full={driverName(driverId)}
      short={shortDriverName(driverId)}
      className={className}
      {...(split ? { render: splitName } : {})}
    />
  );
}
