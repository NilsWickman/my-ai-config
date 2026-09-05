# my-ai-config

Shared configuration for AI coding agents (Claude Code, Codex CLI, pi), managed
with [chezmoi](https://chezmoi.io). One canonical instruction file and one
canonical skill library, symlinked into every tool.

This is a public mirror of a private setup. Machine-, employer- and
customer-specific parts are not included, see [Scope](#scope).

## The idea: one source, many tools

Every agent tool wants its own config directory. Keeping three copies of the
same instructions in sync by hand fails immediately, so everything points at
one place instead:

```
~/.agents/AGENTS.md          ← the only real instruction file
~/.agents/skills/            ← the only real skill library
     ├─ ~/.claude/CLAUDE.md   → symlink to AGENTS.md
     ├─ ~/.claude/skills      → symlink to skills/
     ├─ ~/.codex/AGENTS.md    → symlink to AGENTS.md
     ├─ ~/.codex/skills       → symlink to skills/
     ├─ ~/.pi/agent/AGENTS.md → symlink to AGENTS.md
     └─ ~/.pi/agent/skills    → symlink to skills/
```

`CLAUDE.md` is an alias, not a file you edit. Editing a tool directory means
editing a symlink, so all changes go to `~/.agents/` or, better, to the chezmoi
source.

## Layout

| Source (repo) | Target (home) | What |
|---|---|---|
| `dot_agents/AGENTS.md` | `~/.agents/AGENTS.md` | Universal agent instructions |
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
| `commitgroup` | Stage and commit changes in coherent, reviewable groups |
| `demo-images` | Low-fidelity prototypes: show a few distinct visual alternatives |
| `video` | Self-narrating product walkthrough videos of web apps with Playwright, incl. before/after A/B |
| `diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions |
| `domain-modeling` | Domain model discipline: DOMAIN.md, CONTEXT.md, glossaries, domain cards |
| `dotfiles` | Sync this repo between machines, add canonical skills, resolve drift |
| `grilling` | Stress-test a plan, decision or idea by relentless questioning |
| `handoff` | Compact the current conversation into a handoff document for another agent |
| `loop-me` | Interview-driven spec building for workflows in a workspace |
| `prototype` | Explore a user flow as several varying designs behind one previewer |
| `tdd` | Test-driven development, red-green-refactor, integration tests |
| `wait-what` | The last message did not land: re-pitch it |
| `wayfinder` | Plan work larger than one agent session as a map of decision tickets |
| `wizard` | Generate an interactive bash wizard for steps only a human can perform |
| `workflow-guidance` | Build one task through serial, resumable gates and maintain its workflow script safely |
| `workflow-work` | Workflow work that creates or cleans up resources, or handles temporary secrets |
| `writing-for-agents` | How to write skills, AGENTS.md and CLAUDE.md so agents actually follow them |

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
