---
name: mechanize
description: Turn a noticed problem, or the slips found reviewing a session, into mechanisms (type, lint, helper, runtime check) instead of instructions.
disable-model-invocation: true
---

# Philosophy

Software Engineering is today co-creation between a human and their AI agents. Amongst the different problems this introduces are responsibility for code. Many companies place that responsibility on the human. We do not.

We place the responsibility on the DevOps setup of the repository, tooling, safety nets and processes. This means that any problems that humans encounter with their agents should only ever occur once. 

The first solution to this was a personalized system prompt (Agents.md/claude.md) with thousands of instructions. This is deprecated as the standard for a more human feedback loop. We dont expect humans to follow a 30 page document for coding standard, why would we expect agents to do it.

Instead, we aim to constantly re-evaluate the floor and ceiling of AI capabilities for what are necessary safety nets. Just like a day one developer should be able of contributing to the codebase and receive feedback in a Gerkin format should an AI who spawns for this purpose also receive this feedback.

Mechanize is our methodology for implementing this continuously improving feedback loop to never encounter collaboration or bugs again, if the agent defaults to bad patterns.

# Mechanize

A rule that lands as text can slip; one that lands as a mechanism cannot. The human has noticed a problem with the AI collaboration and asks whether it can be mechanized.

## Steps

1. **Name the seam.** Write the slip as one concrete failure at the seam where user and agent meet: what the user assumed, what the agent did, which turn it broke on. Every rung is judged against that failure alone; a mechanism that would not have stopped it is a different project. Done when the failure fits in one sentence with an example.
2. **Inventory.** Search the repo for a mechanism that already covers the seam (make targets, `scripts/check_*`, hooks, helpers, existing skill references) before designing one. Extending what exists beats adding a parallel piece. Done when you can list what exists and the gap it leaves.
3. **Find the rung.** Climb to the strongest the situation allows. Agents copy whatever surrounding code does, so a weak guard becomes the next template:
   1. Unrepresentable state: the wrong thing does not compile or parse.
   2. Lint, banned API, or CI check that fails the build.
   3. Canonical helper everyone reaches for. It counts only if it lives where the next user looks (a shared core module, not the first caller's file); a helper buried in one consumer gets copied, not reused.
   4. Runtime check that fails loudly.
   5. Text, only if the rule needs judgement: one prominent line with an example of the failure.
4. **Ship rungs 1 to 4 directly.** Done when the mechanism is in place and any instruction it replaces is deleted.
5. **Propose rung 5 and wait.** Text, CLAUDE.md lines and skill changes need human approval: show the exact wording and where it goes, then stop until the user answers.
