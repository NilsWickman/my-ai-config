#!/usr/bin/env bash
# agent-browser environment diagnostic.
# Run this when agent-browser misbehaves (browser won't launch, sandbox errors,
# flags seemingly ignored). Read-only: changes nothing, prints findings + fixes.
set -u

ok()   { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILURES=$((FAILURES+1)); }
FAILURES=0

echo "=== agent-browser setup check ==="

# 1. Node
if command -v node >/dev/null 2>&1; then
  ok "node $(node --version)"
else
  fail "node not found — install Node.js (required for agent-browser)"
fi

# 2. CLI
if command -v agent-browser >/dev/null 2>&1; then
  ok "agent-browser installed globally: $(agent-browser --version 2>/dev/null)"
  AB=agent-browser
elif command -v npx >/dev/null 2>&1 && npx -y agent-browser --version >/dev/null 2>&1; then
  warn "agent-browser not installed globally, but 'npx -y agent-browser' works ($(npx -y agent-browser --version 2>/dev/null)). Consider: npm i -g agent-browser"
  AB="npx -y agent-browser"
else
  fail "agent-browser CLI not available — install with: npm i -g agent-browser"
  AB=""
fi

# 3. Browser binary
BROWSER=""
if [ -n "${AGENT_BROWSER_EXECUTABLE_PATH:-}" ]; then
  if [ -x "$AGENT_BROWSER_EXECUTABLE_PATH" ]; then
    ok "AGENT_BROWSER_EXECUTABLE_PATH set and executable: $AGENT_BROWSER_EXECUTABLE_PATH"
    BROWSER="$AGENT_BROWSER_EXECUTABLE_PATH"
  else
    fail "AGENT_BROWSER_EXECUTABLE_PATH is set but not executable: $AGENT_BROWSER_EXECUTABLE_PATH"
  fi
fi
if [ -z "$BROWSER" ]; then
  for c in \
    "$HOME"/.agent-browser/browsers/*/chrome \
    "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome \
    /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium /usr/bin/chromium-browser /snap/bin/chromium; do
    if [ -x "$c" ]; then BROWSER="$c"; break; fi
  done
  if [ -n "$BROWSER" ]; then
    ok "browser binary found: $BROWSER"
    case "$BROWSER" in
      "$HOME"/.agent-browser/*) : ;;
      *) warn "not agent-browser's own install — pass it explicitly: --executable-path '$BROWSER' (or export AGENT_BROWSER_EXECUTABLE_PATH)";;
    esac
  else
    fail "no Chrome/Chromium found — run: agent-browser install (or point --executable-path at an existing binary)"
  fi
fi

# 4. Sandbox restrictions (Ubuntu 23.10+ AppArmor)
if [ -r /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns)" = "1" ]; then
    if [ -f /etc/apparmor.d/agent-browser-chrome ]; then
      ok "AppArmor userns restriction active, but /etc/apparmor.d/agent-browser-chrome profile exists"
    else
      warn "AppArmor restricts unprivileged user namespaces (Ubuntu 23.10+): Chrome dies with 'No usable sandbox!'.
      Quick fix : start the daemon with --args \"--no-sandbox\"
      Proper fix: install an AppArmor profile granting userns to the chrome binary (needs sudo), e.g.
                  /etc/apparmor.d/agent-browser-chrome with:  profile agent-browser-chrome $HOME/.cache/ms-playwright/**/chrome flags=(unconfined) { userns, }"
    fi
  else
    ok "no AppArmor userns restriction"
  fi
fi

# 5. Runtime socket permissions
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -d "$RUNTIME_DIR" ] && [ -w "$RUNTIME_DIR" ]; then
  ok "runtime directory is writable: $RUNTIME_DIR"
else
  warn "runtime directory is not writable: $RUNTIME_DIR. Set XDG_RUNTIME_DIR to a writable directory before starting agent-browser"
fi

if [ -n "${CODEX_PERMISSION_PROFILE:-}" ] && [ -z "${CODEX_NETWORK_ALLOW_LOCAL_BINDING:-}" ]; then
  warn "Codex managed sandbox may block agent-browser's local daemon socket. If launch fails with 'Operation not permitted', rerun the agent-browser command with escalated execution"
fi

# 6. Daemon state — flags like --executable-path/--args only apply at daemon START
if pgrep -f "agent-browser.*daemon" >/dev/null 2>&1 || pgrep -f "agent-browser-daemon" >/dev/null 2>&1; then
  warn "an agent-browser daemon is already running — daemon-start flags (--executable-path, --args) are SILENTLY IGNORED until you run: agent-browser close"
else
  ok "no daemon running — next command starts fresh and honors daemon-start flags"
fi

echo "=== done: $FAILURES failure(s) ==="
exit "$([ "$FAILURES" -eq 0 ] && echo 0 || echo 1)"
