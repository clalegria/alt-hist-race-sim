/**
 * The frame every share card is drawn on, and the parts its cards share.
 *
 * A card is a 1080 × 1920 picture laid out as a page: heading line, lead, the
 * subject, the car band, the detail in panels, the footer. What each card puts
 * in those slots is `lib/share-card.ts`'s; how they look is here.
 *
 * **Pixels, not rems.** The app sizes type in rems so a reader's text size
 * carries through; a picture of a fixed size must not move with it, so every
 * length here is a pixel at the PNG's own scale. The preview scales the whole
 * card down with a transform, which leaves the layout untouched.
 *
 * **Always dark.** `.share-card` (`index.css`) resets every colour token to its
 * dark value on the card itself: CSS custom properties inherit, so the nearest
 * declaration wins and the app's utilities (`bg-card`, `text-subtle`) read dark
 * inside the card whatever the theme on the page around it.
 *
 * **Every year is the card's own.** A card spans many seasons, so nothing here
 * reads the `Liveries` context's year: each badge, bar and car is handed its
 * year and read through the run's kept-liveries setting (`useLiveryYear`), the
 * way `LiveryBarcode` draws a career. A car's shape still follows the season.
 *
 * **The sash needs no measuring.** The car band draws it in a box twice the
 * card's height, centred on the band's middle: a 135° gradient through a box's
 * centre is the diagonal the ribbon runs on, wherever the band lands. The same
 * box is drawn twice, behind the card (`-z-10`, inside the card's own stacking
 * context) and over the ribbon, so the chequer meets itself square for square.
 */

import type { Livery } from "@alt-hist/data";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/car-drawings.js";
import { PODIUM_POSITION, STANDOUT_POSITION } from "../lib/highlight.js";
import { liveryFor } from "../lib/livery.js";
import { driverName, nameParts } from "../lib/names.js";
import { SHARE_ADDRESS, type TeamYear } from "../lib/share-card.js";
import { cn, DISPLAY_CAPS, MONO_LABEL } from "../lib/utils.js";
import { Flag } from "./Flag.js";
import { useLiveryYear } from "./Liveries.js";
import {
  barcodeBackground,
  LiveryBadge,
  RIBBON_HALF_WIDTH,
  ribbonBackground,
} from "./TeamBadge.js";
import { LiveryCar } from "./TeamCar.js";

/** The PNG's size, portrait, as a phone's story frame. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** The car band's floor: it takes whatever room the card leaves it, but never less. */
const BAND_MIN_HEIGHT = 220;
/** The car's height as a share of its band's, up to a widest it never passes. */
const CAR_SHARE_OF_BAND = 0.8;
const CAR_MAX_WIDTH = 760;

/** The panel label voice, at the card's scale. */
const CARD_LABEL = cn(MONO_LABEL, "text-[20px] tracking-[0.16em]");

/** A team's colours in `year`, under the run's kept-liveries setting. */
function useLiveryAt(): (teamId: string, year: number) => Livery | undefined {
  const liveryYear = useLiveryYear();
  return useCallback(
    (teamId: string, year: number) => liveryFor(teamId, liveryYear(teamId, year)),
    [liveryYear],
  );
}

/**
 * The frame: the heading line, the lead with its emphasis in the accent, the
 * subject if the card has one, the car band filling whatever room is left, the
 * panels, and the footer.
 */
export function ShareCardFrame({
  heading,
  lead,
  subject,
  car,
  children,
}: {
  /** `headingLine`'s two halves: "My 1986", "16 rounds". */
  heading: { readonly title: string; readonly detail: string };
  /** In the first person: "I replayed 1986 and my", "world champion", "is…". */
  lead: { readonly before: string; readonly emphasis: string; readonly after?: string };
  /** The champion cards' name and figure; the list cards have none. */
  subject?: ReactNode;
  car: TeamYear;
  /** The panels. */
  children: ReactNode;
}) {
  return (
    <div
      className="share-card bg-background text-foreground relative isolate flex shrink-0 flex-col overflow-hidden px-[72px] pt-[64px] leading-[1.1]"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      <div className="flex justify-between">
        <p className={cn(MONO_LABEL, "text-[22px] tracking-[0.16em]")}>{heading.title}</p>
        <p className={cn(MONO_LABEL, "text-subtle text-[22px] tracking-[0.16em]")}>
          {heading.detail}
        </p>
      </div>
      <p className="semi-narrow text-muted-foreground mt-[44px] max-w-[860px] text-[48px] leading-[1.12] font-medium text-balance">
        {lead.before} <em className="text-primary font-bold not-italic">{lead.emphasis}</em>
        {lead.after === undefined ? null : ` ${lead.after}`}
      </p>
      {subject}
      <CarBand car={car} />
      <div className="mt-[36px] flex flex-col gap-[36px]">{children}</div>
      <footer className="bg-card-header border-border relative -mx-[72px] mt-[36px] flex items-baseline gap-[14px] overflow-hidden border-t-2 px-[72px] pt-[30px] pb-[40px]">
        <span
          aria-hidden="true"
          className="share-foot-chequer absolute top-[-200px] right-[-100px] h-[500px] w-[700px]"
        />
        <span className="semi-narrow text-muted-foreground relative text-[32px] font-semibold">
          Make your own history at
        </span>
        <span className="text-foreground relative font-mono text-[34px] font-semibold tracking-[0.02em]">
          {SHARE_ADDRESS}
        </span>
      </footer>
    </div>
  );
}

/** One layer of the sash: the card's height above and below the band's middle. */
const SASH_BOX = "pointer-events-none absolute left-0 w-full";
const SASH_PLACE = { top: `calc(50% - ${CARD_HEIGHT}px)`, height: 2 * CARD_HEIGHT };

/** The chequer's black squares are laid over the ribbon alone. */
const RIBBON_MASK = `linear-gradient(135deg, transparent calc(50% - ${RIBBON_HALF_WIDTH}px), #000 calc(50% - ${RIBBON_HALF_WIDTH}px), #000 calc(50% + ${RIBBON_HALF_WIDTH}px), transparent calc(50% + ${RIBBON_HALF_WIDTH}px))`;

/**
 * The car band: full bleed, ruled top and bottom, the one place a livery is
 * laid as a field. Nothing but the car sits on it, so no livery can swallow a
 * word or a bar.
 *
 * The car is sized in container query units (`cqh`, a hundredth of the
 * container's height): the inner layer is a size container, so the car follows
 * the band's height in CSS alone, with no script to measure it.
 */
function CarBand({ car }: { car: TeamYear }) {
  const livery = useLiveryAt()(car.teamId, car.year);
  const carWidth = `min(${CAR_MAX_WIDTH}px, ${(CAR_SHARE_OF_BAND * CANVAS_WIDTH * 100) / CANVAS_HEIGHT}cqh)`;
  return (
    <div
      data-car-band
      className="bg-card border-border relative -mx-[72px] mt-[36px] flex-1 border-y-2"
      style={{ minHeight: BAND_MIN_HEIGHT }}
    >
      <div aria-hidden="true" className={cn(SASH_BOX, "share-chequer -z-10")} style={SASH_PLACE} />
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden [container-type:size]">
        {livery === undefined ? null : (
          <div
            className={SASH_BOX}
            style={{ ...SASH_PLACE, background: ribbonBackground(livery) }}
          />
        )}
        <div className={cn(SASH_BOX, "share-chequer")} style={SASH_PLACE} />
        <div
          className={cn(SASH_BOX, "share-chequer-ink")}
          style={{ ...SASH_PLACE, maskImage: RIBBON_MASK, WebkitMaskImage: RIBBON_MASK }}
        />
        {livery === undefined ? null : (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-5 drop-shadow-[0_18px_18px_oklch(10%_0_0/0.5)]"
            style={{ width: carWidth }}
          >
            <LiveryCar livery={livery} year={car.year} size="card" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A line shrunk until it fits its box, never grown: the subject's surname, set
 * large enough that a long one ("Giraud-Cabantous") would run off the card, and
 * the Constructors' line, whose three names can outrun the panel. `FittedName`
 * cannot help here, since it shortens a given name and these have none. Scaled
 * by font size, so what is inside is sized in `em`. Measured as `FittedName`
 * measures, against an invisible probe at full size (`w-max`, or a flex row
 * inside it would be capped at the box); with no DOM it renders at full size.
 */
export function FitToWidth({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const room = box.current?.getBoundingClientRect().width ?? 0;
      const need = probe.current?.getBoundingClientRect().width ?? 0;
      setScale(room === 0 || need <= room ? 1 : room / need);
    };
    fit();
    // Again once the webfont is in: the fallback face sets a different width.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) {
        fit();
      }
    });
    return () => {
      live = false;
    };
    // After every render: the content is any node, and a card renders once.
  });
  return (
    <span ref={box} className={cn("relative block whitespace-nowrap", className)}>
      <span className="block" style={scale === 1 ? undefined : { fontSize: `${scale}em` }}>
        {children}
      </span>
      <span ref={probe} aria-hidden="true" className="invisible absolute top-0 left-0 w-max">
        {children}
      </span>
    </span>
  );
}

/** The subject's name: the given name over the surname, large. */
export function SubjectName({ driverId }: { driverId: string }) {
  const { given, surname } = nameParts(driverName(driverId));
  return (
    <div className="mt-[22px]">
      {given === "" ? null : (
        <p className={cn(DISPLAY_CAPS, "text-muted-foreground text-[60px] leading-[0.88]")}>
          {given}
        </p>
      )}
      <FitToWidth className={cn(DISPLAY_CAPS, "text-[168px] leading-[0.88]")}>{surname}</FitToWidth>
    </div>
  );
}

/** The line under the name: the flag, a badge, and the team or teams in words. */
export function SubjectEntry({ children }: { children: ReactNode }) {
  return (
    <div className="semi-narrow text-muted-foreground mt-[18px] flex items-center gap-[16px] text-[30px]">
      {children}
    </div>
  );
}

/** The subject's number, large in the accent, with what it counts beside it. */
export function SubjectFigure({
  value,
  label,
  children,
}: {
  value: number;
  /** "World titles", "Points". */
  label: string;
  /** Under the label: the seasons won, the margin to second. */
  children?: ReactNode;
}) {
  return (
    <div className="mt-[22px] flex items-end gap-[30px]">
      <span className="text-primary text-[260px] leading-[0.76] font-semibold tracking-[-0.05em] tabular-nums">
        {value}
      </span>
      <div className="grid gap-[16px] pb-[2px]">
        <p className={cn(DISPLAY_CAPS, "text-[72px] leading-[0.88]")}>{label}</p>
        {children}
      </div>
    </div>
  );
}

/** A panel: a head band with its label and an aside, the body, and an optional foot. */
export function CardPanel({
  label,
  aside,
  foot,
  children,
}: {
  label: string;
  /** The head band's right: a column key, a range of years. */
  aside?: ReactNode;
  /** The Constructors' line across the panel's foot. */
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-card border-border relative border-2">
      <div className="bg-card-header border-border flex items-center justify-between border-b-2 px-[24px] py-[16px]">
        <p className={CARD_LABEL}>{label}</p>
        {aside === undefined ? null : <div className={cn(CARD_LABEL, "text-subtle")}>{aside}</div>}
      </div>
      {children}
      {foot === undefined ? null : (
        <div className="bg-card-header border-border flex items-center gap-[22px] border-t-2 px-[24px] py-[16px]">
          {foot}
        </div>
      )}
    </section>
  );
}

/**
 * A season as the card marks one: its two digits over a bar in that year's
 * team colours, drawn as a stripe of the livery barcode is.
 */
export function SeasonMark({
  teamId,
  year,
  large = false,
}: {
  teamId: string;
  year: number;
  /** The subject's titles, a size up from a row's. */
  large?: boolean;
}) {
  const livery = useLiveryAt()(teamId, year);
  return (
    <span
      title={String(year)}
      className={cn(
        "grid gap-[5px] leading-none tabular-nums",
        large ? "text-[34px] font-semibold" : "text-[26px] font-medium",
      )}
    >
      {String(year).slice(-2)}
      <span
        aria-hidden="true"
        className={cn("border-badge-line block border-[1.5px]", large ? "h-[8px]" : "h-[6px]")}
        style={livery === undefined ? undefined : { background: barcodeBackground(livery) }}
      />
    </span>
  );
}

/**
 * A team's badge in `year`, at the card's scale. Its hairline is thickened by
 * an outline rather than `border-2`, which would merge away `BADGE_SHAPE`'s
 * `border` and leave the badge uncounted.
 */
export function CardBadge({
  teamId,
  year,
  className,
}: {
  teamId: string;
  year: number;
  className?: string;
}) {
  const livery = useLiveryAt()(teamId, year);
  return livery === undefined ? null : (
    <LiveryBadge
      livery={livery}
      className={cn("outline-badge-line size-[44px] outline", className)}
    />
  );
}

/** A team's car in `year`, as wide as its box: the podium's. */
export function CardCar({ teamId, year }: TeamYear) {
  const livery = useLiveryAt()(teamId, year);
  return livery === undefined ? null : <LiveryCar livery={livery} year={year} size="card" />;
}

/** A flag at the card's scale. */
export function CardFlag({ country, className }: { country: string; className?: string }) {
  return <Flag country={country} className={cn("h-[32px] w-[48px] border-2", className)} />;
}

/**
 * A championship position as the classification draws one: the champion's
 * block filled with the accent, second and third in it, the rest muted.
 */
export function PositionBlock({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "bg-card-header grid size-[44px] place-items-center text-[24px] font-semibold tabular-nums",
        position === 1
          ? STANDOUT_POSITION
          : position <= 3
            ? PODIUM_POSITION
            : "text-muted-foreground",
      )}
    >
      {position}
    </span>
  );
}
