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
    blurb: "One year, revealed session by session — qualifying, race, championship.",
    available: true,
  },
  {
    id: "era-basic",
    title: "Simulate an era (basic version)",
    blurb:
      "Season after season, with drivers ageing and cars developing — but everyone stays where they are.",
    available: false,
  },
  {
    id: "era-advanced",
    title: "Simulate an era (advanced version)",
    blurb:
      "The same, plus a driver market: signings, retirements and the seats that open when someone leaves.",
    available: false,
  },
  {
    id: "game",
    title: "Game mode",
    blurb:
      "Take one team and run it through the years — who you sign, what you build, where it leaves you.",
    available: false,
  },
  {
    id: "edit-ratings",
    title: "Edit ratings",
    blurb:
      "Rewrite the drivers, teams and engines themselves — their careers, or just one season's cars.",
    available: false,
  },
];
