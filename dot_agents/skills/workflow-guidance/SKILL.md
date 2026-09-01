---
name: workflow-guidance
description: Build one task through serial, resumable workflow gates and maintain the script safely.
disable-model-invocation: true
---

# Workflow guidance

A **baseline** Workflow script, adapted once per repo and then run once per task. It carries a task from spec to a wrapped commit through **gates** that no single agent can talk its way past, because each producing role is paired with a role that wins by disagreeing.

Two invariants hold in every repo, including repos with teams:

- **The repo stays untouched.** Nothing this skill creates is committed to it. The adapted script and every artifact live machine-local.
- **The gate is pinned, not guessed.** Each repo's green bar is resolved once at adapt time and observed working, so no run re-derives it.

## Why the auditors are opposed

| Role | Wants | Blind to |
|---|---|---|
| Builder | meet the criteria, smallest diff | nothing |
| UAT gate | find a criterion that FAILS; a pass without probing counts against it | the builder's notes, reads only spec and diff |
| Lens auditor | find every departure from a written standard in this repo | builder and UAT notes |
| Refuter | disprove the auditors, which kills manufactured findings | nothing |
| Scope cutter | delete anything not earning its place | the effort already spent |
| Wrap | an honest package, confirmed findings named as blockers | individual deadlines |

The blindness rules are the product. They live below the FROZEN line in the script for that reason.

## Where things live

```
~/.local/state/workflow-guidance/<repo>-<hash>/
  baseline.js            the adapted copy, which is this repo's configuration
  <workspace>/           one run: NN-stage.md artifacts plus .lock/
```

Resolve the root the same way every time, from anywhere inside the repo:

```sh
COMMON=$(realpath "$(git rev-parse --git-common-dir)")
ROOT="$HOME/.local/state/workflow-guidance/$(basename "$(dirname "$COMMON")")-$(printf %s "$COMMON" | sha256sum | cut -c1-8)"
```

`--git-common-dir` resolves to the same path from a repo and from any of its worktrees, so every worktree of one repo shares one adapted script. The hash keeps two same-named checkouts apart.

## Branch test

Run this first, every invocation, and let it pick the branch:

1. `$ROOT/baseline.js` missing → **Adapt**, then Run.
2. Its `BASE_VERSION` differs from the base's → **Re-adapt**, then Run.
3. Otherwise → **Run**.

## Adapt

Read [`baseline.js`](baseline.js) in this skill directory. Copy it to `$ROOT/baseline.js` and resolve every constant in its ADAPT ZONE against this repo. Edit above the FROZEN line only.

Resolve each pin by looking, not by assuming:

- **VERIFY** is the repo's green bar. Read the Makefile, the `package.json` scripts, the CI workflow, and any verify or test skill the repo ships. It may be `make verify`, `make test`, a test runner plus a typechecker plus a linter, or an agent-browser flow. Write it as shell, however many lines it takes, including any service or database bring-up and a precondition that fails red with a plain instruction rather than hanging. A repo with no suite gets its strongest static checks pinned and reports `VERDICT: unverified`, which blocks wrap.
- **SPEC_SOURCES** names where a task's requirements live: a backlog file, an issue tracker, a wayfinder ticket.
- **SANDBOX** says how UAT observes running behaviour, and names the live ports and services it must leave alone. This pin is what keeps a probe off production.
- **LENSES** stays empty unless the repo has a written standard worth auditing against. A lens with no grounding document invents its own standard and reports noise.
- **PARALLEL_SAFE** is true only when the gate isolates its own database and binds no fixed port. Check the test setup before setting it.
- **WORKTREE_DIR** and **WRAP_POLICY** follow how the repo already integrates work.

Check the copy parses, remembering that the Workflow runtime wraps the script in an async function, so a bare `node --check` reports a false error on its top-level `return`:

```sh
{ echo '(async () => {'; sed 's/^export const meta/const meta/' "$ROOT/baseline.js"; echo '})()'; } > /tmp/wb-check.mjs
node --check /tmp/wb-check.mjs
```

**Adaptation is done when** every ADAPT ZONE constant is resolved for this repo, the parse check passes, and `VERIFY` has been run once in this repo with its result recorded to the human as green, red, or unverified. A plausible command that has never been executed is not a pinned gate.

## Run

```
Workflow({ scriptPath: "$ROOT/baseline.js", args: { task, workdir: "$ROOT/<workspace>" } })
```

`<workspace>` is the task id. Take the lock first:

```sh
mkdir -p "$ROOT" && mkdir "$ROOT/<workspace>/.lock" 2>/dev/null \
  && date -Is > "$ROOT/<workspace>/.lock/owner" \
  || { cat "$ROOT/<workspace>/.lock/owner"; echo "workspace busy"; }
```

`mkdir` is atomic, so it is the lock. When it fails, report who holds the workspace and its start time, and let the human choose to wait or break it. Release by removing `.lock` once the workflow returns.

Optional args: `brief` for scoping the task's own source does not carry, `worktree: true` to build on `task/<id>`, `models` to pin a model per stage keyed by artifact name (`spec`, `build`, `gates`, `uat`, `refute`, `simplify`, `wrap`, or a lens name).

**A run is done when** `08-wrap.md` exists, its confirmed findings have been reported to the human, and the lock is released.

## Resume

Rerun the same command with the same args. Each stage reads its own artifact first and returns immediately when line 1 is `STATUS: complete`, so the run continues from the last finished stage. A red gate writes `STATUS: red` instead, which is what lets a fixed repo reach green on the next attempt.

Artifacts describe the tree they were produced against. `08-wrap.md` records the branch and base commit for that reason. After a branch switch or a rebase under a live workspace, delete the workspace directory and start it again.

## Re-adapt

Copy the current base over `$ROOT/baseline.js`, then carry the previous copy's ADAPT ZONE across constant by constant. The FROZEN half is what the re-adapt is for, so take it wholesale. Re-run the parse check and the `VERIFY` observation before running a task on it.

## Concurrency

Two workspaces run at once when both are true: the repo's `PARALLEL_SAFE` is set, and each run builds in its own worktree (`worktree: true`), which gives it its own branch, its own working tree, and its own workspace directory.

Same task twice at once is a separate case: give the second run its own `<workspace>` name, such as `<task>-b`, so the two do not share artifacts. That is the supported way to race two builders against one task.

With `PARALLEL_SAFE` false, run one workspace at a time. The gates would otherwise collide on a shared port or database and report each other's failures.

## Editing the script

Everything below the FROZEN line defines the gate contract. Before changing or running it, account for every `await agent(` call. A serial stage returning `null` means agent death, so stop the run with `died(stage)` and let the next invocation resume. Only independent fan-out work may drop a null result, and then it must count and report every dropped member.

Invoke the saved workflow by `scriptPath`, never by name. Name invocation may use a session-start snapshot and ignore later edits. Before each run, check that no null result can flow into a later stage and that every resumable artifact has a binary completion status.
