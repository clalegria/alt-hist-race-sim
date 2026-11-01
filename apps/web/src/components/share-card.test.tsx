/**
 * The share card's frame and its parts, rendered statically: what every card
 * carries, that each colour is read at the card's own year, and the ribbon's
 * stripes, on synthetic liveries. Never who won or what colour a team is.
 */

import { firstYearInRun, type Livery } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/car-drawings.js";
import { PODIUM_POSITION, STANDOUT_POSITION } from "../lib/highlight.js";
import { liveryFor } from "../lib/livery.js";
import { driverName, nameParts } from "../lib/names.js";
import { headingLine, SHARE_ADDRESS, worldChampionCard } from "../lib/share-card.js";
import { seededWorld, textOf } from "../test-support.js";
import { KeptLiveries } from "./Liveries.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CardBadge,
  CardPanel,
  PositionBlock,
  SeasonMark,
  ShareCardFrame,
  SubjectName,
} from "./ShareCard.js";
import { BADGE_SHAPE, barcodeBackground, ribbonBackground } from "./TeamBadge.js";
import { CAR_SIZES } from "./TeamCar.js";

const world = seededWorld();
const card = (() => {
  const champion = worldChampionCard(world);
  if (champion === null) {
    throw new Error("the fixture season has a champion");
  }
  return champion;
})();
const { driverId, teamId } = card.champion;
const car = { teamId, year: world.year };

function frame(): string {
  return renderToStaticMarkup(
    <ShareCardFrame
      heading={headingLine(card.heading)}
      lead={{ before: "I replayed it and my", emphasis: "world champion", after: "is…" }}
      subject={<SubjectName driverId={driverId} />}
      car={car}
    >
      <CardPanel label="Race winners" aside="round by round" foot={<span>Foot</span>}>
        <p>Rows</p>
      </CardPanel>
    </ShareCardFrame>,
  );
}

const CANVAS = `viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`;

describe("the card frame", () => {
  const html = frame();
  const text = textOf(html);

  it("is the PNG's size, in the dark palette", () => {
    expect(html).toContain(`width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px`);
    expect(html).toContain('class="share-card ');
  });

  it("carries the heading line, the lead and the footer's address", () => {
    const { title, detail } = headingLine(card.heading);
    expect(text).toContain(title);
    expect(text).toContain(detail);
    expect(text).toContain("I replayed it and my world champion is…");
    expect(html).toMatch(/<em class="[^"]*text-primary[^"]*">world champion<\/em>/);
    expect(text).toContain(`Make your own history at${SHARE_ADDRESS}`);
  });

  it("names the subject, given name over surname", () => {
    const { given, surname } = nameParts(driverName(driverId));
    expect(text).toContain(`${given}${surname}`);
  });

  it("draws one car, the champion's, at the card's size, on its livery's ribbon", () => {
    const livery = liveryFor(teamId, world.year);
    expect(livery).toBeDefined();
    if (livery === undefined) {
      return;
    }
    expect(html.split(CANVAS)).toHaveLength(2);
    expect(html).toContain(CAR_SIZES.card);
    expect(html).toContain(`background:${ribbonBackground(livery)}`);
  });

  it("lays the panels out between the car band and the footer", () => {
    const band = html.indexOf("data-car-band");
    const panel = html.indexOf("Race winners");
    expect(band).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(band);
    expect(html.indexOf("<footer")).toBeGreaterThan(panel);
    expect(text).toContain("round by round");
    expect(text).toContain("Foot");
  });
});

describe("the card's marks", () => {
  it("reads a season's colours at that season, through the run's kept liveries", () => {
    const from = world.year;
    const later = world.year + 1;
    const keptYear = firstYearInRun(teamId, later, from);
    const kept = keptYear === undefined ? undefined : liveryFor(teamId, keptYear);
    const mark = renderToStaticMarkup(
      <KeptLiveries from={from}>
        <SeasonMark teamId={teamId} year={later} />
      </KeptLiveries>,
    );
    expect(kept).toBeDefined();
    if (kept !== undefined) {
      expect(mark).toContain(`background:${barcodeBackground(kept)}`);
    }
    expect(textOf(mark)).toBe(String(later).slice(-2));
  });

  it("counts a resized badge as a badge", () => {
    const badge = renderToStaticMarkup(<CardBadge teamId={teamId} year={world.year} />);
    expect(badge).toContain(BADGE_SHAPE);
  });

  it("fills the champion's position with the accent and puts the podium's in it", () => {
    const block = (position: number) => renderToStaticMarkup(<PositionBlock position={position} />);
    expect(block(1)).toContain(STANDOUT_POSITION);
    expect(block(2)).toContain(PODIUM_POSITION);
    expect(block(3)).toContain(PODIUM_POSITION);
    expect(block(4)).not.toContain(PODIUM_POSITION);
    expect(block(4)).not.toContain(STANDOUT_POSITION);
  });
});

describe("the livery ribbon", () => {
  const PRIMARY = "#aa0000";
  const ACCENT_1 = "#00bb00";
  const ACCENT_2 = "#0000cc";
  const livery = (badgeStripes: number): Livery => ({
    primaryColor: PRIMARY,
    secondaryColor1: ACCENT_1,
    secondaryColor2: ACCENT_2,
    badgeStripes,
  });
  /** Each band's colour, in order across the ribbon. */
  const colours = (background: string) =>
    [...background.matchAll(/(#[0-9a-f]{6}|var\([^)]+\)|transparent) calc/g)].map(
      (match) => match[1],
    );
  const LINE = "var(--color-badge-line)";

  it("is the primary alone, edged, with no stripe", () => {
    expect(colours(ribbonBackground(livery(0)))).toEqual([
      "transparent",
      LINE,
      PRIMARY,
      PRIMARY,
      PRIMARY,
      PRIMARY,
      PRIMARY,
      LINE,
      "transparent",
    ]);
  });

  it("puts the one accent either side of the primary with one stripe", () => {
    expect(colours(ribbonBackground(livery(1)))).toEqual([
      "transparent",
      LINE,
      ACCENT_1,
      LINE,
      PRIMARY,
      LINE,
      ACCENT_1,
      LINE,
      "transparent",
    ]);
  });

  it("puts one accent each side with two", () => {
    expect(colours(ribbonBackground(livery(2)))).toEqual([
      "transparent",
      LINE,
      ACCENT_1,
      LINE,
      PRIMARY,
      LINE,
      ACCENT_2,
      LINE,
      "transparent",
    ]);
  });
});
