import { describe, expect, it } from "vitest";
import { canShareFiles, embedFontFaces, rendersTwice, sharingCancelled } from "./share-png.js";

const CSS = `
/* a variable face */
@font-face {
  font-family: 'Sans Variable';
  font-style: normal;
  font-weight: 100 900;
  font-stretch: 62% 125%;
  src: url(./files/sans-latin.woff2) format('woff2-variations');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Mono';
  font-weight: 500;
  src: url("/assets/mono-500.woff2") format("woff2"), url(/assets/mono-500.woff) format('woff');
}
@font-face {
  font-family: 'Old';
  src: url(/assets/old.ttf) format('truetype');
}
@font-face{font-family:Built;font-weight:400;src:url(/assets/built-1a2b.woff2)format("woff2"),url(/assets/built-1a2b.woff)format("woff")}
`;

const asData = async (url: string) => `data:font/woff2;base64,${btoa(url)}`;

describe("embedFontFaces", () => {
  it("keeps each face's woff2 source alone, as a data URL", async () => {
    const css = await embedFontFaces(CSS, asData);
    expect(css).toContain(
      `url(${await asData("./files/sans-latin.woff2")}) format('woff2-variations')`,
    );
    expect(css).toContain(`url(${await asData("/assets/mono-500.woff2")}) format('woff2')`);
    expect(css).not.toContain(".woff)");
    expect(css).not.toMatch(/url\((?!data:)/);
  });

  it("keeps every other descriptor as written", async () => {
    const css = await embedFontFaces(CSS, asData);
    for (const descriptor of [
      "font-family: 'Sans Variable';",
      "font-weight: 100 900;",
      "font-stretch: 62% 125%;",
      "unicode-range: U+0000-00FF;",
      "font-family: 'Mono';",
      "font-weight: 500;",
    ]) {
      expect(css).toContain(descriptor);
    }
  });

  it("drops a face with no woff2 source, and reads each source once", async () => {
    const read: string[] = [];
    const css = await embedFontFaces(CSS, async (url) => {
      read.push(url);
      return asData(url);
    });
    expect(css).not.toContain("'Old'");
    expect(read).toEqual([
      "./files/sans-latin.woff2",
      "/assets/mono-500.woff2",
      "/assets/built-1a2b.woff2",
    ]);
    expect(css.match(/@font-face/g)).toHaveLength(read.length);
  });

  it("makes nothing of CSS without faces", async () => {
    expect(await embedFontFaces("body { color: red; }", asData)).toBe("");
  });
});

describe("rendersTwice", () => {
  it("is WebKit's: Safari and every browser on iOS", () => {
    for (const userAgent of [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
    ]) {
      expect(rendersTwice(userAgent)).toBe(true);
    }
  });

  it("is not Chrome's, Edge's or Firefox's elsewhere", () => {
    for (const userAgent of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    ]) {
      expect(rendersTwice(userAgent)).toBe(false);
    }
  });
});

describe("canShareFiles", () => {
  it("says no where the browser has no canShare", () => {
    expect(canShareFiles(undefined, 1)).toBe(false);
    expect(canShareFiles({} as Pick<Navigator, "canShare">, 1)).toBe(false);
  });

  it("asks canShare about that many PNGs and gives its answer", () => {
    for (const count of [1, 2]) {
      for (const answer of [true, false]) {
        const asked: File[][] = [];
        const nav = {
          canShare: (data?: ShareData) => {
            asked.push(data?.files ?? []);
            return answer;
          },
        };
        expect(canShareFiles(nav, count)).toBe(answer);
        expect(asked).toHaveLength(1);
        expect(asked[0]?.map((file) => file.type)).toEqual(Array(count).fill("image/png"));
      }
    }
  });
});

describe("sharingCancelled", () => {
  it("is the share sheet closed, and nothing else", () => {
    expect(sharingCancelled(new DOMException("closed", "AbortError"))).toBe(true);
    expect(sharingCancelled(new DOMException("too late", "NotAllowedError"))).toBe(false);
    expect(sharingCancelled(new Error("AbortError"))).toBe(false);
  });
});
