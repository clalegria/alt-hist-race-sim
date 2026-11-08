# Publish it

Everything before the app goes public: one release. The About page and What's new are
built (`web-about.md`).

## The release

**The author gates it, not the code.** The ratings no longer hold it up.

- **The bug report page**: a tab on the About page, *not available yet* until built. PROPOSED: a pre-filled GitHub issue link (no infrastructure, no
  one's data to hold; a `mailto:` publishes the author's address). It pre-fills seed,
  season, rating mode and randomness level, the recipe (`web-store.md`) of a run.
- **Going live**:
  - DECIDED: the address is `race-sim.clalegria.dev` (domain not bought yet); the link
    preview tags in `index.html` name it, so change them with it. PROPOSED: Cloudflare
    Registrar (WHOIS privacy by default) and Cloudflare Pages, which needs no `base` or
    deep-link workaround, unlike GitHub Pages.
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
