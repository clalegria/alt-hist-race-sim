import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aboutSearch, aboutTabLinks } from "../lib/about-tabs.js";
import { renderRoute } from "../test-router.js";
import { AboutProject } from "./AboutProject.js";

const RELEASES = [
  { date: "2026-12-03", items: ["The newer change."] },
  { date: "2026-11-01", items: ["The older change.", "Another."] },
];

describe("the About page", () => {
  it("opens on About at /about, inside the frame", async () => {
    const { html } = await renderRoute("/about");
    expect(html).toContain("Who I am");
    expect(html).toMatch(/<nav aria-label="About"/);
    expect(html).toMatch(/aria-current="page"[^>]*>About</);
  });

  it("opens What's new from its address", async () => {
    const { html } = await renderRoute("/about?tab=whats-new");
    expect(html).not.toContain("Who I am");
    expect(html).toMatch(/aria-current="page"[^>]*>What&#x27;s new</);
  });

  it("credits the data it is checked against, with its licence, and links the code", () => {
    const html = renderToStaticMarkup(<AboutProject tab="about" releases={[]} />);
    expect(html).toContain('href="https://jolpi.ca"');
    expect(html).toContain("CC BY-NC-SA 4.0");
    expect(html).toContain('href="https://github.com/clalegria/alt-hist-race-sim"');
  });

  it("lists each release under its day, newest first", () => {
    const html = renderToStaticMarkup(<AboutProject tab="whats-new" releases={RELEASES} />);
    expect(html).toContain('<time dateTime="2026-12-03">3 December 2026</time>');
    expect(html.indexOf("The newer change.")).toBeLessThan(html.indexOf("The older change."));
    expect(html.match(/<li/g)).toHaveLength(3);
  });

  it("says so while there is nothing to list", () => {
    const html = renderToStaticMarkup(<AboutProject tab="whats-new" releases={[]} />);
    expect(html).toContain("Nothing yet");
    expect(html).not.toContain("<ul");
  });
});

describe("the About page's tabs", () => {
  it("are read from the address, and anything else reads as no tab", () => {
    expect(aboutSearch({ tab: "whats-new" })).toEqual({ tab: "whats-new" });
    expect(aboutSearch({ tab: "changelog" })).toEqual({});
    expect(aboutSearch({})).toEqual({});
  });

  it("each name their own tab, so a link to About is not a link to the last one left on", () => {
    const tabs = aboutTabLinks("whats-new");
    expect(tabs.map((tab) => tab.link.search)).toEqual([{ tab: "about" }, { tab: "whats-new" }]);
    expect(tabs.filter((tab) => tab.current).map((tab) => tab.key)).toEqual(["whats-new"]);
  });
});
