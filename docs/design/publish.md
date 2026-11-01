# Publish it

Everything before the app goes public: one release. The About page and What's new are
built (`web-about.md`).

## The release

**The author gates it, not the code.** It waits on the author being content with the
ratings, since a wrong rating reads as a wrong opinion about a real driver. Not after the
whole authoring pass, nor after the ratings editor.

- **The text pass.** Cut every on-screen string to what the reader is looking at
  (`.claude/rules/ui-copy.md`). Worst offenders: the setup leads (`SeasonPicker`), the
  `RandomnessSlider` option details, the settings dialog's what-if notes, the
  `CareerStatistics` section descriptions. The About page's words are a draft for the
  author to rewrite (`web-about.md`).
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
  - DECIDED: the licence, for now. Code and authored data are all rights reserved; the
    figures counted from Jolpica (calibration targets, real retirements) are CC BY-NC-SA
    4.0, as Jolpica's data is. A commercial use would need Jolpica's permission or those
    figures left out.
