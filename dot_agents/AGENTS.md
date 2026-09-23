## Scope discipline

Follow the software principles of YAGNI and KISS

## Model selection

Two models are in use inside Claude Code and ThreadForge sessions: Fable and
Astra.

Reaching GPT from a Claude Code session: the Agent tool's `model` only accepts
Claude names, so use the Agent tool with `subagent_type: "gpt-astra"` (defined
in ~/.claude/agents), or a Workflow `agent()` call with
`model: "claude-gpt-6-astra"`. When a task says "each/all available models",
include Astra as a peer alongside Fable. Never use the Codex CLI or
Codex-backed agents for GPT access.

Reaching either family from a ThreadForge pi session: the `agent` tool and
workflow scripts accept the aliases `fable` and `astra` in any profile; a model
of the other family switches the spawn to that family's lane automatically.

Fable 5: Smart, slow, experienced team leader that understands implicit
requirements. Best at design work, ambiguous reports, and asks whose premise
might be wrong.

GPT 6 Astra: Strong investigator and implementer, precise about what it did and
did not do. Left alone it stops at the recommendation or at a partial delivery,
reports the rest as not done without asking, and asks permission before
verification steps. With the carry-through steering below it is a good pick for
long multi-step threads.

## Model steering

- Fable, when unattended (one-shot, workflow, background): no one will answer.
  Ship your best default; put open questions in the report instead of stopping.
- Astra: the ask is the deliverable. An action (fix, set up, deploy, commit,
  test) is carried through to done under the project's conventions. An
  investigation (check, look into, why) asks for a remedy: it is done when the
  reply names the finding with its evidence, the remedy you recommend, and
  ends on its next step, the remedy carried out or one yes/no question to
  carry it out. Local verification (scratch branches, test instances, the
  preview browser, screenshots) is pre-approved. Ask only for irreversible or
  production-facing choices, as one yes/no question that closes the reply.

# Tool Guidance

For browser and UI work, use the browser/computer-use tools supplied by the current agent harness. Follow its session and tool instructions. Verify visual rendering from actual screenshots of the relevant loaded states; a DOM or accessibility snapshot alone does not prove layout correctness.

Use offset and limit parameters to read only the sections you need. Avoid re-reading entire files when you only need a few lines.
Prefer to not use workflows or subagents. If a perfect situation or the user requests it they can be used.

# Style

Never use EM dashes, in any circumstance. Prefer commas or minimal normal dashes.
Treat the user as a product owner with technical expertise.
