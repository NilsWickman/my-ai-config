# Logic prototype

A single, self-contained HTML file (a **shareable demo**) that lets anyone drive a state model by clicking buttons. Use it when the question is about **business logic, state transitions, or data shape**: the kind of thing that looks reasonable on paper but only feels wrong once you push it through real cases.

One file with nothing to install can go to a non-developer (a client, a domain expert) so they feel the model for themselves. So it speaks their language, not the code's.

## Steps

1. **State the question.** Write down the state model and the question it answers in one paragraph, shown as a visible intro at the top of the demo. A logic prototype that answers the wrong question is waste; an explicit question can be checked later.
2. **Isolate the logic in a portable module.** Put the logic that answers the question in one `<script>` block, written as a small pure module that could be lifted into the real codebase. Pick the shape that fits the question:
   - **A pure reducer** `(state, action) => state`, when actions are discrete events and state is a single value.
   - **A state machine** with explicit states and transitions, when "which actions are legal right now" is part of the question.
   - **A few pure functions** over a plain data type, when there is no current state, only transformations.
   - **A class with a clear method surface**, when the logic owns ongoing internal state.

   No DOM, no `document`, no button handlers inside it. The page calls into the module; nothing flows the other way.
3. **Build the HTML file.** Plain HTML/CSS/JS, everything inline, no framework, bundler or server, so it opens by double-click and survives being emailed. Every label is in **domain language**, not code. Top to bottom:
   1. **Title and one line** on what the demo lets you explore (the question from step 1).
   2. **Current state** as a readable panel (labelled fields, not a JSON dump), re-rendered after every click, with what just changed called out.
   3. **Free-play buttons**: one per action, always available, in any order.
   4. **Guided walkthroughs**: one tab per **scenario**, each with a plain-language description of the situation and what to watch for, then the ordered buttons to press. Each step is a real button that performs the action and moves to the next step. Starting a walkthrough resets to a known initial state. Cover the happy path, a tricky edge case, and an attempt at something that should be illegal.

   Clean typography, generous spacing, one accent colour, no animations.
4. **Hand it over.** Deliver the file the same way the UI branch delivers its link (a DNS name the user can open). The interesting moments are "wait, that shouldn't be possible" or "I assumed X would be different": those are bugs in the idea, which is the point. Add actions or scenarios on request.
5. **Capture the answer.** Once the question is settled, the validated module lifts into the real code and the verdict goes into the issue or commit. The HTML shell stays in the gitignored prototype directory.

## Keep it a prototype

- No tests, no real database (in-memory state unless persistence is the question), no generalising for later.
- The pure module never references the page. Once it does, it is no longer liftable.
- The HTML shell never ships to production; the logic module is the part worth keeping.
