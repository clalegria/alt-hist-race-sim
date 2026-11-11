---
paths:
  - "wrangler.jsonc"
  - ".node-version"
  - "apps/web/index.html"
  - "apps/web/src/lib/whats-new.json"
  - "apps/web/src/components/bug-report.ts"
---

# The live site

The app is public at `race-sim.clalegria.dev`: a Cloudflare Worker serving static assets.

- **A push to `main` is a release**: Cloudflare builds and deploys it, whether CI passes
  or not. Never push unasked; a local commit is not live.
- **`not_found_handling: "single-page-application"`** in `wrangler.jsonc` is what makes a
  deep link open; never drop it. The Worker's `name` matches the Cloudflare project.
- **The link preview tags in `index.html` name the address**: change them with it.
- **A change that refuses saved runs** (any retune, `RECIPE_VERSION`) costs players their
  run in progress on their next visit: say so before pushing it.
- **No server code**: a `main` script, analytics or anything storing a visitor's data
  brings billing, a privacy notice and maybe consent. Ask first.
- **Untrusted input**: imported saves and edited names are validated on load; never
  `dangerouslySetInnerHTML`.
- **Names and marks**: real names describing history are fine; championship word marks
  and team logos stay out.
- **The licence**: code and authored data are all rights reserved; figures counted from
  Jolpica (calibration targets, real retirements) are CC BY-NC-SA 4.0. A commercial use
  needs Jolpica's permission or those figures left out.
- **The repo is public**: nothing private goes in a commit (`.env`, the personal email;
  commits use the noreply address).
