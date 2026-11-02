/**
 * Walks the app the way a first-time visitor would and prints what each screen
 * says: its visible text, what can be clicked, and with `--aria` the
 * accessibility tree a screen reader reads. Text only, for the panel to react
 * to; how the screens look comes from `screenshot-checker`.
 *
 *   node .claude/skills/persona-panel/scripts/walk.mjs <journey…> [--phone|--tablet] [--aria]
 *
 * The journeys are probes, not tests: when the app changes and a step's
 * locator no longer matches, fix the step to follow the new screen.
 *
 * Same privacy rules as `tools/screenshots`: its own dev server (never one
 * already running), Playwright's bundled Chromium, a throwaway context, and
 * every request for a host other than localhost aborted.
 */

import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { startDevServer } from "../../../../tools/screenshots/src/server.ts";

const ROOT = resolve(import.meta.dirname, "../../../..");
const require = createRequire(join(ROOT, "tools/screenshots/package.json"));
const { chromium } = require("playwright");

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
};

/** A run bar action: a button on a wide screen, an item behind ⋯ on a narrow one. */
async function act(page, name) {
  const direct = page.getByRole("button", { name, exact: true }).first();
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await page.getByRole("button", { name: "More run actions" }).first().click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function startSeason(page, decade, year) {
  await page.goto("/");
  await page.getByRole("button", { name: /simulate a season/i }).click();
  await page.getByRole("button", { name: `The ${decade}s`, exact: true }).click();
  await page.getByRole("button", { name: `The ${year} season`, exact: true }).click();
}

const JOURNEYS = {
  /** The landing page, the nav menu and the About page. */
  home: async (page, dump) => {
    await page.goto("/");
    await dump("home");
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await dump("nav menu");
      await page.keyboard.press("Escape");
    }
    await page.getByRole("link", { name: "About this project", exact: true }).click();
    await dump("about");
  },
  /** A recent season on default settings, from setup to the champion. */
  season: async (page, dump) => {
    await page.goto("/");
    await page.getByRole("button", { name: /simulate a season/i }).click();
    await dump("season setup");
    await startSeason(page, 2020, 2021);
    await page.getByRole("button", { name: /^start the 2021/i }).click();
    await dump("grid");
    await page
      .getByRole("button", { name: /^continue/i })
      .first()
      .click();
    await dump("qualifying");
    await page
      .getByRole("button", { name: /^continue/i })
      .first()
      .click();
    await dump("race");
    await act(page, "Simulate rest of season");
    await dump("end of season");
  },
  /** A scenario, its settings, a driver's card. */
  whatif: async (page, dump) => {
    await startSeason(page, 1980, 1988);
    await page.getByRole("button", { name: /fastest drivers in slowest/i }).click();
    await page
      .getByRole("button", { name: /^settings$/i })
      .first()
      .click();
    await dump("settings");
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await page.getByRole("button", { name: /^start the 1988/i }).click();
    await dump("scenario grid");
    await page.getByRole("button", { name: /senna/i }).first().click();
    await dump("driver card");
  },
  /** An era from 1994, run on a few seasons. */
  era: async (page, dump) => {
    await page.goto("/");
    await page.getByRole("button", { name: /simulate an era/i }).click();
    await page.getByRole("button", { name: "The 1990s", exact: true }).click();
    await page.getByRole("button", { name: "Start from 1994", exact: true }).click();
    await dump("era setup");
    await page.getByRole("button", { name: /^start an era/i }).click();
    await dump("era grid");
    await act(page, "Simulate whole season");
    await dump("era, end of the first season");
  },
};

const args = process.argv.slice(2);
const names = args.filter((arg) => !arg.startsWith("--"));
const unknown = names.filter((name) => !(name in JOURNEYS));
if (names.length === 0 || unknown.length > 0) {
  console.error(`Journeys: ${Object.keys(JOURNEYS).join(", ")}`);
  process.exit(1);
}
const device = args.includes("--phone")
  ? "phone"
  : args.includes("--tablet")
    ? "tablet"
    : "desktop";
const aria = args.includes("--aria");

const server = await startDevServer(join(ROOT, "apps/web"));
const browser = await chromium.launch();
const errors = [];
try {
  for (const name of names) {
    const context = await browser.newContext({ ...DEVICES[device], baseURL: server.baseUrl });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    const dump = async (label) => {
      await page.waitForTimeout(600);
      const text = await page.evaluate(() => document.body.innerText);
      const clicks = await page.evaluate(() =>
        [...document.querySelectorAll("a, button, [role=tab], select, input")]
          .filter((element) => element.offsetParent !== null)
          .map((element) => {
            const label = element.getAttribute("aria-label");
            const shown = (element.innerText || element.value || "").replace(/\s+/g, " ").trim();
            return `${element.tagName.toLowerCase()}${label ? `[${label}]` : ""}: ${shown.slice(0, 60)}`;
          }),
      );
      console.log(`\n===== ${name} · ${label} · ${device} (${new URL(page.url()).pathname}) =====`);
      console.log(text.replace(/\n{3,}/g, "\n\n").slice(0, 6000));
      console.log(`--- clickable ---\n${[...new Set(clicks)].join("\n")}`);
      if (aria) {
        console.log(`--- accessibility tree ---\n${await page.locator("body").ariaSnapshot()}`);
      }
    };
    await JOURNEYS[name](page, dump);
    await context.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
if (errors.length > 0) {
  console.log(`\nPAGE ERRORS:\n${errors.join("\n")}`);
}
