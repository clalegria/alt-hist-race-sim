/**
 * The screens to capture, in order, and how a reader gets to each.
 *
 * A run lives on one URL, `/run`, with no way to reach a given stage of it
 * from the address bar yet, so a step is reached by clicking on from the one
 * before it — `reach` assumes the page is showing the previous step's screen.
 * Once a share link exists, each `reach` becomes a `page.goto()` of one and
 * the steps stop depending on each other; the runner in `main.ts` does not
 * change.
 *
 * Locators go by role and visible text, as a reader finds things, never by CSS
 * class: the styling is the thing these pictures are for checking, and it moves.
 */

import type { Locator, Page } from "playwright";

/** The season both flows start from. */
export const YEAR = 1984;

export interface Step {
  /** The screen's slug in the PNG's file name. */
  readonly name: string;
  /** Gets from the previous step's screen to this one, and waits until it is drawn. */
  readonly reach: (page: Page) => Promise<void>;
}

/** Buttons appear twice on the season screen — sticky bar and page foot — so take the first. */
function button(page: Page, name: string | RegExp): Locator {
  return page.getByRole("button", { name, exact: typeof name === "string" }).first();
}

/** Opens the year's decade on the picker, then selects the year. */
async function pickYear(page: Page, label: string): Promise<void> {
  await button(page, `The ${Math.floor(YEAR / 10) * 10}s`).click();
  await button(page, label).click();
  await page.getByRole("button", { name: label, exact: true, pressed: true }).waitFor();
}

export const STEPS: readonly Step[] = [
  {
    name: "menu",
    reach: async (page) => {
      await page.goto("/");
      await page.getByRole("heading", { name: "Rewrite motorsport history" }).waitFor();
    },
  },
  {
    name: "season-setup",
    reach: async (page) => {
      await button(page, /^Simulate a season/).click();
      await pickYear(page, `Simulate the ${YEAR} season`);
    },
  },
  {
    name: "grid",
    reach: async (page) => {
      await button(page, `Begin the ${YEAR} season`).click();
      await button(page, "Simulate full season").waitFor();
    },
  },
  {
    name: "qualifying",
    reach: async (page) => {
      await button(page, "Simulate next session").click();
      await page.getByText(/^Round 1\/\d+ — Qualifying$/).waitFor();
    },
  },
  {
    name: "race",
    reach: async (page) => {
      await button(page, "Simulate next session").click();
      await page.getByText(/^Round 1\/\d+ — Race$/).waitFor();
    },
  },
  {
    name: "season-summary",
    reach: async (page) => {
      await button(page, "Simulate rest of the season").click();
      await page.getByText("Season summary", { exact: true }).first().waitFor();
    },
  },
  {
    name: "era-setup",
    reach: async (page) => {
      await button(page, "Start again").click();
      await button(page, "Main menu").click();
      await button(page, /^Simulate an era \(basic version\)/).click();
      await pickYear(page, `Start an era in ${YEAR}`);
    },
  },
  {
    name: "era-grid",
    reach: async (page) => {
      await button(page, `Begin an era from ${YEAR}`).click();
      await page.getByText(`${YEAR} Season — era from ${YEAR}`).waitFor();
    },
  },
  {
    name: "era-summary",
    reach: async (page) => {
      await button(page, "Simulate full season").click();
      await button(page, "Show champions so far").waitFor();
    },
  },
  {
    name: "era-champions",
    reach: async (page) => {
      await button(page, "Show champions so far").click();
      await page.getByText("Between seasons", { exact: true }).waitFor();
    },
  },
];
