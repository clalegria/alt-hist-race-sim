/**
 * The two ways a page's steps are drawn, rendered inside a router for the
 * `Link`: a live step is an anchor with its tooltip, a step ahead or absent is
 * never one.
 */

import { describe, expect, it } from "vitest";
import type { PageSteps } from "../lib/page-steps.js";
import { linkTo } from "../lib/run-places.js";
import { inRouter } from "../test-router.js";
import { YEAR } from "../test-support.js";
import { StepArrows, StepLinks } from "./PageSteps.js";

const live = linkTo({ year: YEAR, beat: { kind: "race", round: 1 } });
const steps: PageSteps = {
  previous: { title: "Previous race: Aaaa Prix", label: "Aaaa Prix", link: null },
  next: { title: "Next race: Bbbb Prix", label: "Bbbb Prix", link: live },
};
const anchors = (html: string) => html.match(/<a\b/g)?.length ?? 0;

describe("StepArrows", () => {
  it("draws a live step as a link with its tooltip, and a step ahead as no link", async () => {
    const html = await inRouter(<StepArrows steps={steps} />);
    expect(html).toContain('aria-label="Previous and next"');
    expect(anchors(html)).toBe(1);
    expect(html).toMatch(/<a [^>]*rel="next"/);
    expect(html).toContain('title="Next race: Bbbb Prix"');
    expect(html).toContain(`href="/run/${YEAR}/round/2/race"`);
    expect(html).toMatch(/<span [^>]*aria-disabled="true"/);
    expect(html).toContain('title="Previous race: Aaaa Prix"');
  });

  it("still draws both squares when a side is absent, with neither a link", async () => {
    const html = await inRouter(<StepArrows steps={{ previous: null, next: null }} />);
    expect(anchors(html)).toBe(0);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
  });

  it("links the previous side as rel prev", async () => {
    const html = await inRouter(
      <StepArrows
        steps={{ previous: { title: "Previous race: X", label: "X", link: live }, next: null }}
      />,
    );
    expect(html).toMatch(/<a [^>]*rel="prev"/);
  });
});

describe("StepLinks", () => {
  it("names each side, with not yet on a place ahead and no anchor for it", async () => {
    const html = await inRouter(<StepLinks steps={steps} />);
    expect(anchors(html)).toBe(1);
    expect(html).toContain("Aaaa Prix (not reached yet)");
    expect(html).toMatch(/<a [^>]*rel="next"[^>]*>Bbbb Prix/);
  });

  it("draws nothing when there is nowhere to go", async () => {
    const html = await inRouter(<StepLinks steps={{ previous: null, next: null }} />);
    expect(html).not.toContain("Previous and next");
  });
});
