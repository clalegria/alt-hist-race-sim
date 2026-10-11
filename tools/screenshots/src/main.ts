/**
 * Renders the app's main screens to PNGs, for Claude to read and look at.
 *
 * Every variant — viewport × theme — gets its own fresh browser context and
 * walks `STEPS`, capturing each screen full-page. Arguments narrow it: step
 * names capture only those (the walk still clicks through the steps before
 * them, and stops after the last), and `--desktop`, `--phone`, `--light` or
 * `--dark` only those variants.
 *
 * **Privacy is the hard rule here.** The browser is Playwright's own bundled
 * Chromium (never an installed Chrome: no `channel`), every context is a
 * throwaway one with no user-data dir, and any request for a host other than
 * localhost is aborted.
 *
 * **The same run every time.** The app draws a season's seed from
 * `Math.random()` and has no box to type one into, so the page's `Math.random`
 * is replaced with a seeded generator before any app code runs. The flow is the
 * same in every variant, so every variant shows the same seasons.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import { startDevServer } from "./server.js";
import { STEPS } from "./steps.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const WEB_DIR = join(ROOT, "apps/web");
const OUT_DIR = resolve(import.meta.dirname, "../out");

/** Seeds the page's `Math.random`, and so every season the app starts. */
const RANDOM_SEED = 1;

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
} as const;

/**
 * The app's own light/dark switch. It does not follow `prefers-color-scheme` —
 * the choice lives in localStorage (`apps/web/src/lib/theme.ts`) — so each
 * variant writes it there; the colour scheme is set to match for scrollbars.
 */
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function openContext(
  browser: Browser,
  device: (typeof VIEWPORTS)[keyof typeof VIEWPORTS],
  theme: Theme,
  baseUrl: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...device,
    baseURL: baseUrl,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) => {
    const { hostname } = new URL(route.request().url());
    if (LOCAL_HOSTS.has(hostname)) {
      return route.continue();
    }
    console.warn(`  blocked a request off localhost: ${route.request().url()}`);
    return route.abort();
  });
  await context.addInitScript(
    ({ theme, seed }) => {
      try {
        localStorage.setItem("alt-hist-theme", theme);
      } catch {
        // A context that refuses storage still renders, in the default theme.
      }
      // mulberry32: small, and plenty for picking seeds.
      let state = seed >>> 0;
      Math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    { theme, seed: RANDOM_SEED },
  );
  return context;
}

/** Fonts loaded and a frame painted, so the picture is of the finished screen. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  if ((await page.locator("vite-error-overlay").count()) > 0) {
    throw new Error("Vite is showing an error overlay.");
  }
}

/** What the command line asks for: which steps, viewports and themes. */
function selection(args: readonly string[]) {
  const flags = args.filter((arg) => arg.startsWith("--") && arg !== "--");
  const names = args.filter((arg) => !arg.startsWith("--"));
  const known = new Set(STEPS.map((step) => step.name));
  const unknown = [
    ...names.filter((name) => !known.has(name)),
    ...flags.filter((flag) => !["--desktop", "--phone", "--light", "--dark"].includes(flag)),
  ];
  if (unknown.length > 0) {
    throw new Error(`Unknown: ${unknown.join(", ")}. Steps: ${[...known].join(", ")}.`);
  }
  const pick = <T extends string>(all: readonly T[]) => {
    const asked = all.filter((each) => flags.includes(`--${each}`));
    return asked.length > 0 ? asked : all;
  };
  return {
    steps: names.length > 0 ? new Set(names) : known,
    devices: pick(Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]),
    themes: pick(THEMES),
  };
}

async function main(): Promise<void> {
  const wanted = selection(process.argv.slice(2));
  const last = STEPS.findLastIndex((step) => wanted.steps.has(step.name));
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await startDevServer(WEB_DIR);
  const written: string[] = [];
  const problems: string[] = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const deviceName of wanted.devices) {
      const device = VIEWPORTS[deviceName];
      for (const theme of wanted.themes) {
        const variant = `${deviceName}-${theme}`;
        console.log(`Capturing ${variant}…`);
        const context = await openContext(browser, device, theme, server.baseUrl);
        const page = await context.newPage();
        page.on("pageerror", (error) => {
          problems.push(`${variant}: page error: ${error.message}`);
        });
        page.on("console", (message) => {
          if (message.type() === "error") {
            problems.push(`${variant}: console error: ${message.text()}`);
          }
        });
        try {
          for (const [index, step] of STEPS.slice(0, last + 1).entries()) {
            await step.reach(page);
            if (!wanted.steps.has(step.name)) {
              continue;
            }
            await settle(page);
            const file = `${String(index + 1).padStart(2, "0")}-${step.name}-${variant}.png`;
            await page.screenshot({
              path: join(OUT_DIR, file),
              fullPage: true,
              animations: "disabled",
            });
            written.push(file);
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.stop();
  }

  console.log(`\n${written.length} screenshots in ${OUT_DIR}:`);
  for (const file of written) {
    console.log(`  ${file}`);
  }
  if (problems.length > 0) {
    console.warn(`\n${problems.length} problems in the page:`);
    for (const problem of problems) {
      console.warn(`  ${problem}`);
    }
    process.exitCode = 1;
  }
}

await main();
