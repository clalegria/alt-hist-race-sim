/**
 * A share card as a PNG, made on tap rather than when the dialog opens: the
 * drawing takes a moment and most cards shown are never saved.
 *
 * **Drawn from the dialog's own card.** Its preview is scaled by a transform on
 * the box around it, which leaves the card's own layout at full size; html-to-image
 * clones the card with its computed styles into an SVG and paints that on a
 * canvas, so the PNG comes out at 1:1 whatever the preview's scale.
 *
 * **The fonts are embedded from the app's own `@fontsource` CSS.** The SVG is
 * drawn as an image, which may fetch nothing, so a face not inlined as a data
 * URL falls back to a system font. The same CSS the app loads is read here as a
 * string (`?inline`), so the faces, their weights, widths and unicode ranges
 * stay the app's; only the woff2 source of each is kept, and fetched once.
 *
 * **WebKit draws twice.** Safari, and every browser on iOS, can leave out
 * fonts and images on the first draw of an SVG image; the second is complete.
 */

import plexMono400 from "@fontsource/ibm-plex-mono/latin-400.css?inline";
import plexMono500 from "@fontsource/ibm-plex-mono/latin-500.css?inline";
import archivo from "@fontsource-variable/archivo/standard.css?inline";
import { toBlob } from "html-to-image";

/** The app's faces, as `main.tsx` imports them. */
const FONT_CSS = [archivo, plexMono400, plexMono500].join("\n");

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
const SRC = /src\s*:[^;}]*/;
const SOURCE = /url\(\s*['"]?([^'")]+)['"]?\s*\)\s*format\(\s*['"]?([^'")]+)['"]?\s*\)/g;

/**
 * `css`'s `@font-face` rules, each with its woff2 source alone, read through
 * `dataUrlOf`; a rule with no woff2 source is dropped. Every other descriptor
 * is kept as written.
 */
export async function embedFontFaces(
  css: string,
  dataUrlOf: (url: string) => Promise<string>,
): Promise<string> {
  const faces = await Promise.all(
    (css.match(FONT_FACE) ?? []).map(async (face) => {
      const src = face.match(SRC)?.[0] ?? "";
      const woff2 = [...src.matchAll(SOURCE)].find(([, , format]) => format?.startsWith("woff2"));
      if (woff2 === undefined) {
        return null;
      }
      const [, url = "", format] = woff2;
      return face.replace(SRC, `src: url(${await dataUrlOf(url)}) format('${format}')`);
    }),
  );
  return faces.filter((face) => face !== null).join("\n");
}

/** A WebKit browser: Safari, or anything on iOS, but not Chrome or Edge on a desktop. */
export function rendersTwice(userAgent: string): boolean {
  return /AppleWebKit/.test(userAgent) && !/Chrome|Chromium/.test(userAgent);
}

async function dataUrlOf(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load the font ${url}: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let fontCSS: Promise<string> | undefined;

/** The app's faces as data URLs, fetched on the first card and kept; tried again after a failure. */
function cardFontCSS(): Promise<string> {
  fontCSS ??= embedFontFaces(FONT_CSS, dataUrlOf).catch((error: unknown) => {
    fontCSS = undefined;
    throw error;
  });
  return fontCSS;
}

/** `card`, a `ShareCardFrame` on the page, as a PNG at its own size. */
export async function cardPng(card: HTMLElement): Promise<Blob> {
  const options = {
    width: card.offsetWidth,
    height: card.offsetHeight,
    pixelRatio: 1,
    fontEmbedCSS: await cardFontCSS(),
  };
  if (rendersTwice(navigator.userAgent)) {
    await toBlob(card, options);
  }
  const png = await toBlob(card, options);
  if (png === null) {
    throw new Error("The card could not be drawn");
  }
  return png;
}

/**
 * Whether `nav` would send `count` PNGs through the Web Share API: a phone's
 * share sheet, or the desktop's where there is one. Asked with empty files,
 * since `canShare` reads only their number and types.
 */
export function canShareFiles(
  nav: Pick<Navigator, "canShare"> | undefined,
  count: number,
): boolean {
  if (typeof nav?.canShare !== "function") {
    return false;
  }
  const files = Array.from(
    { length: count },
    (_, index) => new File([], `card-${index}.png`, { type: "image/png" }),
  );
  return nav.canShare({ files });
}

/** How long a saved file's object URL outlives the tap: Safari reads it after the click returns. */
const SAVED_URL_LIFETIME_MS = 60_000;

/** `file` downloaded under its own name, as a link with `download` is. */
export function saveFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), SAVED_URL_LIFETIME_MS);
}

/** Whether `error` is the player closing the share sheet, which is no failure. */
export function sharingCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
