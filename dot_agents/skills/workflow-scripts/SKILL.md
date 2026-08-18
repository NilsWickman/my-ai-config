---
name: workflow-scripts
description: Survival rules for Workflow-tool scripts. Use before writing or editing a workflow script (agent(), pipeline(), parallel()), and when a finished run returned null, empty, or partial results.
---

# Workflow scripts

Rules that keep a run from silently building on a dead agent. Each one comes from a real failed run.

## null is agent death

`await agent(...)` resolves null when the agent dies (API stream drop, budget exhaustion, user skip, server restart mid-run). It is never a valid empty result. Every call site takes one of two branches:

**Gate stage** (build, migration, staging, anything later stages depend on): stop the run.

```js
const build = await agent(buildPrompt)
if (!build) return { status: 'stopped', reason: 'build agent died' }
```

On 2026-08-08 a reviewer fanout audited a build whose build agent had died; every downstream token was wasted.

**Fan-out member** (one finding among many): drop it, count it, say so.

```js
const found = (await parallel(thunks)).filter(Boolean)
if (found.length < thunks.length) log(`${thunks.length - found.length} agent(s) died; continuing with ${found.length}`)
```

A pipeline() stage that throws drops its item to null the same way; apply the same two branches where the results land.

## Saved workflows run stale by name

Invoke a saved workflow with `{scriptPath: "..."}`, never by name. Name invocation runs a snapshot taken at session start, so edits and args are silently ignored (observed 2026-08-08: every agent fell back to the session default model).

## Pre-run check

Before invoking Workflow, re-read the script and account for every `await agent(` and every parallel()/pipeline() collection point: each is either a gate that stops the run or a counted drop. The script passes when no null can flow downstream unhandled.
