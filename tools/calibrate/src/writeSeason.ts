/**
 * Writes fitted ratings back into a season file.
 *
 * Substitutes digits in place rather than re-serialising the JSON, because the
 * season files are hand-aligned into columns and `JSON.stringify` would reflow
 * all 77 of them into a different shape the first time one was fitted. Only the
 * six numbers this tool owns are touched: chassis racing, qualifying and
 * reliability, and engine reliability. Everything else — consistency, the
 * calendar, the points scale, the retirement factor, driver line-ups — is left
 * byte for byte as authored.
 *
 * It refuses rather than guesses if the file does not look the way it expects.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEASONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages",
  "data",
  "src",
  "seasons",
);

interface SeasonLike {
  readonly engines: readonly { readonly engineId: string; readonly reliability: number }[];
  readonly entries: readonly {
    readonly teamId: string;
    readonly chassis: {
      readonly racing: number;
      readonly qualifying: number;
      readonly reliability: number;
    };
  }[];
}

export function writeSeasonRatings(year: number, fitted: SeasonLike): void {
  const file = path.join(SEASONS_DIR, `${year}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No season file at ${file}`);
  }
  let text = fs.readFileSync(file, "utf-8");

  for (const engine of fitted.engines) {
    const pattern = new RegExp(`("engineId": "${engine.engineId}",[^}]*?"reliability":\\s*)\\d+`);
    if (!pattern.test(text)) {
      throw new Error(`Could not find engine "${engine.engineId}" in ${year}.json`);
    }
    text = text.replace(pattern, `$1${engine.reliability}`);
  }

  for (const entry of fitted.entries) {
    const pattern = new RegExp(
      `("teamId": "${entry.teamId}",[^}]*?"chassis": \\{ "racing":\\s*)\\d+` +
        `(, "qualifying":\\s*)\\d+` +
        `(, "consistency":\\s*\\d+, "reliability":\\s*)\\d+`,
    );
    if (!pattern.test(text)) {
      throw new Error(`Could not find entry "${entry.teamId}" in ${year}.json`);
    }
    text = text.replace(
      pattern,
      `$1${entry.chassis.racing}$2${entry.chassis.qualifying}$3${entry.chassis.reliability}`,
    );
  }

  // Parse what we are about to write, so a bad substitution fails here rather
  // than at the next `pnpm test`.
  JSON.parse(text);
  fs.writeFileSync(file, text, "utf-8");
}
