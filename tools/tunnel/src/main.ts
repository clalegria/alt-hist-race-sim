/**
 * Puts the dev server on a public https address, so the app can be opened from
 * any device: a Cloudflare quick tunnel, which needs no account.
 *
 * The dev server is this checkout's own (`startDevServer`, shared with the
 * screenshots), so the tunnel shows exactly what is on disk here, committed or not. `cloudflared` connects
 * outward to Cloudflare and prints a random `*.trycloudflare.com` address that
 * forwards to it. Anyone holding that address can open the app until this stops.
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { startDevServer } from "@alt-hist/screenshots/server";

const ROOT = resolve(import.meta.dirname, "../../..");
const WEB_DIR = join(ROOT, "apps/web");

/** How long Cloudflare may take to hand out an address before giving up. */
const START_TIMEOUT_MS = 60_000;

/** A quick tunnel's address: hyphenated words under trycloudflare.com. */
const TUNNEL_URL = /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/;

/** Where `cloudflared` lands when it isn't on PATH: the no-admin install, then winget's. */
const INSTALL_LOCATIONS = [
  join(process.env.LOCALAPPDATA ?? "", "Programs", "cloudflared", "cloudflared.exe"),
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
];

function findCloudflared(): string | undefined {
  if (spawnSync("cloudflared", ["--version"]).status === 0) {
    return "cloudflared";
  }
  return INSTALL_LOCATIONS.find((path) => existsSync(path));
}

async function main(): Promise<void> {
  const cloudflared = findCloudflared();
  if (cloudflared === undefined) {
    console.error(
      "cloudflared is not installed: `winget install Cloudflare.cloudflared`, or put " +
        `cloudflared-windows-amd64.exe from its GitHub releases at ${INSTALL_LOCATIONS[0]}.`,
    );
    process.exitCode = 1;
    return;
  }

  const server = await startDevServer(WEB_DIR);
  const tunnel: ChildProcess = spawn(
    cloudflared,
    ["tunnel", "--no-autoupdate", "--url", server.baseUrl],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(tunnel, "exit");

  let log = "";
  let url: string | undefined;
  const onOutput = (chunk: Buffer): void => {
    log += chunk.toString();
    if (url === undefined) {
      url = TUNNEL_URL.exec(log)?.[0];
      if (url !== undefined) {
        console.log(`\nThe app is at ${url}\n(open to anyone with the link; Ctrl+C to stop)\n`);
      }
    }
  };
  tunnel.stdout?.on("data", onOutput);
  tunnel.stderr?.on("data", onOutput);

  const stopTunnel = (): void => {
    tunnel.kill();
  };
  process.on("SIGINT", stopTunnel);
  process.on("SIGTERM", stopTunnel);
  const timeout = setTimeout(() => {
    if (url === undefined) {
      stopTunnel();
    }
  }, START_TIMEOUT_MS);

  await exited;
  clearTimeout(timeout);
  if (url === undefined) {
    console.error(`cloudflared gave no address:\n${log}`);
    process.exitCode = 1;
  }
  await server.stop();
}

await main();
