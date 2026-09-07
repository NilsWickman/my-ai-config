---
name: dev-env
description: Start a repo's dev environment and hand over a working URL with login. Use when asked to start or restart dev servers ("starta utvecklingsservern"), get a preview/Tailscale URL, find test credentials or login rules ("hitta inloggningsuppgifter"), or expose a local port.
disable-model-invocation: true
---

# Dev environment

Deliverable: a URL the user can open and log into, reported together with credentials.

## 1. Read the repo's facts

Open the repo's `AGENTS.md` and read the `## Dev environment` section. When it exists, follow it, it outranks rediscovery. Only a fact that fails in practice justifies re-deriving it.

## 2. Discover what's missing

Start commands and ports: package.json scripts, docker-compose, Makefile, README. Credentials: seed/fixture files, `.env*`, docs. Report where each credential came from; if the repo holds none, say so and ask, a guessed login wastes the user's first click.

## 3. Start and verify

- Bind 127.0.0.1.
- A server that should outlive the session runs under the repo's documented process manager or a systemd user unit; a quick check may run in the background with logs to a file.
- The server is up when curl on the port returns the app, not when the command prints "listening".

## 4. Expose over the tailnet

When remote access is needed, use the repo's documented private-network proxy or `tailscale serve`. Inspect the installed command's help for supported options. Verify and report the actual URL returned by the tool. Keep access restricted to the private network. For local-only work, hand over the localhost URL.

## 5. Hand over

Report: the URL, credentials and login rules, and how to stop the server and remove any private-network proxy created for it.

## 6. Recommend recording, don't write

Do not write to `AGENTS.md` unless the user explicitly asks. If step 2 discovered anything, or a recorded fact proved wrong, say so in the hand-over and offer to record it in the repo's `## Dev environment` section (start command, ports, where credentials live, login rules, liveness check, facts only, one screenful). Only an explicit yes triggers the write.
