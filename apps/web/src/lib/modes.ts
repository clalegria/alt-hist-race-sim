/**
 * The simulation modes, as the opening screen lists them.
 *
 * Data rather than markup, so a mode that is not built yet is a flag on a card
 * the reader can see rather than a commented-out block they cannot — and so the
 * menu can be tested without a DOM.
 */

export type ModeId = "season" | "career";

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
    id: "career",
    title: "Simulate 1980–2026",
    blurb:
      "Every season in sequence, with drivers ageing, retiring and changing teams between years.",
    available: false,
  },
];
