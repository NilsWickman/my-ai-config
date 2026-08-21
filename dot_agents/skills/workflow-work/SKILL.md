---
name: workflow-work
description: Use for workflow work that creates or cleans up resources, evaluates baselines, or handles temporary secrets.
disable-model-invocation: true
---

Delete only resources enumerated in a run-owned manifest; name patterns may report candidates but never authorize deletion.
Base workflow gates on scoped deterministic outcomes—exit status, targeted tests, module state, and expected logs—not generic `ERROR` or `CRITICAL` text.
Keep raw temporary secrets in a dedicated `0700` directory using atomically created `0600` files, never argv, environment, or logs, then delete and scan for remnants immediately after use.
