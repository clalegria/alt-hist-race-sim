---
paths:
  - "CLAUDE.md"
  - "docs/**"
  - ".claude/rules/**"
---

# Writing docs

Every line here is read on many future tasks and goes stale when the code moves. Write less.

- **Where things go**: project-wide invariants and commands in `CLAUDE.md`; one subsystem's
  rules in `.claude/rules/<subsystem>.md`, scoped by `paths:`; what to build next in
  `docs/ROADMAP.md`; open questions in `docs/DECISIONS.md`; a large unbuilt design in
  `docs/design/<name>.md`. Say a thing once, in the file that owns it.
- **Limits**, checked by `tools/docs`: CLAUDE.md ≤80 lines, a rule file ≤60, ROADMAP ≤120.
  A DECISIONS entry ≤5 lines; a roadmap item ≤3 lines plus a link to its design doc.
- **Replace, don't append.** An edit leaves the file within its limit; to add a line, find
  one to cut.
- **A rule file is a list of instructions.** Each bullet is something not visible in the
  code that Claude would otherwise get wrong: an invariant, a contract between files, a
  gotcha, where something lives, a "don't".
- **Never in a doc**: what the code plainly does, styling and class choices, lists of
  tests or mutation checks, history, a number's value, chains of cross-references. A reason
  gets half a sentence, or a one-line comment beside the code it explains.
- **Rule file shape**: `paths:` frontmatter, `# Title`, one line of purpose, bullets. A
  `paths:` entry must match a real file; rename it with the code.
- **Design doc**: each point DECIDED, PROPOSED (confirm first) or OPEN. As parts are built
  they move to rule files; when nothing is left, delete the doc.
- **Settled is deleted**: a finished roadmap item, an answered decision. Git keeps history.
- When unsure whether a detail can go, ask the author.
