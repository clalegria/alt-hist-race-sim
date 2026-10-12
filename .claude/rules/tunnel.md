---
paths:
  - "tools/tunnel/**"
  - "apps/web/vite.config.ts"
---

# Tunnel

`pnpm tunnel` puts this checkout's dev server on a random Cloudflare quick-tunnel address,
so the author can open the app from a work PC or a phone.

- **Run it from the checkout whose code the author wants to see**, in the background:
  this session's worktree for work in progress (bring `main` in first with
  `git merge --ff-only main` if it is behind), the repo root for `main` as committed.
- Read the `trycloudflare.com` address from its output and send it in chat. It is open to
  anyone holding it while the tunnel runs, and changes on every start.
- **Stop it by killing the process tree** (`taskkill /T /F /PID <pid>`): stopping `pnpm`
  alone on Windows leaves Vite and cloudflared running.
- **Don't install cloudflared with winget in a remote session**: it waits on a UAC prompt
  nobody can click. The no-admin install is the release's
  `cloudflared-windows-amd64.exe` at the first path in `INSTALL_LOCATIONS`.
- `server.allowedHosts` in `apps/web/vite.config.ts` must keep admitting
  `.trycloudflare.com`, or Vite rejects every tunnelled request.
- A fixed address, or a login in front of it, needs a Cloudflare account and a named
  tunnel.
