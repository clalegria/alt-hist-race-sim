/**
 * The one segmented control and the tabs drawn like it. Rendered without a DOM;
 * the tabs that link are covered inside a router by the season and session
 * page tests.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabLinks } from "./TabLinks.js";
import { Segmented, type SegmentItem } from "./ui/segmented.js";

const noop = () => {};

const ITEMS: readonly SegmentItem[] = [
  { key: "a", label: "First", selected: true, onPick: noop },
  { key: "b", label: "Second", selected: false, onPick: noop },
  { key: "c", label: "Third", selected: false, disabled: true, onPick: noop },
];

/** Every `<button>`'s opening tag and text, in order. */
function buttons(html: string): string[] {
  return html.split("<button").slice(1);
}

describe("a segmented control", () => {
  const html = renderToStaticMarkup(<Segmented label="Pick one" items={ITEMS} />);

  it("is one named group", () => {
    expect(html.startsWith("<fieldset")).toBe(true);
    expect(html).toContain('aria-label="Pick one"');
  });

  it("presses the selected segment alone, with its label as the button's text", () => {
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>First</);
  });

  it("disables only the segment marked disabled", () => {
    const disabled = buttons(html).map((button) =>
      button.slice(0, button.indexOf(">")).includes('disabled=""'),
    );
    expect(disabled).toEqual(ITEMS.map((item) => item.disabled === true));
  });

  it("names a segment by its own label when one is given", () => {
    const named = renderToStaticMarkup(
      <Segmented
        label="Year"
        items={[
          { key: "y", label: "1984", ariaLabel: "Begin in 1984", selected: false, onPick: noop },
        ]}
      />,
    );
    expect(named).toContain('aria-label="Begin in 1984"');
  });
});

describe("tab links", () => {
  const html = renderToStaticMarkup(
    <TabLinks
      label="Session"
      tabs={[
        { key: "q", label: "Qualifying", current: true, link: null },
        { key: "r", label: "Race", current: false, link: null },
      ]}
    />,
  );

  it("draws the tab on screen as the current page, not a link", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<span aria-current="page"[^>]*>Qualifying</);
  });

  it("draws a place not reached as disabled words, never an <a>", () => {
    expect(html).toMatch(/<span aria-disabled="true"[^>]*>Race</);
    expect(html).not.toContain("<a");
  });
});
