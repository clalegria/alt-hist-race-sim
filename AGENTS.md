# AGENTS.md

How work is split between models and subagents here. Imported by `CLAUDE.md`, which owns
the commands, invariants and conventions; `.claude/rules/` owns subsystem rules.

## The project, for a brief
A browser-only TypeScript/React alternate-history racing simulator in a pnpm monorepo: a
pure engine (`packages/engine`), authored data (`packages/data`), the web app (`apps/web`),
tooling (`tools/*`). Subagents load CLAUDE.md, but a brief restates what binds its task:
- Never change an engine constant or authored rating unless the author asked for it.
- The engine stays pure: nothing imported from outside it, no I/O, no `Math.random()`.
- No test asserts an authored number or what a seed produced (`testing.md`).
- No commits, pushes, installs, or edits outside the files the brief assigns.

## The main agent (Opus 5.5, high effort)
Owns the outcome: reads intent, makes architectural calls, plans, does hard debugging and
root-cause work, reviews risky changes, settles conflicting findings, integrates subagent
work, runs the final checks and commits. Delegation hands off labour, never ownership.

## Who does what
| Task | Model | Effort | Execution |
|---|---|---|---|
| Architecture, plans, complex reasoning | Opus 5.5 | high | Main agent; the built-in Plan agent inherits Opus |
| Hard debugging, major refactor | Opus 5.5 | high | Main agent; `Explore` for fact-finding |
| Touching numbers, authored data or how performance is computed; anything security-sensitive | Opus 5.5 | high | Main agent only |
| Well-defined slice of an agreed plan | Sonnet 5.5 | medium; high if subtle | `implementer` |
| Tests for written or specified code | Sonnet 5.5 | medium | `test-writer` |
| Focused correctness and convention review | Sonnet 5.5 | medium | `reviewer` |
| Searches, call sites, doc summaries | Haiku 5.5 | medium; low for a plain lookup | `Explore` |
| Bulk mechanical edit across many files | Haiku 5.5 | low | `implementer` with `model: "haiku"` |
| Small, explicit edit | — | — | Main agent inline: a spawn costs more than the edit |

An Agent call's `model` and `effort` override the agent's defaults; pass them where a row
says so. Never hand architectural or number-sensitive work to Haiku to save cost.

## When to delegate
Delegate when the work is self-contained, big enough to repay a cold start (a subagent
re-reads what you already know), and can come back as a summary:
- independent investigations of separate modules or questions;
- an agreed plan whose parts own disjoint files;
- tests or a review that gain from a fresh pair of eyes.

Keep it inline for a small edit, phases that share a lot of context, two agents on one
file, or when the author is iterating with you. Use the fewest agents that help.

## Briefing a subagent
- **Every brief carries**: the objective; context (files, plan, decisions made); the
  constraints above that apply; scope (files owned, what is out of scope); the
  deliverable; the checks to run.
- **Every agent reports**: what it found or changed, files touched, commands run with
  results, open concerns and questions.
- An agent that finds the task needs more than its scope stops and reports.

## Running in parallel
- Send independent spawns in one message so they run concurrently.
- One owner per file. The main agent settles shared contracts (store shape, engine types,
  a component's props) before parallel implementation starts.
- Investigation (`Explore`, `reviewer`, Plan) is read-only; edits go to `implementer` or
  `test-writer`.
- Don't reach for `isolation: "worktree"` to dodge a file conflict; split the work.

## Validation and the final report
- The main agent reads every diff a subagent made and re-runs `pnpm typecheck`,
  `pnpm test` (check `Test Files`) and `pnpm lint` on the integrated tree. A subagent's
  "tests pass" is a claim, not evidence.
- Screenshots only for a visible change (`screenshots.md`).
- Report to the author: what changed and why, which agents and models did what, the
  checks run and their results, anything unresolved.

## Configuration and fallbacks
- **Enforced by config**: the main model and effort (the author's user settings: `opus`,
  high for Opus 5.5); each `.claude/agents/*.md` agent's `model` and `effort`; unconfigured
  spawns (`general-purpose`, `claude`) default to Sonnet through `CLAUDE_CODE_SUBAGENT_MODEL`
  in `.claude/settings.json`.
- **Advisory, this file**: whether to delegate, which agent, briefs, parallelism, reports.
- On the Anthropic API `opus`, `sonnet` and `haiku` are Opus 5.5, Sonnet 5.5 and Haiku
  5.5; other providers may map them to older models, and an unsupported effort level falls
  back to the highest one below it. If a model is missing, keep the order (strongest for
  main, middle for implementation and review, lightest for search) and record the
  substitution here.
- Substitutions in effect: none.
