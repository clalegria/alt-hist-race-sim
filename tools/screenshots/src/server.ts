/**
 * A Vite dev server of this checkout's own, on a free port, for a tool to run
 * against and stop again afterwards. Never one found running: that may be
 * serving another worktree's files, so the tool would show the wrong code.
 *
 * Vite is started directly with `node`, not through `pnpm dev`: on Windows
 * killing a `pnpm` process leaves the server it spawned running, and a single
 * child process is one that `kill()` actually stops.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

/** How long a cold Vite start may take before giving up. */
const START_TIMEOUT_MS = 60_000;

/** The app's `<title>`, so a page from something else is not mistaken for this one. */
const APP_TITLE = "<title>alt-hist-race-sim</title>";

export interface DevServer {
  /** `http://localhost:<port>`, the server's own address. */
  readonly baseUrl: string;
  readonly port: number;
  stop(): Promise<void>;
}

/** A port nothing is listening on: the OS picks one for a moment's listener. */
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "localhost");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  if (address === null || typeof address === "string") {
    throw new Error("Could not find a free port.");
  }
  return address.port;
}

async function servesApp(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
    return (await response.text()).includes(APP_TITLE);
  } catch {
    return false;
  }
}

/** Starts the app's dev server from `webDir` and waits until it answers. */
export async function startDevServer(webDir: string): Promise<DevServer> {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const require = createRequire(join(webDir, "package.json"));
  const vite = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  console.log(`Starting the dev server on ${baseUrl}…`);
  const child: ChildProcess = spawn(
    process.execPath,
    [vite, "--port", String(port), "--strictPort"],
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
  while (!(await servesApp(baseUrl))) {
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
  return { baseUrl, port, stop };
}
