# alt-hist-race-sim

**Alternate History Racing Simulator** (working name)

An alternate-history motor racing simulator. It starts from a real season — any
year from 1950 to 2026 — and simulates forward year by year, with drivers ageing,
moving between teams and retiring, producing a timeline that diverges from real
history.

Status: early development (phase 1, browser-only). Built with TypeScript, React,
and Vite.

`CLAUDE.md` has the architecture and conventions; `docs/ROADMAP.md` is what is
left to build, `docs/DECISIONS.md` the questions still open, and `docs/design/` the
design of large subsystems not yet built.

## License
All rights reserved — see `LICENSE`. The code and data are public to read, not to reuse.

The real-results figures in `tools/calibrate/targets/` and
`tools/calibrate/src/realRetirements.ts` are counted from the
[Jolpica F1 API](https://github.com/jolpica/jolpica-f1) (Ergast-compatible), whose data
is licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); those
figures are shared under the same licence.

An unofficial fan project, not affiliated with Formula 1, the FIA or any team.
