/**
 * Keeps the docs Claude loads honest: every rule file's `paths:` still points at real
 * files, and no doc grows past its limit (`.claude/rules/docs.md`).
 */
import { globSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const RULES = join(ROOT, ".claude/rules");

const LIMITS = { claude: 80, rule: 60, roadmap: 120 };

/** Rule files not yet cut to the limit. Remove each as it is rewritten; never add one. */
const OVER_LIMIT = new Set([
  "car-performance",
  "web-careers",
  "web-charts",
  "web-display",
  "web-era",
  "web-grid",
  "web-lists",
  "web-liveries",
  "web-names",
  "web-people-pages",
  "web-persistence",
  "web-records",
  "web-routing",
  "web-run-bar",
  "web-run-settings",
  "web-season-pages",
  "web-setup",
  "web-store",
  "web-styling",
  "web-team-car",
]);

const lineCount = (path: string) => readFileSync(path, "utf8").trimEnd().split("\n").length;

const skipped = (path: string | { name: string }) =>
  /(^|[\\/])(node_modules|\.git|worktrees|dist)$/.test(typeof path === "string" ? path : path.name);

function pathsOf(text: string): string[] {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  return [...front.matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map((m) => m[1] as string);
}

const rules = readdirSync(RULES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ name: f.replace(/\.md$/, ""), path: join(RULES, f) }));

describe("rule files", () => {
  it.each(rules)("$name scopes itself with paths: that all match a file", ({ path }) => {
    const paths = pathsOf(readFileSync(path, "utf8"));
    expect(paths.length).toBeGreaterThan(0);
    const missing = paths.filter((p) => globSync(p, { cwd: ROOT, exclude: skipped }).length === 0);
    expect(missing).toEqual([]);
  });

  it.each(rules.filter((r) => !OVER_LIMIT.has(r.name)))(
    `$name is at most ${LIMITS.rule} lines`,
    ({ path }) => {
      expect(lineCount(path)).toBeLessThanOrEqual(LIMITS.rule);
    },
  );

  it("the over-limit list names only files that exist and are still over", () => {
    const names = new Map(rules.map((r) => [r.name, r.path]));
    const stale = [...OVER_LIMIT].filter((n) => {
      const path = names.get(n);
      return path === undefined || lineCount(path) <= LIMITS.rule;
    });
    expect(stale).toEqual([]);
  });
});

describe("top-level docs", () => {
  it(`CLAUDE.md is at most ${LIMITS.claude} lines`, () => {
    expect(lineCount(join(ROOT, "CLAUDE.md"))).toBeLessThanOrEqual(LIMITS.claude);
  });

  it(`docs/ROADMAP.md is at most ${LIMITS.roadmap} lines`, () => {
    expect(lineCount(join(ROOT, "docs/ROADMAP.md"))).toBeLessThanOrEqual(LIMITS.roadmap);
  });
});
