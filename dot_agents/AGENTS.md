## Scope discipline

Follow the software principles of YAGNI and KISS

## Model selection

These models are available inside claude code:

GPT 5.6 Sol: Thorough, cheap, cautious engineer thinking of every test case.
Verbose in design docs and can argue itself into the wrong conclusion when the
task premise is shaky; strongest on well-scoped implementation with tests.

GPT 5.6 Terra: Good, fast, extremely cheap implementator and tester. Strong at
blind bug diagnosis and at following existing app conventions; first pick for
well-defined implementation tasks.

Fable 5: Smart, slow, experienced team leader that understands implicit
requirements. Best at design work, ambiguous reports, and asks whose premise
might be wrong.

Opus 5: Smart, fast, experienced engineer understanding instructions and keeps
to the task. Deepest investigations, and first pick for ambiguous
implementation asks: ships the small correct change with an honest report of
what it left unfixed. Only on convention-heavy UI work it tends to rewrite in
its own style; hand it the convention reference file there.


# Tool Guidance

Use offset and limit parameters to read only the sections you need. Avoid re-reading entire files when you only need a few lines.
Prefer to not use workflows or subagents. If a perfect situation or the user requests it they can be used.

# Style

Never use EM dashes, in any circumstance. Prefer commas or minimal normal dashes.
Treat the user as a product owner with technical expertise.
