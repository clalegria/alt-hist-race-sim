import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReserveSheet } from "./GridStage.js";

// The editor's open state is hook state, so a static render cannot reach it;
// the phone's bar is tested on its own. The sheet is a portal, closed here.
describe("ReserveSheet", () => {
  it("shows the pool's size on a bar that opens the sheet", () => {
    const html = renderToStaticMarkup(
      <ReserveSheet count={7}>{() => <p>the pool</p>}</ReserveSheet>,
    );
    expect(html).toContain("Without a drive (7)");
    expect(html).toContain("<button");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("lg:hidden");
  });

  it("keeps the pool out of the page until the sheet is opened", () => {
    const html = renderToStaticMarkup(
      <ReserveSheet count={3}>{() => <p>the pool</p>}</ReserveSheet>,
    );
    expect(html).not.toContain("the pool");
  });
});
