/**
 * Share: the button beside a page's heading and the dialog it opens, showing
 * the page's two cards side by side, each scaled down to fit its column, with
 * Save under each and Share where the browser sends files
 * (`docs/design/share-image.md`).
 *
 * **A phone shows one card at a time**, the other a swipe away: the cards sit
 * on a horizontal track that snaps to each, the usual carousel, with arrows
 * and a dot per card in the footer's left, where the run's phone band keeps
 * its arrows. Below `sm` that is CSS scroll snapping, from `sm` up a grid; the
 * markup is the same, so only a media query chooses (`web-app.md`).
 *
 * The cards are built when the dialog opens, not with the page: Radix mounts a
 * dialog's content only while it is open.
 */

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  cardFileName,
  type ShareCardData,
  type ShareOffer,
  shareCardsOf,
} from "../lib/share-card.js";
import { canShareFiles, cardPng, saveFile, sharingCancelled } from "../lib/share-png.js";
import { cn } from "../lib/utils.js";
import { CARD_HEIGHT, CARD_WIDTH } from "./ShareCard.js";
import {
  ChampionOfChampionsShare,
  FinalStandingsShare,
  LastChampionsShare,
  WorldChampionShare,
} from "./ShareCards.js";
import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js";

/** Each card's name under it. */
const CARD_LABELS: Record<ShareCardData["kind"], string> = {
  "champion-of-champions": "Champion of champions",
  "last-champions": "The last champions",
  "world-champion": "World champion",
  "final-standings": "Final standings",
};

/** Before the first measure: any scale but zero, which the surname's fit would read as no room. */
const FIRST_SCALE = 1 / 3;

function cardOf(data: ShareCardData): ReactNode {
  switch (data.kind) {
    case "champion-of-champions":
      return <ChampionOfChampionsShare card={data.card} />;
    case "last-champions":
      return <LastChampionsShare card={data.card} />;
    case "world-champion":
      return <WorldChampionShare card={data.card} />;
    case "final-standings":
      return <FinalStandingsShare card={data.card} />;
  }
}

/**
 * A card laid out at full size and drawn scaled to its box's width. `onCard`
 * is handed the card's own element, which the PNG is drawn from.
 */
function ScaledCard({
  children,
  onCard,
}: {
  children: ReactNode;
  onCard: (card: HTMLElement | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(FIRST_SCALE);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) {
      return;
    }
    const fit = () => {
      if (element.clientWidth > 0) {
        setScale(element.clientWidth / CARD_WIDTH);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="border-border relative w-full overflow-hidden border"
      style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
    >
      <div
        ref={(scaled) => onCard(scaled?.querySelector<HTMLElement>(".share-card") ?? null)}
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** The slide whose start is nearest `scrollLeft`, given where each starts on the track. */
export function slideAt(scrollLeft: number, starts: readonly number[]): number {
  let nearest = 0;
  starts.forEach((start, index) => {
    if (Math.abs(start - scrollLeft) < Math.abs((starts[nearest] ?? 0) - scrollLeft)) {
      nearest = index;
    }
  });
  return nearest;
}

/** The phone's track: which card is in view, and a way to bring another into it. */
function useCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const slides = () => [...(track.current?.children ?? [])] as HTMLElement[];
  return {
    track,
    current,
    onScroll: () =>
      setCurrent(
        slideAt(
          track.current?.scrollLeft ?? 0,
          slides().map((slide) => slide.offsetLeft),
        ),
      ),
    // The track is `relative`, so a slide's offset is its place on it; the glide is CSS's.
    go: (index: number) => track.current?.scrollTo({ left: slides()[index]?.offsetLeft ?? 0 }),
  };
}

/** What a tap is doing, so its button can say so and the others wait. */
type Busy = { readonly action: "save" | "share"; readonly kind: ShareCardData["kind"] } | "both";

/**
 * The dialog's body and footer: each card with its name, Save and Share, then
 * the phone's arrows, Share both and Close. Not a portal, so a static render
 * inside a `Dialog` draws it.
 *
 * **A card's PNG is made on its first tap and kept**, so a second tap, or Share
 * after Save, sends it at once. That matters on a phone: a share sheet opens
 * only soon after a tap, and drawing a card can outlast that, so a Share that
 * fails is tried again with the picture already made.
 */
export function ShareCardsPanel({ offer }: { offer: ShareOffer }) {
  const [cards] = useState(() => shareCardsOf(offer));
  const [sharing] = useState(() => ({
    one: canShareFiles(globalThis.navigator, 1),
    both: canShareFiles(globalThis.navigator, 2),
  }));
  const elements = useRef(new Map<ShareCardData["kind"], HTMLElement>());
  const files = useRef(new Map<ShareCardData["kind"], Promise<File>>());
  const [busy, setBusy] = useState<Busy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const carousel = useCarousel();

  const fileOf = (data: ShareCardData): Promise<File> => {
    const kept = files.current.get(data.kind);
    if (kept !== undefined) {
      return kept;
    }
    const element = elements.current.get(data.kind);
    if (element === undefined) {
      return Promise.reject(new Error("The card is not on the page"));
    }
    const file = cardPng(element).then(
      (png) => new File([png], cardFileName(data), { type: "image/png" }),
    );
    // A failed drawing is not kept, so the next tap draws again.
    file.catch(() => files.current.delete(data.kind));
    files.current.set(data.kind, file);
    return file;
  };

  const act = async (doing: Busy, work: () => Promise<void>, failed: string) => {
    setBusy(doing);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      if (!sharingCancelled(error)) {
        setProblem(failed);
      }
    } finally {
      setBusy(null);
    }
  };
  const save = (data: ShareCardData) =>
    act(
      { action: "save", kind: data.kind },
      async () => saveFile(await fileOf(data)),
      "Couldn't save that card. Try again.",
    );
  const share = (data: ShareCardData) =>
    act(
      { action: "share", kind: data.kind },
      async () => navigator.share({ files: [await fileOf(data)] }),
      "Couldn't share that card. Try again.",
    );
  const shareBoth = () =>
    act(
      "both",
      async () => navigator.share({ files: await Promise.all(cards.map(fileOf)) }),
      "Couldn't share the cards. Try again.",
    );
  const doing = (action: "save" | "share", kind: ShareCardData["kind"]) =>
    busy !== null && busy !== "both" && busy.action === action && busy.kind === kind;

  return (
    <>
      <DialogBody>
        <DialogDescription>Show your friends the history you made.</DialogDescription>
        {problem === null ? null : (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
        <div
          ref={carousel.track}
          onScroll={carousel.onScroll}
          className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] motion-safe:scroll-smooth sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((data) => (
            <div key={data.kind} className="flex w-full shrink-0 snap-center justify-center">
              {/* Short enough that a card, its name and the dialog's bands fit a laptop's screen. */}
              <figure className="flex w-full max-w-[calc((100dvh-17rem)*9/16)] flex-col gap-2">
                <ScaledCard
                  onCard={(card) => {
                    if (card === null) {
                      elements.current.delete(data.kind);
                    } else {
                      elements.current.set(data.kind, card);
                    }
                  }}
                >
                  {cardOf(data)}
                </ScaledCard>
                <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="text-muted-foreground text-sm">{CARD_LABELS[data.kind]}</span>
                  <span className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => save(data)}
                    >
                      {doing("save", data.kind) ? "Saving…" : "Save"}
                    </Button>
                    {sharing.one ? (
                      <Button size="sm" disabled={busy !== null} onClick={() => share(data)}>
                        {doing("share", data.kind) ? "Sharing…" : "Share"}
                      </Button>
                    ) : null}
                  </span>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        {cards.length > 1 ? (
          <div className="mr-auto flex items-center gap-2 sm:hidden">
            <Button
              variant="outline"
              className="w-9 px-0 text-lg"
              aria-label="Previous card"
              disabled={carousel.current === 0}
              onClick={() => carousel.go(carousel.current - 1)}
            >
              ‹
            </Button>
            <span aria-hidden="true" className="flex gap-1.5">
              {cards.map((data, index) => (
                <span
                  key={data.kind}
                  className={cn(
                    "size-1.5 rounded-full",
                    index === carousel.current ? "bg-foreground" : "bg-subtle opacity-60",
                  )}
                />
              ))}
            </span>
            <Button
              variant="outline"
              className="w-9 px-0 text-lg"
              aria-label="Next card"
              disabled={carousel.current === cards.length - 1}
              onClick={() => carousel.go(carousel.current + 1)}
            >
              ›
            </Button>
            <span aria-live="polite" className="sr-only">
              {`Card ${carousel.current + 1} of ${cards.length}`}
            </span>
          </div>
        ) : null}
        {sharing.both && cards.length > 1 ? (
          <Button variant="outline" disabled={busy !== null} onClick={shareBoth}>
            {busy === "both" ? "Sharing…" : "Share both"}
          </Button>
        ) : null}
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

/** The Share button and its dialog. */
export function ShareButton({ offer }: { offer: ShareOffer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {offer.mode === "season" ? `Share your ${offer.world.year}` : "Share your era"}
            </DialogTitle>
          </DialogHeader>
          <ShareCardsPanel offer={offer} />
        </DialogContent>
      </Dialog>
    </>
  );
}
