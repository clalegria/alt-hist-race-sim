// PreToolUse hook for Bash and PowerShell: refuses Python reading its script
// from stdin (`python -`, also as an empty "is Python here?" probe), which
// blocks until the tool's timeout in this shell, and `python3`, which is the
// Microsoft Store placeholder here. Exit 2 blocks the call and hands stderr to
// Claude.

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const command = JSON.parse(raw).tool_input?.command ?? "";

// Only at a command's start (line start, or after ; & | ( or `$(`), so a
// quoted string or a grep pattern that mentions Python passes.
const at = String.raw`(?:^|[;&|(\n]|\$\()\s*`;
const stdinPython = new RegExp(`${at}(?:python3?|py)(?:\\.exe)?\\s+-(?:\\s|$)`);
const python3 = new RegExp(`${at}python3(?:\\.exe)?\\b`);

if (stdinPython.test(command) || python3.test(command)) {
  process.stderr.write(
    "No Python here: `python -` waits on stdin until the timeout and `python3` is a Store stub. " +
      "Use the Edit tool, or `node -e` / a .mjs file in the scratchpad.\n",
  );
  process.exit(2);
}
