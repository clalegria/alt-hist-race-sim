---
name: persona-panel
description: Convene the panel of ten invented first-time visitors (personas.md) to walk the app as it is now and say what they click, what confuses them and what wins them over, then re-rank the recommendations in docs/design/newcomer-feedback.md. Use this whenever the author asks for persona, visitor, newcomer or user-testing feedback, "what would the panel think", "ask the people again", how a new or changed screen lands with fans, or whether the app is ready for the public, even if they don't name the panel.
---

# The persona panel

Ten invented visitors walk the real app and react to it. The aim is honest first-time-visitor
feedback that can be compared run to run as the app grows. The cast lives in
`personas.md`; the ranked changes they point to live in `docs/design/newcomer-feedback.md`.

## Rules
- **Ground every reaction in what the app shows.** A persona clicks only what exists and
  quotes only what is on screen (the walk's output, the screenshot-checker report, or the
  code). If something is inferred and not seen, say so.
- **The cast is fixed.** Don't rewrite a persona to suit a finding. Add, drop or change one
  only when the author asks.
- **Balanced, not polite.** Each persona says what wins them over as well as what loses
  them. Not everyone has to dislike the same thing.
- **Ratings are opinions here.** A persona may argue with a rating ("68 is too low"). Never
  turn that into a proposal to change a number (`CLAUDE.md`: never change a number unless
  asked).
- **These are invented people.** Say so in the report, and never present it as real user
  research.

## Steps
1. **Read** `personas.md` and `docs/design/newcomer-feedback.md`, and ask what changed since
   the last run (or read `git log` since the verdict date) so the panel looks there.
2. **Walk** with `node .claude/skills/persona-panel/scripts/walk.mjs <journeys> [--phone |
   --tablet] [--aria]`. Journeys: `home`, `season`, `whatif`, `era`. Run each device once,
   not once per persona: phone for 1, 4, 8 and 9; tablet for 7; desktop for 2, 3, 5 and 6;
   desktop `--aria` for 10. Redirect the output to a scratchpad file and read the screens
   you need. If a change isn't covered, add a journey; if a locator broke, fix the step.
3. **Look** through `screenshot-checker` (`AGENTS.md`: the main agent never reads the
   PNGs). Brief it with the step names (`pnpm screenshots <unknown>` lists them), phone and
   desktop, dark, and ask for a first-time visitor's view of each screen: where the eye
   lands, what looks clickable, what's cramped, cryptic or developer-ish, and whether it
   reads as motor racing. Full-page shots float the sticky bars over rows; check on a real
   phone before calling that a bug.
4. **Report**, in the terminal:
   - for each persona: their device, what they clicked in order, what they found, a quote;
   - what came up more than once, and which personas raised it;
   - what changed since each persona's last verdict;
   - which recommendations are now done, which are new, and the new order.
5. **Update** each persona's **Last verdict** line, dated (replace it, don't append). Update
   `newcomer-feedback.md` by its own rules: delete what's built, add new items as PROPOSED
   or OPEN, re-rank. Don't commit unless asked.
