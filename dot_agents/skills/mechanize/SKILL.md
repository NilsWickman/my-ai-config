---
name: mechanize
description: Turn a noticed problem, or the slips found reviewing a session, into mechanisms (type, lint, helper, runtime check) instead of instructions.
disable-model-invocation: true
---

# Mechanize

A rule that lands as text can slip; one that lands as a mechanism cannot. Two ways in:

- The user has noticed a problem and asks whether it can be mechanized: start at step 1.
- The user asks for a retro on a session, or names no problem: run **Review** first, then take each candidate the user picks through the steps.

## Review

1. **Read the session.** Default to the current one. For a past ThreadForge thread, find it with `~/.agents/skills/recall/scripts/recall.py search <words>`, then read it with `show <id-prefix> --full`; Claude Code CLI sessions live in `~/.claude/projects/`. Done when you can point to the turns where the agent went wrong, went slow, or lacked something.
2. **Sort the slips** through these lenses:
   - **Navigation**: the agent searched long for a file or fact. Could a pointer, or moving the fact to where the agent looks, have saved it?
   - **Automated checks**: the agent made a mistake a type, lint, test or hook could have caught. Read the repo's own check commands and CI first: a check that exists but is unwired or broken is the finding. A repo with no pre-commit hook and no CI running lint, typecheck and tests is a finding on its own.
   - **Review rules**: a review let a mistake through. A mechanical violation (fixed pattern, banned API, import shape, file location) gets a check; only a judgement call gets text.
   - **Steering bloat**: lines in a repo or global `CLAUDE.md`/`AGENTS.md` that a check could replace, or that change no behaviour.
   - **Tool economy**: expensive or token-heavy tool calls that a script, flag or narrower query would shrink.
   - **Information access**: a fact the agent needed but could not reach (dev server logs, read-only access to a service).
3. **Present the candidates** by severity, one sentence each: the slip, with the turn it happened on, and the rung you expect it to reach. Stop until the user picks.

## Steps

1. **Name the seam.** Write the slip as one concrete failure at the seam where user and agent meet: what the user assumed, what the agent did, which turn it broke on. Every rung is judged against that failure alone; a mechanism that would not have stopped it is a different project. Done when the failure fits in one sentence with an example.
2. **Inventory.** Search the repo for a mechanism that already covers the seam (make targets, `scripts/check_*`, hooks, helpers, existing skill references) before designing one. Extending or relocating what exists beats adding a parallel piece. Done when you can list what exists and the gap it leaves.
3. **Find the rung.** Climb to the strongest the situation allows. Agents copy whatever surrounding code does, so a weak guard becomes the next template:
   1. Unrepresentable state: the wrong thing does not compile or parse.
   2. Lint, banned API, or CI check that fails the build.
   3. Canonical helper everyone reaches for. It counts only if it lives where the next user looks (a shared core module, not the first caller's file); a helper buried in one consumer gets copied, not reused.
   4. Runtime check that fails loudly.
   5. Text, only if the rule needs judgement: one prominent line with an example of the failure.
4. **Ship rungs 1 to 4 directly.** Done when the mechanism is in place and any instruction it replaces is deleted.
5. **Propose rung 5 and wait.** Text, CLAUDE.md lines and skill changes need human approval: show the exact wording and where it goes, then stop until the user answers.
