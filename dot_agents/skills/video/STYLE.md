# Narration and pointer style

The presentation layer of every demo video: what the caption bar says and looks
like, and how the pointer moves. Both are implemented in
[`scripts/lib.js`](scripts/lib.js) and configured in
[`scripts/theme.js`](scripts/theme.js). Adapt `theme.js` once per project;
do not restyle captions inside a scene script.

## Make it the product's voice, not an overlay

The single highest-value change is the accent colour. A grey bar over a branded
app reads as a screen recorder's subtitle track; the same bar in the product's
own accent reads as the product talking about itself.

```js
const { adoptAppTheme } = require('./lib');
await page.goto(BASE);
await adoptAppTheme(page, ['--accent', '--brand-500']);  // first one that resolves wins
```

If the app has no usable custom property, set `THEME.accent` by hand from a
screenshot. Pick a colour that already appears in the UI.

## The caption bar

`beat(page, text, ms, opts)` is the unit a scene is built from: it sets the
caption, parks the pointer, and holds for reading time. Use `caption()` alone
only when the text must change mid-action, and always pass its positive `hold`.
The script rejects captions without one.

```js
await beat(page, 'Known companies are filtered out, so every slot is a **new prospect**', 5000);
```

- **Accent emphasis.** Optionally wrap the word that carries the beat in
  `**stars**`. Use it when a caption benefits from a focal point, and skip it
  when the sentence reads fine without one; never more than one per caption.
  The emphasis takes the caption kind's colour, so a `problem` beat highlights
  in red, not in the accent.
- **Kinds.** `narration` (default), `problem`, `result`, `step`. Use `problem`
  when naming what is broken, `result` when showing the payoff, `step` with
  `{kind: 'step', step: 2}` for numbered procedures. Nothing else. A fifth
  colour turns a product demo into a slide deck.
- **Mandatory timer.** Every visible caption carries the drain line along the
  bottom of the bar. It is part of the narration contract, not a theme option.
  `caption()` throws without a positive hold, and A/B mode shares one wall-clock
  timer start across both browsers. Keep this enforcement when adapting scripts.
- **Hold length.** Ordinary navigation 2 to 3 s. Explanatory beats 4.5 to 6 s.
  The drain line empties over exactly that hold, so a long beat reads as
  deliberate pacing rather than a frozen video.
- **Content.** State the user-visible value, not the mechanics. Never use em
  dashes; `cleanOnScreenText` rewrites them, but write clean text anyway.
  Localize for the audience while keeping exact on-screen labels intact.
- **Length.** One idea, roughly one line. The bar wraps at 68% of the viewport,
  and a three-line caption outlasts any hold you are willing to give it.

`callout(selector, text)` stays what it was: a "look here" coach mark for a
specific control. Captions narrate the scene, callouts point at a thing. If a
callout bubble would land in the lower third, hide one of the two for that beat.

## The pointer

Motion is deterministic. Every jitter comes from a seeded PRNG, so two runs of
the same script trace the same path. Never call `Math.random()` in a scene
script; call `rnd()` from the lib. This is what makes the A/B wipe possible
(see [`AB-COMPARISON.md`](AB-COMPARISON.md)), and it also makes a re-record
comparable to the take it replaces.

- **Rest, do not go home.** `beat()` calls `settle()`: if the pointer covers the
  caption or a callout it takes the shortest way out of it, and otherwise only
  drifts a few pixels. Sending it to a fixed corner after every beat is the
  loudest tell that a recording is scripted, because no hand returns to the same
  pixel eight times in a row. If you drive `caption()` directly, call
  `settle(page)` yourself.
- **One travel per beat.** A pointer moving under a caption pulls the eye off
  the text. Settling is a short move at the top of the hold, not a journey.
- **No cursor before the first interaction.** `settle()` leaves the pointer off
  camera until something actually moves it, so an opening beat plays clean.
- **Constant speed.** Travel time comes from distance at `THEME.cursor.speed`
  px/s with a floor and ceiling, so a short hop and a cross-screen move feel
  like the same hand. Do not pass `duration` unless a specific beat needs it.
- **Approach easing.** Short acceleration, long deceleration. Do not replace it
  with a symmetric ease: the give-away that a recording is scripted is a cursor
  that arrives at full speed.
- **Entry.** The pointer starts off camera and flies in from the nearest edge on
  its first move. Do not pre-position it.
- **`hoverBeat(page, sel, ms)`** whenever the hover state itself is the point.
  A `click()` alone gives the hover about 200 ms, which reads as a flicker.
- **`park(page, corner)`** is the override for the rare beat that must clear a
  whole region: `bottom-right` (default), `bottom-left`, `top-right`,
  `top-left`, or `beat(..., {park: 'top-left'})`. Use `{park: false}` to leave
  the pointer exactly where the action left it.
- **`dragTo`** and **`scrollBy`** exist for reorder and long-page beats. Prefer
  `smoothScrollTo(selector)` when you just need an element on screen.

## Checks that catch style problems

- Caption legible at delivery size: extract a frame and read it at 100%.
- Caption true: it must describe what is actually on screen in that frame.
- Timer present on every caption and visibly draining from full to empty. Inspect
  frames near the start, middle and end of every narrated beat.
- Pointer clear of the caption bar and of every callout during each hold, and
  never sitting in the same spot beat after beat.
- Accent colour matches the app: a caption rail in a colour the product never
  uses is the tell that the narration was bolted on.
