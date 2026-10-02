/**
 * The screens to capture, in order, and how a reader gets to each.
 *
 * A run lives only in the page's memory — nothing survives a reload yet — so a
 * step is reached by clicking on from the one before it, never by `goto`:
 * `reach` assumes the page is showing the previous step's screen. Back and
 * forward are browser history, so some steps are a `goBack()`, which is also
 * what exercises the guard on leaving a run.
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

/** Buttons appear twice on a run's pages — run bar and page foot — so take the first. */
function button(page: Page, name: string | RegExp): Locator {
  return page.getByRole("button", { name, exact: typeof name === "string" }).first();
}

/** Opens the decade on the picker, then selects the year. */
async function pickYear(page: Page, label: string): Promise<void> {
  await button(page, `The ${Math.floor(YEAR / 10) * 10}s`).click();
  await button(page, label).click();
  await page.getByRole("button", { name: label, exact: true, pressed: true }).waitFor();
}

/**
 * Picks one of the run bar's actions: a button on a wide screen, an item in
 * the ⋯ menu on a phone. A role locator skips what CSS hides, so whichever
 * layout is showing is the one found.
 */
async function runAction(page: Page, name: string): Promise<void> {
  const direct = page.getByRole("button", { name, exact: true }).first();
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await button(page, "More run actions").click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

/** Waits for the run bar to say the run has reached `text`. */
async function cursorAt(page: Page, text: string | RegExp): Promise<void> {
  await page.getByText(text).first().waitFor();
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
      await page.waitForURL(`**/run/${YEAR}/grid`);
      await cursorAt(page, `${YEAR} · Grid`);
    },
  },
  {
    name: "qualifying",
    reach: async (page) => {
      await button(page, /^Continue/).click();
      await page.waitForURL(`**/run/${YEAR}/round/1/qualifying`);
      await cursorAt(page, new RegExp(`^${YEAR} · Round 1/\\d+ · Qualifying$`));
    },
  },
  {
    name: "race",
    reach: async (page) => {
      await button(page, /^Continue/).click();
      await page.waitForURL(`**/run/${YEAR}/round/1/race`);
      await cursorAt(page, new RegExp(`^${YEAR} · Round 1/\\d+ · Race$`));
    },
  },
  {
    name: "season-summary",
    reach: async (page) => {
      await runAction(page, "Simulate rest of the season");
      await page.waitForURL(`**/run/${YEAR}`);
      await cursorAt(page, `${YEAR} · Season summary`);
    },
  },
  {
    name: "grid-raced",
    reach: async (page) => {
      // Back through the pages already read: a place, never a step back in time.
      for (let i = 0; i < 3; i += 1) {
        await page.goBack();
      }
      await page.waitForURL(`**/run/${YEAR}/grid`);
      await page.getByText("This grid has been raced", { exact: false }).waitFor();
    },
  },
  {
    name: "exit-dialog",
    reach: async (page) => {
      // One more Back is past the run's first page, which asks first.
      await page.goBack();
      await page.getByRole("alertdialog", { name: "Exit this run?" }).waitFor();
    },
  },
  {
    name: "home-resume",
    reach: async (page) => {
      await button(page, "Cancel").click();
      await page.getByRole("link", { name: "alt-hist", exact: true }).click();
      await page.getByText("Resume run").waitFor();
    },
  },
  {
    name: "era-setup",
    reach: async (page) => {
      await page.getByRole("link", { name: "Era (basic)", exact: true }).click();
      await pickYear(page, `Start an era in ${YEAR}`);
    },
  },
  {
    name: "replace-dialog",
    reach: async (page) => {
      await button(page, `Begin an era from ${YEAR}`).click();
      await page.getByRole("alertdialog", { name: "Start a new run?" }).waitFor();
    },
  },
  {
    name: "era-grid",
    reach: async (page) => {
      await button(page, "End it and start").click();
      await page.waitForURL(`**/run/${YEAR}/grid`);
      await page
        .getByRole("navigation", { name: "Breadcrumb" })
        .first()
        .getByText("Era", { exact: true })
        .waitFor();
    },
  },
  {
    name: "era-summary",
    reach: async (page) => {
      await runAction(page, "Simulate full season");
      await cursorAt(page, `${YEAR} · Season summary`);
    },
  },
  {
    name: "era-champions",
    reach: async (page) => {
      await button(page, /^Continue/).click();
      await page.waitForURL("**/run");
      await cursorAt(page, `${YEAR} · Between seasons`);
    },
  },
  {
    name: "era-jump",
    reach: async (page) => {
      await runAction(page, "Jump to…");
      await page.getByRole("alertdialog", { name: "Jump to…" }).waitFor();
    },
  },
  {
    name: "era-jumped",
    reach: async (page) => {
      // The dialog opens on the end of the next year.
      await button(page, `Simulate through ${YEAR + 1}`).click();
      await page.waitForURL(`**/run/${YEAR + 1}`);
      await cursorAt(page, `${YEAR + 1} · Season summary`);
    },
  },
  {
    name: "era-restart-dialog",
    reach: async (page) => {
      await runAction(page, "Restart era");
      await page.getByRole("alertdialog", { name: "Restart the era?" }).waitFor();
    },
  },
];
