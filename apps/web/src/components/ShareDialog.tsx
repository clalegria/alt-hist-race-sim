/**
 * Share: the button beside a page's heading and the dialog it opens, showing
 * the page's two cards side by side (stacked on a phone), each scaled down to
 * fit its column, with Save under each (`docs/design/share-image.md`).
 *
 * The cards are built when the dialog opens, not with the page: Radix mounts a
 * dialog's content only while it is open.
 */

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type ShareCardData, type ShareOffer, shareCardsOf } from "../lib/share-card.js";
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

/** A card laid out at full size and drawn scaled to its box's width. */
function ScaledCard({ children }: { children: ReactNode }) {
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
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The dialog's body: each card with its name and Save. Not a portal, so a
 * static render draws it. Save waits on the PNG (steps 4 and 5).
 */
export function ShareCardsBody({ offer }: { offer: ShareOffer }) {
  const cards = shareCardsOf(offer);
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {cards.map((data) => (
        // Short enough that a card, its name and the dialog's bands fit a laptop's screen.
        <figure
          key={data.kind}
          className="flex w-full max-w-[calc((100dvh-17rem)*9/16)] flex-col gap-2 justify-self-center"
        >
          <ScaledCard>{cardOf(data)}</ScaledCard>
          <figcaption className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">{CARD_LABELS[data.kind]}</span>
            <Button variant="outline" size="sm" disabled>
              Save
            </Button>
          </figcaption>
        </figure>
      ))}
    </div>
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
          <DialogBody>
            <DialogDescription>
              Post either card, or both. Saving them is not available yet.
            </DialogDescription>
            <ShareCardsBody offer={offer} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
