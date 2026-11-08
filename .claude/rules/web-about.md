---
paths:
  - "apps/web/src/components/AboutProject.tsx"
  - "apps/web/src/lib/whats-new.ts"
  - "apps/web/src/lib/whats-new.json"
  - "apps/web/src/lib/about-tabs.ts"
  - "apps/web/src/routes/about.tsx"
  - "apps/web/src/components/bug-report.ts"
---

# About and What's new

The About page's tabs: its words, the release log (What's new), the known issues, and the
bug report (the footer's *Submit a bug report* opens it).

- **The About words are the author's**: change them only when asked, and never state a
  fact about the author they haven't given.
- **Keep the Jolpica credit with its licence** (CC BY-NC-SA requires it) and the
  unofficial disclaimer, whatever else is rewritten.
- **The known issues are `KNOWN_ISSUES` in `AboutProject.tsx`**, the author's to rewrite:
  each a plain line for the player, said once.
- **The bug report is the author's Google Form** (`components/bug-report.ts`): the tab
  links it with the run pre-filled. A question's `entry.` id changes only if the author
  rebuilds it; take it from the form's *Get pre-filled link*.
- **The author's age is counted, never written**: `yearsOld` from their birthday, on the
  reader's day.
- **What's new is `lib/whats-new.json`**: one entry per release day, newest first, a
  `date` (`YYYY-MM-DD`) and `items`, plain-text lines with no links. A release's entry is
  committed with the work it describes; a second release that day adds lines to its entry.
- **The file is checked, not trusted**: `parseReleases` refuses a bad entry at load and
  `whats-new.test.ts` loads the real file, so a typo fails the tests, not the page.
- **An item is written for the player** (`ui-copy.md`): what they will see, not what the
  code did.
