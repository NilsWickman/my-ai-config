---
name: probe
description: Probe the AI models' built-in knowledge before codifying it into a skill, so skills only carry what models get wrong. Domain-agnostic; builds the model/reasoning matrix from whatever the active session's harness offers.
disable-model-invocation: true
---

# Probe-First

Before writing or extending a skill, test whether the models already hold the knowledge. Codify only what they miss; built-in knowledge in a skill is sediment that costs context and goes stale.

What past probes taught (Odoo rounds, 2026-08): the models already knew everything documentation states plainly; every miss was a workflow-dependent fact that contradicts model priors (all probed models placed a module-rename migration in the wrong upgrade phase). That is the shape of knowledge worth codifying. A probe also audits your own draft: one round found a claim in our own skill was wrong.

## Process

1. **Extract claims.** From the incident, diff, or draft skill, list every factual claim you are about to codify, one line each.
2. **Establish ground truth from source, not memory.** Verify each claim against the domain's authoritative source (vendored code, pinned-version docs, or a disposable experiment). A claim you cannot ground stays out of the skill. This step also catches errors in the draft itself.
3. **Write the probe file.** Numbered questions, each answerable from the claims, phrased neutrally (no hints toward the expected answer). Header, domain filled in:

   > You are being knowledge-tested on <domain, version range>. Answer purely from your own built-in knowledge. Do NOT use any tools, do NOT read files, do NOT search the web. Answer each question concisely, numbered. If you are unsure, say so explicitly rather than guessing confidently.

4. **Pick the matrix from the session's harness.** List what the environment actually offers: installed agent CLIs (`claudex`, `codex`, ...), the models each exposes, and their reasoning/thinking levels - read `--help` or the CLI's config, never assume a lineup. Choose 4-6 model × reasoning-level cells spanning cheapest-fastest to strongest. When a routing decision motivated the probe, the cells are exactly the candidates being routed between. With only one CLI available, vary its models and reasoning levels to fill the matrix.
5. **Run the probe from a neutral cwd** (e.g. `/tmp`, so no workspace CLAUDE.md or skills leak in), one output file per cell:

   ```bash
   cd /tmp
   claudex -p --model <model> "$(cat probe.md)" > <model>.out
   codex exec -m <model> -c model_reasoning_effort=<level> - < probe.md > <model>-<level>.out
   ```

6. **Verdict per claim**, every claim gets exactly one:
   - **All cells correct** -> drop it from the skill; a pointer to the concept name is enough.
   - **Any cell plausibly-wrong** -> codify, and include *why the plausible answer fails* (the scenario detail the models assumed away).
   - **Contradicts model priors outright** -> codify prominently, mark battle-tested with date and how it was verified.
   - **Own draft was wrong** -> fix the draft/doc where it lives.

Done when every extracted claim has a verdict and a placement, and no unverified claim remains in the skill text.
