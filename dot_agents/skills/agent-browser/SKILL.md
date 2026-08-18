---
name: agent-browser
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. Also use for exploratory testing, dogfooding, QA, bug hunts, automating Electron desktop apps, Slack automation via browser, or cloud browser environments (Vercel Sandbox, AWS Bedrock AgentCore).
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# Browser Automation with agent-browser

Native Rust CLI driving Chrome/Chromium directly over CDP — no Node/Playwright
in the runtime. Install: `npm i -g agent-browser && agent-browser install`
(or run via `npx -y agent-browser` without installing).

## Full documentation — fetch on demand, never stale

This file is intentionally a stub. The CLI serves complete, **version-matched**
usage docs itself:

```bash
agent-browser skills get core   # full command reference + patterns (~16 KB)
agent-browser skills            # list specialized guides: electron, slack,
                                # dogfood (QA/bug hunts), vercel-sandbox, agentcore
agent-browser skills get <name> # fetch one of them
```

Run `skills get core` before non-trivial automation work — it always matches
the installed CLI version, unlike anything vendored here.

## Quick start (core loop)

```bash
agent-browser open https://example.com
agent-browser snapshot -i        # accessibility-tree outline with element refs:
                                 #   - textbox "Email" [ref=e1]
                                 #   - button "Submit" [ref=e2]
agent-browser fill e1 "user@example.com"   # refs work with or without @
agent-browser click e2
agent-browser wait --load networkidle
agent-browser screenshot out.png
agent-browser close              # stop the daemon when done
```

Commands chain with `&&`; the browser persists between commands via a
background daemon.

## Troubleshooting

If a command fails unexpectedly (browser won't launch, sandbox errors, flags
seemingly ignored), run the bundled diagnostic before debugging by hand — it
checks the whole environment and prints concrete fixes:

```bash
scripts/check-setup.sh    # relative to this skill's directory
```

### Linux / headless servers

Verified pitfalls on fresh Linux servers (e.g. Ubuntu Server 24.04):

- **CLI not installed globally**: `npx -y agent-browser <cmd>` works without
  installing. For regular use, prefer `npm i -g agent-browser`.
- **`No usable sandbox!` at launch**: Ubuntu 23.10+ blocks unprivileged user
  namespaces via AppArmor, which kills Chrome's sandbox. Quick fix: start the
  daemon with `--args "--no-sandbox"`. Proper fix (needs sudo): an AppArmor
  profile granting `userns` to the chrome binary (see check-setup.sh output).
- **No Chrome on the machine**: run `agent-browser install`, or reuse an
  existing binary (e.g. Playwright's `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`)
  via `--executable-path` or `AGENT_BROWSER_EXECUTABLE_PATH`.
- **Daemon-start flags are sticky**: `--executable-path` and `--args` only take
  effect when the daemon starts — they are silently ignored if one is already
  running. Run `agent-browser close` first, then retry with the flags.
- **npm global upgrade on servers**: npm may block the package's install
  script; if `agent-browser` errors with EPERM after upgrade, run
  `sudo chmod +x /usr/lib/node_modules/agent-browser/bin/agent-browser-linux-*`.
