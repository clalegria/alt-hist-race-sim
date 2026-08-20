/**
 * A rendering smoke test.
 *
 * `renderToStaticMarkup` needs no DOM, so this runs in plain Node and still
 * catches what actually breaks a data-heavy page: a component that throws, an id
 * rendered where a name should be, a table that came out empty. It is
 * deliberately not an interaction test — there is no jsdom here.
 *
 * One thing it cannot see: zustand serves `getInitialState()` as the
 * useSyncExternalStore *server* snapshot, so a static render always shows the
 * world the store was created with, whatever has been simulated since. That is
 * SSR-only — the browser uses the client snapshot and updates normally — so the
 * store's behaviour is asserted in `store/season.test.ts` instead of here.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

function render(): string {
  return renderToStaticMarkup(<App />);
}

describe("the season page", () => {
  it("renders without throwing", () => {
    expect(render().length).toBeGreaterThan(1000);
  });

  it("names every round of the calendar", () => {
    const html = render();
    expect(html).toContain("Argentine GP");
    expect(html).toContain("Buenos Aires");
    expect(html).toContain("United States GP");
    expect(html).toContain("Watkins Glen");
  });

  it("shows people and teams by name, never by id", () => {
    const html = render();
    expect(html).toContain("Alan Jones");
    expect(html).toContain("Williams");
    // The ids that would surface if a name lookup silently fell through.
    expect(html).not.toContain("jones");
    expect(html).not.toContain("alfa_romeo");
  });

  it("renders a row for every driver and every team", () => {
    const html = render();
    for (const name of ["Nelson Piquet", "David Kennedy", "Shadow", "Osella"]) {
      expect(html, `missing ${name}`).toContain(name);
    }
  });

  it("renders both championship tables", () => {
    const html = render();
    expect(html).toContain("Drivers&#x27; Championship");
    expect(html).toContain("Constructors&#x27; Championship");
  });
});
