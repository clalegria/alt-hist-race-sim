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
    blurb:
      "One year, as it unfolds race by race until a champion is crowned. The grid starts as the one in real life, but you're allowed to swap drivers to simulate what-if scenarios.",
    available: true,
  },
  {
    id: "era-basic",
    title: "Simulate an era (basic version)",
    blurb:
      "The extension of simulate a season mode, but for multiple years. Grid changes year after year as per real life, but again, can be edited manually any year if you so wish.",
    available: true,
  },
  {
    id: "era-advanced",
    title: "Simulate an era (advanced version)",
    blurb:
      "Simulate multiple years, as the computer automatically moves drivers across teams according to a system of contractual commitments, events, and whichever market forces are swayed by the events that happen.",
    available: false,
  },
  {
    id: "game",
    title: "Game mode",
    blurb:
      "Control one team and manage it through the years. Navigate driver contracts, engine deals and car development directions.",
    available: false,
  },
  {
    id: "edit-ratings",
    title: "Edit ratings",
    blurb:
      "Don't agree with the ratings presented that give life to the simulation? Edit them yourself.",
    available: false,
  },
];
