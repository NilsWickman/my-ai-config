# my-ai-config

Shared configuration for AI coding agents (Claude Code, Codex CLI, pi), managed
with [chezmoi](https://chezmoi.io). One canonical instruction file and one
canonical skill library, symlinked into every tool.

This is a public mirror of a private setup. Machine-, employer- and
customer-specific parts are not included, see [Scope](#scope).

## The idea: one skill library, many tools

Every agent tool wants its own config directory. Keeping copies in sync by hand
fails immediately, so every tool's skill directory points at one place instead:

```
~/.agents/skills/            ← the only real skill library
     ├─ ~/.claude/skills      → symlink to skills/
     ├─ ~/.codex/skills       → symlink to skills/
     └─ ~/.pi/agent/skills    → symlink to skills/
```

There are deliberately no global agent instructions (`AGENTS.md`/`CLAUDE.md`):
the tools run native and each project's own instruction file is enough. Editing
a tool's skill directory means editing a symlink, so all changes go to
`~/.agents/` or, better, to the chezmoi source.

## Layout

| Source (repo) | Target (home) | What |
|---|---|---|
| `dot_agents/skills/` | `~/.agents/skills/` | Canonical skills (Agent Skills format) |
| `dot_claude/` | `~/.claude/` | Status line script + symlinks |
| `dot_codex/` | `~/.codex/` | Symlinks |
| `dot_pi/agent/` | `~/.pi/agent/` | Theme, extensions, symlinks |

Machine-local state (`~/.claude/settings.json`, `~/.codex/config.toml`,
`~/.pi/agent/settings.json`) is deliberately unmanaged. Preferences and runtime
state differ per machine and are not worth syncing.

## Install

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
~/.local/bin/chezmoi init --apply https://github.com/NilsWickman/my-ai-config.git
```

Applying is not destructive to your agent logins. This repo manages tool
*config*, never auth.

Want only the skills? Copy `dot_agents/skills/` into `~/.claude/skills/` and
skip chezmoi entirely.

## Skills

| Skill | What it is for |
|---|---|
| `video` | Self-narrating product walkthrough videos of web apps with Playwright, incl. before/after A/B |
| `dev-env` | Start and verify a development environment, then hand over its URL and login |
| `diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions |
| `domain-modeling` | Domain model discipline: DOMAIN.md, CONTEXT.md, glossaries, domain cards |
| `dotfiles` | Sync this repo between machines, add canonical skills, resolve drift |
| `email` | Draft concise client emails with verified claims and clear next steps |
| `loop-me` | Interview-driven spec building for workflows in a workspace |
| `probe` | Test model knowledge before adding instructions to a skill |
| `wait-what` | The last message did not land: re-pitch it |

Skills follow the [Agent Skills](https://code.claude.com/docs/en/skills)
format: a directory with a `SKILL.md` carrying `name` and `description`
frontmatter, plus any reference files and scripts it needs.

## Scope

Left out on purpose, since it is tied to one person's infrastructure or to
customer work:

- Host topology, deployment and self-hosted service skills
- Employer- and customer-specific skills, branding assets and workspace configs
- Git identity templates, systemd units, model-proxy tooling

Some skills mention tools from that private setup. They are still readable as
patterns, just adapt the concrete commands to your own environment.

## License

MIT, see [LICENSE](LICENSE).
