---
paths:
  - "tools/tunnel/**"
  - "apps/web/vite.config.ts"
---

# Tunnel

`pnpm tunnel` puts the dev server on a random `https://<words>.trycloudflare.com`
address, so the author can open the running app from a work PC or a phone while the
dev server runs on the home PC. It is a Cloudflare **quick tunnel**: no account.

- **Server**: `startDevServer` (`@alt-hist/screenshots/server`, `screenshots.md`): its
  own, on a free port, from the checkout `pnpm tunnel` runs in, stopped with it. So the
  page shows that checkout's files, committed or not, and two tunnels can run at once.
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

Run it in the background from **the checkout whose code the author wants to see**:
- **Work in progress** (the usual case): this session's own worktree, so uncommitted
  edits show. If the worktree is behind `main`, bring `main` in first
  (`git merge --ff-only main`), or the page lacks other sessions' commits.
- **`main` as committed**: the main checkout (the repo root). Commits to `main` land
  there, so the open page follows them.

Read the address from its output and send it in chat. To stop it, kill the process tree
(`taskkill /T /F /PID <pid>`), not `pnpm` alone, which on Windows leaves Vite and
cloudflared running.
