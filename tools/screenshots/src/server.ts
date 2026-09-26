/**
 * The Vite dev server the screenshots are taken against: reused if one is
 * already running, otherwise started here and stopped again afterwards.
 *
 * Vite is started directly with `node`, not through `pnpm dev`: on Windows
 * killing a `pnpm` process leaves the server it spawned running, and a single
 * child process is one that `kill()` actually stops.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const PORT = 5173;
export const BASE_URL = `http://localhost:${PORT}`;

/** How long a cold Vite start may take before giving up. */
const START_TIMEOUT_MS = 60_000;

/** The app's `<title>`, so a different project on the same port is not mistaken for this one. */
const APP_TITLE = "<title>alt-hist-race-sim</title>";

async function probe(): Promise<"ours" | "other" | "down"> {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1_000) });
    return (await response.text()).includes(APP_TITLE) ? "ours" : "other";
  } catch {
    return "down";
  }
}

/** Makes sure the app is being served, and returns how to undo whatever that took. */
export async function ensureDevServer(webDir: string): Promise<() => Promise<void>> {
  const found = await probe();
  if (found === "ours") {
    console.log(`Reusing the dev server already on ${BASE_URL}.`);
    return async () => {};
  }
  if (found === "other") {
    throw new Error(`Something other than this app is serving ${BASE_URL}.`);
  }

  const require = createRequire(join(webDir, "package.json"));
  const vite = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  console.log(`Starting the dev server on ${BASE_URL}…`);
  const child: ChildProcess = spawn(
    process.execPath,
    [vite, "--port", String(PORT), "--strictPort"],
    { cwd: webDir, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  const stop = async (): Promise<void> => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  };

  const deadline = Date.now() + START_TIMEOUT_MS;
  while ((await probe()) !== "ours") {
    if (child.exitCode !== null) {
      throw new Error(`The dev server exited during start-up:\n${output}`);
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(
        `The dev server did not answer within ${START_TIMEOUT_MS / 1000}s:\n${output}`,
      );
    }
    await sleep(250);
  }
  return stop;
}
