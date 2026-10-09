---
paths:
  - "tools/tunnel/**"
  - "apps/web/vite.config.ts"
---

# Tunnel

`pnpm tunnel` puts the dev server on a random `https://<words>.trycloudflare.com`
address, so the author can open the running app from a work PC or a phone while the
dev server runs on the home PC. It is a Cloudflare **quick tunnel**: no account.

- **Server**: `ensureDevServer` from `tools/screenshots/src/server.ts` (exported as
  `@alt-hist/screenshots/server`), so it reuses a server already on :5173 that serves
  this app, or starts one and stops it at the end. It reuses *any* worktree's server,
  so a server left running from an older worktree shows older code.
- **Vite** rejects a request for a host it doesn't know; `server.allowedHosts` in
  `apps/web/vite.config.ts` admits `.trycloudflare.com`. HMR works through the tunnel.
- **cloudflared** is found on PATH, else at
  `%LOCALAPPDATA%\Programs\cloudflared\cloudflared.exe` (the no-admin install: the
  release's `cloudflared-windows-amd64.exe`), else winget's location. A winget install
  waits on a UAC prompt, which nobody can click in a remote session.
- **The address is open to anyone holding it** while the tunnel runs, and changes on
  every start. A fixed address, or a login in front of it, needs a Cloudflare account
  and a named tunnel.

## Running it for the author

Start `pnpm tunnel` in the background **from the main checkout** (the repo root, which
has `main` checked out), never from a session's `.claude/worktrees/*` copy: commits to
`main` land there, so the open page follows them. Read the address from its output and
send it in chat. To stop it, kill the process tree (`taskkill /T /F /PID <pid>`), not `pnpm`
alone, which on Windows leaves Vite and cloudflared running. Then check nothing is left
listening on :5173.
