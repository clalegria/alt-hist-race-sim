/**
 * The simulation modes, as the opening screen lists them.
 *
 * Data rather than markup, so a mode that is not built yet is a flag on a card
 * the reader can see rather than a commented-out block they cannot — and so the
 * menu can be tested without a DOM.
 *
 * The order here is the order the cards appear in, and it is deliberate: a
 * season, then the two eras cheapest-first, then the game, then the editor.
 * The eras are split because they are two different amounts of work, not one
 * feature revealed twice — the basic one only needs the progression model and
 * the season loop, the advanced one needs a driver market on top of it. Game
 * mode sits after both because it is the advanced era seen from inside one
 * team, so it needs everything the era needs and a decision loop besides.
 */

export type ModeId = "season" | "era-basic" | "era-advanced" | "game" | "edit-ratings";

export interface Mode {
  readonly id: ModeId;
  readonly title: string;
  readonly blurb: string;
  /** False renders the card greyed out and unclickable, tagged as unfinished. */
  readonly available: boolean;
}

export const MODES: readonly Mode[] = [
  {
    id: "season",
    title: "Simulate a season",
    blurb: "Race one season, race by race, until a champion is crowned.",
    available: true,
  },
  {
    id: "era-basic",
    title: "Simulate an era",
    blurb: "Race multiple seasons.",
    available: true,
  },
  {
    id: "era-advanced",
    title: "Advanced era",
    blurb:
      "Race multiple seasons, as teams hire drivers automatically according to a driver market system.",
    available: false,
  },
  {
    id: "game",
    title: "Game mode",
    blurb: "Run one team through the years: sign the drivers, pick the engine, develop the car.",
    available: false,
  },
  {
    id: "edit-ratings",
    title: "Edit ratings",
    blurb: "Disagree with a driver's or a car's rating? Change it yourself.",
    available: false,
  },
];
