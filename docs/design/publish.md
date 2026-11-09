# Publish it

Everything before the app goes public: one release. The About page and What's new are
built (`web-about.md`).

## The release

**The author gates it, not the code.** The ratings no longer hold it up.

- **The bug report page**: DECIDED, a Google Form (the repo is private and most players
  have no GitHub account). The tab links it with the run written into its "Seed, season,
  mode, settings" question (`components/bug-report.ts`); the form is the author's.
- **Going live**:
  - DECIDED: `race-sim.clalegria.dev`, the domain bought on Cloudflare Registrar; the
    link preview tags in `index.html` name it, so change them with it. PROPOSED:
    Cloudflare Pages (or Workers static assets), which needs no `base` or deep-link
    workaround, unlike GitHub Pages.
  - DECIDED: Cloudflare deploys whatever lands on `main`, even if CI fails; gating the
    deploy on CI is a roadmap item.
  - Security: no backend, accounts or secrets, so most web risks don't apply. What does:
    if the repo goes public, its history (confirm no `.env` or personal data); imported
    saves and edited names are untrusted input (validate on load, never
    `dangerouslySetInnerHTML`); analytics would bring a privacy notice and maybe consent.
  - Names and marks: real names describing history are fine; championship word marks and
    team logos stay out. The generated livery badge is fine.
  - DECIDED: the licence, for now. Code and authored data are all rights reserved; the
    figures counted from Jolpica (calibration targets, real retirements) are CC BY-NC-SA
    4.0, as Jolpica's data is. A commercial use would need Jolpica's permission or those
    figures left out.
