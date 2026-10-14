/**
 * The screens to capture, in order, and how a reader gets to each.
 *
 * Each browser context starts with empty storage, so there is no run until a
 * step starts one, and a step is reached by clicking on from the one before it:
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

/**
 * Follows one of the top nav's areas: a tab on a wide screen, a row behind the
 * Menu button on a phone.
 */
async function navTo(page: Page, name: string): Promise<void> {
  const nav = page.getByRole("navigation", { name: "Main" });
  const link = nav.getByRole("link", { name, exact: true });
  if (!(await link.isVisible())) {
    await button(page, "Menu").click();
  }
  await link.click();
}

/** Opens the run settings dialog from the settings line, and waits for it. */
async function openSettings(page: Page): Promise<Locator> {
  await button(page, "Run settings").click();
  const dialog = page.getByRole("dialog", { name: "Run settings" });
  await dialog.waitFor();
  return dialog;
}

/** Shows one tab of the open settings dialog: the others' settings are hidden. */
async function settingsTab(dialog: Locator, name: string): Promise<void> {
  await dialog.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
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
    // The phone's menu open; on a wide screen the areas are already showing.
    name: "nav-menu",
    reach: async (page) => {
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (await menu.isVisible()) {
        await menu.click();
      }
      await page.getByRole("navigation", { name: "Main" }).getByRole("link").first().waitFor();
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
    name: "season-settings",
    reach: async (page) => {
      await openSettings(page);
    },
  },
  {
    name: "grid",
    reach: async (page) => {
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await button(page, `Begin the ${YEAR} season`).click();
      await page.waitForURL(`**/run/${YEAR}/grid`);
      await cursorAt(page, `${YEAR} · Grid`);
    },
  },
  {
    name: "grid-settings",
    reach: async (page) => {
      // The run is untouched, so its settings can still change from here.
      const dialog = await openSettings(page);
      await settingsTab(dialog, "Cars");
      const breakdowns = dialog.getByRole("group", { name: "Mechanical failures" });
      await breakdowns.getByRole("button", { name: "Fewer", exact: true }).click();
      // Restore defaults takes the draft back, then Fewer again for the steps after.
      await dialog.getByRole("button", { name: "Restore defaults" }).click();
      await breakdowns
        .getByRole("button", { name: "Realistic", exact: true, pressed: true })
        .waitFor();
      await breakdowns.getByRole("button", { name: "Fewer", exact: true }).click();
    },
  },
  {
    name: "grid-editor",
    reach: async (page) => {
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
      await page.getByText("Mechanical failures: Fewer").first().waitFor();
      // The editor open, two drivers on different teams traded by hand, and the
      // drivers without a drive beside the grid.
      await button(page, "Edit grid").click();
      const drivers = page.locator("li li button[aria-pressed]");
      await drivers.nth(0).click();
      await drivers.nth(3).click();
      await page.getByRole("heading", { name: "Without a drive" }).waitFor();
      // One engine stepped up twice: every card running it says so.
      const stronger = page.getByRole("button", { name: /^Strengthen .* engine$/ }).first();
      await stronger.click();
      await stronger.click();
    },
  },
  {
    name: "grid-editor-team",
    reach: async (page) => {
      // A team's popover in the editor: a stepper on every chassis and engine
      // rating and on its development, stepped once.
      await page.locator('li button[aria-haspopup="dialog"]').first().click();
      const popover = page.getByRole("dialog");
      await popover
        .getByRole("button", { name: /engine racing$/ })
        .first()
        .waitFor();
      const faster = popover.getByRole("button", { name: /^Strengthen .* development$/ });
      await ((await faster.isEnabled())
        ? faster
        : popover.getByRole("button", { name: /^Weaken .* development$/ })
      ).click();
    },
  },
  {
    name: "grid-edited",
    reach: async (page) => {
      await page.keyboard.press("Escape");
      await button(page, "Apply grid").click();
      await page.getByText("This grid was edited").waitFor();
    },
  },
  {
    name: "grid-settings-locked",
    reach: async (page) => {
      const dialog = await openSettings(page);
      await dialog.getByText("Clear all edits to change them").waitFor();
      // Locked, the tabs still turn: Cars, with the Fewer set on the grid marked.
      await settingsTab(dialog, "Cars");
    },
  },
  {
    name: "clear-edits-dialog",
    reach: async (page) => {
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
      await button(page, "Clear all edits").click();
      await page.getByRole("alertdialog", { name: "Clear all grid edits?" }).waitFor();
    },
  },
  {
    name: "qualifying",
    reach: async (page) => {
      await page.getByRole("alertdialog").getByRole("button", { name: "Clear edits" }).click();
      await page.getByText("This grid was edited").waitFor({ state: "detached" });
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
    name: "round-menu",
    reach: async (page) => {
      // The round's crumb opens a menu of every round, the ones ahead greyed.
      await button(page, "Other rounds").click();
      await page.getByRole("menuitem", { name: /^1 · / }).waitFor();
    },
  },
  {
    name: "season-midseason",
    reach: async (page) => {
      await page.keyboard.press("Escape");
      // The year's crumb is its page, there from the grid on.
      await page
        .getByRole("navigation", { name: "Breadcrumb" })
        .first()
        .getByRole("link", { name: String(YEAR), exact: true })
        .click();
      await page.waitForURL(`**/run/${YEAR}`);
      await page.getByRole("heading", { name: `${YEAR} season` }).waitFor();
    },
  },
  {
    name: "season-calendar",
    reach: async (page) => {
      await page
        .getByRole("navigation", { name: "Season" })
        .getByRole("link", { name: "Calendar", exact: true })
        .click();
      await page.waitForURL(`**/run/${YEAR}?tab=calendar`);
      await page.getByText(/^\d+ of \d+ raced$/).waitFor();
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
      // Summary, calendar tab, season page, race, qualifying, then the grid.
      for (let i = 0; i < 5; i += 1) {
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
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await page.getByText("Resume run").waitFor();
    },
  },
  {
    name: "era-setup",
    reach: async (page) => {
      await navTo(page, "Era (basic)");
      await pickYear(page, `Start an era in ${YEAR}`);
      // What-ifs on every tab of the era's dialog, left open on Cars, so the
      // dots, a picker and the sub-options are drawn.
      const dialog = await openSettings(page);
      await dialog.getByRole("combobox", { name: "Points system" }).selectOption({ index: 1 });
      await settingsTab(dialog, "Drivers");
      await dialog
        .getByRole("group", { name: "Driver career events" })
        .getByRole("button", { name: "No", exact: true })
        .click();
      await settingsTab(dialog, "Over the years");
      for (const kept of ["Team name changes", "Livery changes", "Engine supplier changes"]) {
        await dialog
          .getByRole("group", { name: kept })
          .getByRole("button", { name: "No", exact: true })
          .click();
      }
      // The first season's teams, so the year jumped to below races ghost entries.
      await dialog
        .getByRole("group", { name: "Teams" })
        .getByRole("button", { name: "The first season's teams", exact: true })
        .click();
      await settingsTab(dialog, "Cars");
      await dialog
        .getByRole("group", { name: "Mechanical failures" })
        .getByRole("button", { name: "Fewer", exact: true })
        .click();
      await dialog.getByRole("combobox", { name: "Cars as reliable as" }).selectOption("1968");
      await dialog
        .getByRole("group", { name: "In-season development" })
        .getByRole("button", { name: "Random", exact: true })
        .click();
      // Both rolls at ±20, the chassis walking: the two sets of sub-rows, in order.
      for (const roll of ["Chassis performance", "Engine performance"]) {
        await dialog
          .getByRole("group", { name: roll })
          .getByRole("button", { name: "Random factor is added", exact: true })
          .click();
      }
      for (const spreads of await dialog.getByRole("group", { name: "Varies by up to" }).all()) {
        await spreads.getByRole("button", { name: "±20", exact: true }).click();
      }
      await button(page, "Last year's chassis").click();
    },
  },
  {
    name: "replace-dialog",
    reach: async (page) => {
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
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
    name: "era-back-to-setup",
    reach: async (page) => {
      // Nothing changed on the first grid, so it goes back to the setup page.
      await button(page, "Back to setup").click();
      await page.waitForURL("**/era/new");
    },
  },
  {
    name: "era-grid-team",
    reach: async (page) => {
      // Begun again from the same setup: the untouched run is replaced unasked.
      await button(page, `Begin an era from ${YEAR}`).click();
      await page.waitForURL(`**/run/${YEAR}/grid`);
      // A team's ratings on varied cars: history beside this run's, rating by
      // rating, for the chassis and for the engine.
      await page.locator('li button[aria-haspopup="dialog"]').first().click();
      await page.getByRole("dialog").getByText("Real → this run").nth(1).waitFor();
    },
  },
  {
    name: "era-overview-start",
    reach: async (page) => {
      await page.keyboard.press("Escape");
      // The overview is there from the era's first grid, the year under way.
      await page
        .getByRole("navigation", { name: "Breadcrumb" })
        .first()
        .getByRole("link", { name: "Era", exact: true })
        .click();
      await page.waitForURL("**/run");
      await page.getByText("No season finished yet", { exact: false }).waitFor();
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
    name: "era-kept-grid",
    reach: async (page) => {
      // The year after the start under the first season's teams: ghost entries
      // and the note saying what was kept.
      await page
        .getByRole("navigation", { name: "Season" })
        .getByRole("link", { name: "Grid", exact: true })
        .click();
      await page.waitForURL(`**/run/${YEAR + 1}?tab=grid`);
      await page.getByText(`Kept from ${YEAR}`).first().waitFor();
    },
  },
  {
    name: "year-menu",
    reach: async (page) => {
      // Two years reached now, so the year's crumb lists them.
      await button(page, "Other years").click();
      await page.getByRole("menuitem", { name: String(YEAR) }).waitFor();
    },
  },
  {
    name: "past-season",
    reach: async (page) => {
      // Clicked, not just opened: the menu's items are links that navigate.
      await page.getByRole("menuitem", { name: String(YEAR) }).click();
      await page.waitForURL(`**/run/${YEAR}`);
      await page
        .getByRole("link", { name: /Back to/ })
        .first()
        .waitFor();
    },
  },
  {
    name: "past-calendar",
    reach: async (page) => {
      await page
        .getByRole("navigation", { name: "Season" })
        .getByRole("link", { name: "Calendar", exact: true })
        .click();
      await page.waitForURL(`**/run/${YEAR}?tab=calendar`);
    },
  },
  {
    name: "past-race",
    reach: async (page) => {
      // A past season's race, straight from its calendar row.
      await page
        .getByRole("link", { name: / race page$/ })
        .first()
        .click();
      await page.waitForURL(`**/run/${YEAR}/round/1/race`);
    },
  },
  {
    name: "back-to-run",
    reach: async (page) => {
      // The way back to where the run is: the end of the year jumped to.
      await page
        .getByRole("link", { name: /Back to/ })
        .first()
        .click();
      await page.waitForURL(`**/run/${YEAR + 1}`);
      await cursorAt(page, `${YEAR + 1} · Season summary`);
    },
  },
  {
    name: "sections-menu",
    reach: async (page) => {
      // The root crumb lists the run's sections: the way to everyone in it.
      await button(page, "Run sections").click();
      await page.getByRole("menuitem", { name: "All drivers", exact: true }).waitFor();
    },
  },
  {
    name: "drivers-index",
    reach: async (page) => {
      await page.getByRole("menuitem", { name: "All drivers", exact: true }).click();
      await page.waitForURL("**/run/drivers");
      await page.getByRole("heading", { name: "Drivers", exact: true }).waitFor();
    },
  },
  {
    name: "drivers-by-wins",
    reach: async (page) => {
      // A column heading re-sorts the list, as a search param.
      await page.getByRole("columnheader").getByRole("link", { name: /^Wins/ }).click();
      await page.waitForURL("**/run/drivers?sort=wins");
    },
  },
  {
    name: "driver-page",
    reach: async (page) => {
      // The top of the list, by wins: a name on an index is a link to the page.
      await page.getByRole("cell").getByRole("link").first().click();
      await page.waitForURL("**/run/driver/*");
      await page.getByRole("heading", { name: "Season by season" }).waitFor();
    },
  },
  {
    name: "teams-index",
    reach: async (page) => {
      await button(page, "Run sections").click();
      await page.getByRole("menuitem", { name: "All teams", exact: true }).click();
      await page.waitForURL("**/run/teams");
      await page.getByRole("heading", { name: "Teams", exact: true }).waitFor();
    },
  },
  {
    name: "team-page",
    reach: async (page) => {
      await page.getByRole("cell").getByRole("link").first().click();
      await page.waitForURL("**/run/team/*");
      await page.getByRole("heading", { name: "Season by season" }).waitFor();
    },
  },
  {
    name: "career-panel",
    reach: async (page) => {
      // A name on the overview opens its panel, and the panel leads to the page.
      await page
        .getByRole("navigation", { name: "Breadcrumb" })
        .first()
        .getByRole("link", { name: "Era", exact: true })
        .click();
      await page.waitForURL("**/run");
      await page.locator('[aria-haspopup="dialog"]').first().click();
      await page.getByRole("link", { name: /'s page$/ }).waitFor();
    },
  },
  {
    name: "career-full-page",
    reach: async (page) => {
      await page.getByRole("link", { name: /'s page$/ }).click();
      await page.waitForURL(/\/run\/(driver|team)\//);
      await page.getByRole("heading", { name: "Season by season" }).waitFor();
    },
  },
  {
    name: "era-restart-dialog",
    reach: async (page) => {
      await runAction(page, "Restart era");
      await page.getByRole("alertdialog", { name: "Restart the era?" }).waitFor();
    },
  },
  {
    name: "era-restarted",
    reach: async (page) => {
      // The page the restart leaves names a year the new run has not reached;
      // it goes to the new grid rather than saying "Not reached yet".
      await page
        .getByRole("alertdialog", { name: "Restart the era?" })
        .getByRole("button", { name: "Restart era" })
        .click();
      await page.waitForURL(`**/run/${YEAR}/grid`);
      await cursorAt(page, `${YEAR} · Grid`);
    },
  },
  {
    name: "not-reached",
    reach: async (page) => {
      // A typed address ahead of the cursor: a reload, which the run survives.
      await page.goto(`/run/${YEAR + 1}/round/2/race`);
      await page.getByRole("heading", { name: "Not reached yet" }).waitFor();
    },
  },
  {
    name: "drivers-on-grid",
    reach: async (page) => {
      // The era back at its first grid: everyone listed, nothing scored yet.
      await page.goto("/run/drivers");
      await page.getByRole("heading", { name: "Drivers", exact: true }).waitFor();
    },
  },
  {
    name: "driver-midseason",
    reach: async (page) => {
      // Round 1 raced: a driver's year reads as a place so far.
      await runAction(page, "Continue");
      await cursorAt(page, new RegExp(`^${YEAR} · Round 1/\\d+ · Qualifying$`));
      await runAction(page, "Continue");
      await cursorAt(page, new RegExp(`^${YEAR} · Round 1/\\d+ · Race$`));
      await page.goto("/run/drivers");
      await page.getByRole("cell").getByRole("link").first().click();
      await page.waitForURL("**/run/driver/*");
      await page.getByText("after round 1").first().waitFor();
    },
  },
];
