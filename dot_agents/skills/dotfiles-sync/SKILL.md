---
name: dotfiles-sync
description: Sync chezmoi-managed agent dotfiles (AGENTS.md, skills, tool configs) between machines. Use when asked to sync/propagate config or skills across machines, add or edit a canonical skill or AGENTS.md, pull the latest dotfiles, bootstrap a new machine, or when chezmoi status/diff shows drift.
user-invocable: false
---

# Dotfiles sync (chezmoi)

Shared config for AI coding agents (Claude Code, Codex CLI, pi) synced between
machines with chezmoi.

## Authority chain, where to edit

```
GitHub repo                                  ← shared truth between machines
  └─ chezmoi source  ~/.local/share/chezmoi/ ← local clone (source state)
       └─ ~/.agents/AGENTS.md + ~/.agents/skills/   ← applied files (canonical on the machine)
            └─ ~/.claude/*, ~/.codex/*, ~/.pi/agent/* ← symlinks into ~/.agents/
```

- **Never edit tool dirs** (`~/.claude/skills/...`, `~/.codex/AGENTS.md`, ...),
  they are symlinks. `CLAUDE.md` is an alias for `~/.agents/AGENTS.md`.
- A local change is not "real" until committed **and pushed** from the source
  repo, otherwise it never reaches the other machines.

## Common operations

| Task | Commands |
|---|---|
| Pull changes made on another machine | `chezmoi update` (git pull + apply in one) |
| Edit a managed file and share it | `chezmoi edit <target>` → `chezmoi apply` → `chezmoi cd` → `git add -A && git commit && git push` |
| A tool (or you) edited the target file directly | `chezmoi re-add <file>`; for templates use `chezmoi merge <file>`, re-add breaks templates |
| Check drift / preview | `chezmoi status`, `chezmoi diff` |

## Adding a new canonical skill

1. Create `dot_agents/skills/<name>/SKILL.md` (frontmatter: `name`,
   `description`) in the source: `$(chezmoi source-path)`.
2. Keep invocation metadata portable:
   - For an explicit-only skill, keep Claude Code's
     `disable-model-invocation: true` in `SKILL.md` and add
     `policy.allow_implicit_invocation: false` in `agents/openai.yaml` for
     Codex and ChatGPT.
   - Claude Code's `user-invocable: false` has no Codex equivalent. Preserve
     it for Claude Code; Codex may still expose the skill for explicit use.
3. `chezmoi apply` materializes it to `~/.agents/skills/<name>/`, instantly
   visible to all tools via their symlinks.
4. Commit + push from `chezmoi cd`. Other machines pick it up with
   `chezmoi update`.

## Bootstrap a new machine

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
~/.local/bin/chezmoi init --apply <repo-url>
```

Prereq: the agent tools themselves must be installed and logged in separately.
This repo manages their *config*, not their auth.

## Gotchas

- **Push or it didn't happen.** The most common sync failure is an applied,
  committed-but-unpushed change sitting on one machine.
- Template sources (`.tmpl`) must be edited via `chezmoi edit`/`merge`, never
  `re-add`, which would replace the template with its rendered output.
- `~/.config/chezmoi/chezmoi.toml` is per-machine local state and is never in
  the repo. Don't try to sync it.
- Skills carrying `disable-model-invocation: true` register but stay
  slash-only. That is their config, not a broken link.
