---
name: commitgroup
description: Stage and commit changes in coherent, reviewable groups.
disable-model-invocation: true
---

# Commit Group

Turn a mixed working tree into clean, reviewable commits: inspect the tree, build groups by intent (feature or bugfix scope, refactor-only vs behavior change, tests paired with the code they validate), then stage and commit one group at a time.

- Changes already staged when you arrive are their own first group: never unstage or rewrite them unless the user says otherwise.
- A file with unrelated hunks is split across groups with `git add -p`.
- Prefer several small commits over one mixed commit, each buildable and coherent when possible.
- Never amend or use destructive reset unless explicitly requested.
- Finish by reporting the commits created and anything left uncommitted or intentionally skipped.
