# Publish it

Everything before the app goes public: phone layout, the share image, then one release of
five parts. The roadmap holds the order; this holds the design.

## Phone layout

- DECIDED: detect by **viewport width via CSS media queries**, not user-agent sniffing.
  Narrow desktop windows and tablets come free.
- DECIDED: per screen, pick one of three moves: **drop columns** that are context, not
  content (gaps, grid position, engine), with the full row on tap; **restack the row** into
  a card; or **scroll the table horizontally** in its own container (a classification,
  where every column is a result).
- OPEN: the standings evolution charts (six-series legend, ~24 round labels on 360px).
- Per-screen items: `docs/design/ui-review.md`, tagged *Phone layout*. The run bar's and the
  top nav's phone forms are built. Styling only; the model is untouched.

## The share image

- DECIDED: a **portrait PNG, 1080×1920**, from a button on `SeasonOverview` and
  `EraChampions`. Its own card component laid out for the frame (champions, top of the
  standings, the run's what-ifs, the site's address), rendered off-screen and turned into
  an image in the browser (e.g. `html-to-image`, fonts embedded). No server, no save format.
- DECIDED: the Web Share API with a file where there is one, a download where not.
- OPEN: what each card shows; whether the era card is one image or one per page.

## The release

**The author gates it, not the code.** It waits on the author being content with the
ratings, since a wrong rating reads as a wrong opinion about a real driver. Not after the
whole authoring pass, nor after the ratings editor.

- **The text pass.** Cut every on-screen string to what the reader is looking at
  (`.claude/rules/ui-copy.md`). Worst offenders: the setup leads (`SeasonPicker`), the
  `RandomnessSlider` option details, the settings dialog's what-if notes, the
  `CareerStatistics` section descriptions; plus the items tagged *The text pass* in
  `ui-review.md`.
- **The About page** (the footer's disabled `Pending` button): an alternate history, not a
  prediction; how the model works in one plain paragraph; the ratings are the author's
  opinions and mostly first drafts; the AI-collaboration credit; data sources and their
  attribution; the repository link; an unofficial/unaffiliated disclaimer.
- **What's new**: a dated list on the About page, one entry per release, newest first.
  DECIDED: a JSON file in `apps/web` imported at build time, its shape validated by a test,
  committed with the work it describes. OPEN: whether an item can carry a link.
- **The bug report page**. PROPOSED: a pre-filled GitHub issue link (no infrastructure, no
  one's data to hold; a `mailto:` publishes the author's address). It pre-fills seed,
  season, rating mode, randomness level and a build id, which together reproduce a run.
  The recipe (`web-store.md`) has all but the build id, so add a version stamp to
  the footer.
- **Going live**:
  - Hosting: any static host. GitHub Pages needs a `base` in `vite.config.ts` and a
    deep-link workaround; Netlify or Cloudflare Pages need neither. A domain is optional;
    if bought, turn on WHOIS privacy.
  - CI before CD: a workflow running typecheck, lint and test exists before the deploy one.
  - Check the payload: `seasons/index.ts` globs every season with `eager: true` into the
    main bundle. Measure; load years on demand if it bites.
  - Security: no backend, accounts or secrets, so most web risks don't apply. What does:
    the repo goes public with its history (confirm no `.env` or personal data); imported
    saves and edited names are untrusted input (validate on load, never
    `dangerouslySetInnerHTML`); analytics would bring a privacy notice and maybe consent.
  - Names and marks: real names describing history are fine; championship word marks and
    team logos stay out. The generated livery badge is fine.
  - OPEN: the licence. Code is MIT; the season data may carry its sources' conditions.
