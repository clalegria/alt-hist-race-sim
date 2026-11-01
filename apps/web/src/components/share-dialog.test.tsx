/**
 * Share: offered on a season's page once its summary is reached and on the
 * era's champions page between seasons, never with a year under way; and the
 * dialog's body draws each of the offer's cards with its own Save. Pages are
 * rendered from what `resolveRunPage` hands them, cursor by cursor.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveRunPage } from "../lib/run-places.js";
import { type ShareOffer, shareCardsOf } from "../lib/share-card.js";
import type { Beat } from "../lib/timeline.js";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import { EraChampions } from "./EraChampions.js";
import { SeasonOverview } from "./SeasonOverview.js";
import { ShareCardsBody } from "./ShareDialog.js";

const first = seededWorld(3, "aged", YEAR);
const second = seededWorld(4, "aged", YEAR + 1);
const LAST_ROUND = second.season.races.length - 1;

/** The Share button itself, not a word in a sentence. */
const offersShare = (html: string) => />Share<\/button>/.test(html);

/** Cursors before a season's end, then at it and after. */
const UNDER_WAY: readonly Beat[] = [
  { kind: "grid" },
  { kind: "qualifying", round: 0 },
  { kind: "race", round: LAST_ROUND },
];
const ENDED: readonly Beat[] = [{ kind: "summary" }, { kind: "review" }];

function era(cursor: Beat): Run {
  return { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: second, cursor };
}

function seasonPage(run: Run, year: number): string {
  const resolved = resolveRunPage(run, "season", { year: String(year) });
  if (resolved.kind !== "season") {
    throw new Error(`the season page resolved to ${resolved.kind}`);
  }
  return renderToStaticMarkup(
    <SeasonOverview world={resolved.world} finished={resolved.finished} tab="standings" />,
  );
}

function championsPage(run: Run): string {
  const resolved = resolveRunPage(run, "review", {});
  if (resolved.kind !== "review") {
    throw new Error(`the champions page resolved to ${resolved.kind}`);
  }
  return renderToStaticMarkup(<EraChampions run={resolved.run} inProgress={resolved.inProgress} />);
}

describe("where Share is offered", () => {
  it("on a season's page only once its summary is reached", () => {
    for (const cursor of UNDER_WAY) {
      expect(offersShare(seasonPage({ kind: "season", world: second, cursor }, YEAR + 1))).toBe(
        false,
      );
    }
    expect(
      offersShare(
        seasonPage({ kind: "season", world: second, cursor: { kind: "summary" } }, YEAR + 1),
      ),
    ).toBe(true);
  });

  it("on an earlier season's page in an era, whatever the year under way", () => {
    for (const cursor of [...UNDER_WAY, ...ENDED]) {
      expect(offersShare(seasonPage(era(cursor), YEAR))).toBe(true);
    }
  });

  it("on the era's champions page between seasons, never with a year under way", () => {
    for (const cursor of UNDER_WAY) {
      expect(offersShare(championsPage(era(cursor)))).toBe(false);
    }
    for (const cursor of ENDED) {
      expect(offersShare(championsPage(era(cursor)))).toBe(true);
    }
  });
});

describe("the dialog's body", () => {
  const offers: readonly ShareOffer[] = [
    { mode: "season", world: first },
    { mode: "era", seasons: [first, second] },
  ];

  it("draws each card of the offer with its own Save, waiting on the image", () => {
    for (const offer of offers) {
      const cards = shareCardsOf(offer);
      const html = renderToStaticMarkup(<ShareCardsBody offer={offer} />);
      expect(html.split('class="share-card ').length - 1).toBe(cards.length);
      expect(html.match(/>Save<\/button>/g)?.length).toBe(cards.length);
      expect(html.split('disabled=""').length - 1).toBe(cards.length);
    }
  });
});
