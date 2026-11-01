/**
 * The four share cards, rendered statically off a real season and a short
 * era: each draws what its data holds, row for row, on the frame. Never who
 * won or by how much: the expectations are read off the card data itself.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/car-drawings.js";
import { ordinal } from "../lib/history.js";
import { driverName, nameParts } from "../lib/names.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import {
  championOfChampionsCard,
  finalStandingsCard,
  lastChampionsCard,
  SHARE_ADDRESS,
  worldChampionCard,
} from "../lib/share-card.js";
import { createWorld, type World } from "../store/season.js";
import { seededWorld, textOf } from "../test-support.js";
import { PositionBlock } from "./ShareCard.js";
import {
  ChampionOfChampionsShare,
  FinalStandingsShare,
  LastChampionsShare,
  WorldChampionShare,
} from "./ShareCards.js";

/** Consecutive seasons off the data, each its own world. */
const era: readonly World[] = PLAYABLE_SEASONS.slice(0, 4).map((year, index) =>
  createWorld(index + 1, year),
);
const world = seededWorld();

function defined<T>(value: T | null): T {
  if (value === null) {
    throw new Error("the fixture has a champion");
  }
  return value;
}

const CANVAS = `viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`;
const carsIn = (html: string) => html.split(CANVAS).length - 1;
const surnameOf = (driverId: string) => nameParts(driverName(driverId)).surname;

describe("the champion of champions card", () => {
  const card = defined(championOfChampionsCard(era));
  const html = renderToStaticMarkup(<ChampionOfChampionsShare card={card} />);
  const text = textOf(html);

  it("names the champion of champions and counts their titles", () => {
    expect(text).toContain("I replayed history and my champion of champions is…");
    expect(text).toContain(surnameOf(card.champion.id));
    expect(text).toContain(card.champion.titles.length === 1 ? "World title" : "World titles");
    expect(text).toContain(SHARE_ADDRESS);
  });

  it("lists every other champion and the Constructors' line", () => {
    for (const { id } of card.others) {
      expect(text).toContain(surnameOf(id));
    }
    expect(text).toContain("The other champions");
    expect(text).toContain("Constructors");
  });

  it("draws one car, the champion's", () => {
    expect(carsIn(html)).toBe(1);
  });
});

describe("the last champions card", () => {
  const card = defined(lastChampionsCard(era));
  const html = renderToStaticMarkup(<LastChampionsShare card={card} />);
  const text = textOf(html);

  it("lists every season of a short era, newest first", () => {
    expect(text).toContain("I replayed history and these are my champions");
    const aside = `${card.rows[0]?.year} → ${card.rows.at(-1)?.year}`;
    const rowsAt = text.indexOf(aside) + aside.length;
    const years = card.rows.map(({ year }) => text.indexOf(String(year), rowsAt));
    expect(years.every((at) => at > -1)).toBe(true);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("marks a repeat title by its number, and a first by nothing", () => {
    for (const { title } of card.rows) {
      if (title > 1) {
        expect(text).toContain(ordinal(title));
      }
    }
    expect(text).not.toContain("1st");
  });
});

describe("the world champion card", () => {
  const card = defined(worldChampionCard(world));
  const html = renderToStaticMarkup(<WorldChampionShare card={card} />);
  const text = textOf(html);

  it("names the champion and their points in the lead and subject", () => {
    expect(text).toContain(`I replayed ${world.year} and my world champion is…`);
    expect(text).toContain(surnameOf(card.champion.driverId));
    expect(text).toContain("Points");
  });

  it("draws the band's car and one per podium step", () => {
    expect(carsIn(html)).toBe(1 + card.podium.length);
  });

  it("gives every round a winner's code, the champion's in the accent", () => {
    for (const { winner } of card.winners) {
      expect(text).toContain(winner?.code ?? "—");
    }
    const grid = html.slice(html.indexOf("Race winners"), html.indexOf("Constructors"));
    const accented = grid.match(/<span class="[^"]*text-\[26px\][^"]*text-primary[^"]*">/g) ?? [];
    expect(accented.length).toBe(card.winners.filter(({ champion }) => champion).length);
  });
});

describe("the final standings card", () => {
  const card = defined(finalStandingsCard(world));
  const html = renderToStaticMarkup(<FinalStandingsShare card={card} />);
  const text = textOf(html);

  it("draws a row per scorer, each with its position block", () => {
    expect(text).toContain(`I replayed ${world.year} and this is how my championship finished`);
    for (const { position, driverId } of card.rows) {
      expect(html).toContain(renderToStaticMarkup(<PositionBlock position={position} />));
      expect(text).toContain(surnameOf(driverId));
    }
  });

  it("draws one car, the champion's", () => {
    expect(carsIn(html)).toBe(1);
  });
});
