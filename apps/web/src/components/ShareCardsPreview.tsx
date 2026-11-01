/**
 * The four share cards drawn from the open run, scaled side by side: a page for
 * looking at them while they are built, at `/dev/share-cards` in dev builds.
 * Temporary: the preview dialog replaces it (`docs/design/share-image.md`).
 *
 * The era's cards cover every finished season, the season's cards the latest.
 * A season counts as finished once the cursor reaches its summary, as Share
 * will be offered; nothing finished yet draws a line saying so.
 */

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  championOfChampionsCard,
  finalStandingsCard,
  lastChampionsCard,
  worldChampionCard,
} from "../lib/share-card.js";
import { type Run, useSeasonStore, type World } from "../store/season.js";
import { KeptNames } from "./EntryNames.js";
import { KeptLiveries } from "./Liveries.js";
import { CARD_HEIGHT, CARD_WIDTH } from "./ShareCard.js";
import {
  ChampionOfChampionsShare,
  FinalStandingsShare,
  LastChampionsShare,
  WorldChampionShare,
} from "./ShareCards.js";

/** How far each card is scaled down to sit two to a row on a wide screen. */
const PREVIEW_SCALE = 0.5;

/** The run's finished seasons, oldest first. */
function finishedSeasons(run: Run): readonly World[] {
  const done = run.cursor.kind === "summary" || run.cursor.kind === "review";
  const before = run.kind === "era" ? run.run.seasons : [];
  return done ? [...before, run.world] : before;
}

/**
 * One card, laid out at full size and drawn at the preview's scale, with how
 * it fits: the car band's height, or how far the footer runs off the card.
 */
function Scaled({ label, children }: { label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState("");
  useLayoutEffect(() => {
    const measure = () => {
      const card = box.current?.querySelector(".share-card");
      const band = card?.querySelector("[data-car-band]");
      const foot = card?.querySelector("footer");
      if (
        !(card instanceof HTMLElement && band instanceof HTMLElement && foot instanceof HTMLElement)
      ) {
        return;
      }
      const over = foot.offsetTop + foot.offsetHeight - CARD_HEIGHT;
      setFit(over > 0 ? `overflows by ${over}px` : `car band ${band.offsetHeight}px`);
    };
    measure();
    void document.fonts?.ready.then(measure);
  }, []);
  return (
    <figure className="grid gap-2">
      <div
        ref={box}
        className="border-border overflow-hidden border"
        style={{ width: CARD_WIDTH * PREVIEW_SCALE, height: CARD_HEIGHT * PREVIEW_SCALE }}
      >
        <div className="origin-top-left" style={{ transform: `scale(${PREVIEW_SCALE})` }}>
          {children}
        </div>
      </div>
      <figcaption className="text-muted-foreground text-sm">
        {label}
        {fit === "" ? null : <span className="text-subtle"> · {fit}</span>}
      </figcaption>
    </figure>
  );
}

export function ShareCardsPreview() {
  const run = useSeasonStore((state) => state.run);
  const seasons = run === null ? [] : finishedSeasons(run);
  const latest = seasons.at(-1);
  if (run === null || latest === undefined) {
    return <p className="p-8">No finished season in the open run.</p>;
  }
  const champions = run.kind === "era" ? championOfChampionsCard(seasons) : null;
  const last = run.kind === "era" ? lastChampionsCard(seasons) : null;
  const champion = worldChampionCard(latest);
  const standings = finalStandingsCard(latest);
  return (
    <KeptNames from={run.world.namesKeptFrom}>
      <KeptLiveries from={run.world.liveriesKeptFrom}>
        <main className="flex flex-wrap gap-8 p-8">
          {champions === null ? null : (
            <Scaled label="Champion of champions">
              <ChampionOfChampionsShare card={champions} />
            </Scaled>
          )}
          {last === null ? null : (
            <Scaled label="The last champions">
              <LastChampionsShare card={last} />
            </Scaled>
          )}
          {champion === null ? null : (
            <Scaled label="World champion">
              <WorldChampionShare card={champion} />
            </Scaled>
          )}
          {standings === null ? null : (
            <Scaled label="Final standings">
              <FinalStandingsShare card={standings} />
            </Scaled>
          )}
        </main>
      </KeptLiveries>
    </KeptNames>
  );
}
