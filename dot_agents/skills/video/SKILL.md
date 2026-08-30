---
name: video
description: Record self-narrating product walkthrough videos of web apps with Playwright, including before/after A/B comparisons of two versions joined by a sweeping divider. Use when the user asks to record a demo, walkthrough, or feature showcase video of a web UI, wants a before-and-after or old-vs-new comparison video, or wants video evidence of a workflow for feedback or documentation.
disable-model-invocation: true
---

# Demo walkthrough videos

Produce narrated screen recordings of a web app by scripting Playwright with
`recordVideo`, burning captions into the DOM, and **reviewing your own footage
frame-by-frame** until it passes. No audio by default. Use ffmpeg for trimming,
transitions, and delivery encoding; editing may polish pacing, but must never
hide a product defect or fabricate behavior.

## How the pieces stack

**Narration is the base layer of every video here**, not one style among
several. The caption bar, callouts and the pointer are how attention gets
steered in any recording this skill produces. Read [`STYLE.md`](STYLE.md)
before writing the first caption, always.

**A/B comparison is a mode layered on top of that**, not an alternative to it.
Reach for it when the thing attention must be steered to is the *difference*
between two versions of the same screen (old vs new, upstream vs fork): it adds
a second browser driven in lockstep and a divider that sweeps the new version
over the old one in place. It extends step 3 only; steps 1, 2, 4, 5 and 6 and
all of `STYLE.md` apply unchanged. See [`AB-COMPARISON.md`](AB-COMPARISON.md).

The default, with no A/B, is a single-version walkthrough: the steps below with
`STYLE.md` applied. Do not produce a separate video to show off the narration
layer; it belongs inside the product video, wherever it goes.

## Steps

1. **Stage demo state with a story.** Real features demand real data: seed the
   app so every scene shows the product genuinely working (create the records,
   run the crons, trigger the events beforehand). Give data a narrative
   (named companies, a before/after change) — viewers follow stories, not
   fixtures.
   **Stage with the camera off, and cache what you staged.** When the product
   itself is a long-running process, the temptation is to start it and film the
   whole thing; that puts the process duration into the raw file and charges it
   again on every retake. Instead let the staging script run the process to
   completion headless, record the resulting URL/id to a small JSON file, and
   have the recording script open that. Only a scene showing *genuine
   progression* needs a live run, and it needs one that has just started, not
   one filmed to completion. Decoupling is not free on a first take: the
   process now runs before the take instead of underneath it, so it pays off
   when the process outlasts the take (a 730 s run behind a 100 s video) and
   costs you a little when it does not (a 47 s run behind a 95 s video). It
   pays on *every retake* regardless, since a cached finished state means the
   retake starts no run at all. Done when: clicking through the flow manually
   shows exactly what the video should show, and re-running the staging script
   reuses the finished state instead of rebuilding it.
2. **Set up the recording workspace.** A scratch dir with `npm i playwright`
   + `npx playwright install chromium`, and a copy of `scripts/` (`lib.js`,
   `theme.js`, `compose.js`, plus `pair.js` for A/B). Adapt `lib.js` to the app
   (authentication, BASE URL, viewport) and `theme.js` to its brand: point
   `THEME.accent` at the product's own accent, or call `adoptAppTheme(page)` to
   read it out of the app's CSS variables.
   **Do not show login unless the user asks for it.** Authenticate
   before creating the first recorded page: either save `storageState` from a
   throwaway context, or authenticate through the recording context's request
   API so its cookie jar is ready before `newPage()`. Done when: a trivial
   start/stop script opens directly on a fully rendered feature page and yields
   a playable `.webm`.
3. **Write one script per feature as a narrative.** Default to one recording
   context/clip per scene, not one long take: a retake then refilms the scene
   that failed instead of the four good ones before it, and `join()` puts them
   back together at no cost. A full page load or device change between scenes
   makes it mandatory, since it flashes on camera. Splitting is not free
   though — each scene re-enters the app (page load, wait for its anchor,
   settle), so a scene costs several seconds before its first beat. Measured on
   ThreadForge, going from two chapters to four scenes added ~16 s to a 94 s
   take. Split by what you would retake independently, not as finely as
   possible, and make re-entry wait on the scene's anchor selector rather than
   `networkidle` plus a guessed settle.
   **Never let the camera roll on a wait.** A scene must not contain a wait for
   backend work to finish; that wait belongs in the staging script of step 1.
   If a scene needs a state that takes minutes to reach, film it against the
   staged finished state and keep the live scene to the progression that is
   genuinely worth watching. Every scene is
   `wait for visible stable state → beat(text, ms) → action`; `beat()` sets the caption, starts its mandatory drain timer, settles
   the pointer clear of it and holds for *reading time* of the caption, not action
   time. The copied `lib.js` rejects captions without a positive hold and has no
   switch for removing the timer; preserve that enforcement when adapting it.
   Drive every interaction through the
   lib's `moveTo`/`click`/`hoverBeat`/`typeInto` wrappers — they animate a
   visible cursor with human easing and a click pulse; a raw `locator.click()`
   teleports invisibly and reads as scripted. Use `callout(selector, text)` for
   "look here" beats (highlight ring + pointing bubble) and keep captions for
   scene-level narration; remove it with `hideCallout()` before the next action.
   Captions state the user-visible value ("known companies are filtered out, so
   every slot is a new prospect"), not the mechanics; optionally mark the word
   that carries the beat with `**stars**` for accent emphasis. Never use em dashes in
   on-screen text (captions, callouts, title cards). Localize captions for the
   audience, while retaining exact on-screen labels where that aids recognition.
   Give beats time to breathe without being rushed or snoozing.
   Caption kinds, hold lengths and pointer rules are in
   [`STYLE.md`](STYLE.md). End every chapter, and the recording itself, with
   `cutPoint(page)` rather than a bare `hideCaption()`. Done when: every
   scene prints its done-marker and contains no intentional loading or login
   footage.
4. **Review the footage.** Run [`scripts/review.js`](scripts/review.js) on every
   clip: `node review.js videos-raw/*/*.webm`. It does the mechanical checks
   (freezes, black lead-in and tail, duration) and renders **two images per
   clip** — a timestamped contact sheet of the whole clip, and a crop of the
   caption band stacked one sample per row so caption text stays readable.
   *Look at both.* Do not go back to reading one extracted PNG per frame: it is
   the slowest part of the whole skill, and most of those frames show a caption
   already checked in the frame before.
   Check: no empty lists, no placeholder/junk names, no error toasts, no login
   or blank loading frames, no mid-transition captures on key screens, captions
   legible and true, every caption timer visible and draining from full to empty,
   and each visual callout encloses the intended UI without colliding with a
   caption. A tile that looks wrong maps straight to its timestamp: pull that one
   frame at full resolution with `node review.js --frame 12.5 clip.webm`, and
   inspect at 1 fps around a scene boundary only when hunting a flicker the sheet
   hinted at. Any frozen stretch the report flags that is longer than its
   caption's reading pause is dead air to cut or re-pace, not to ship. A flaw in
   the *product* seen on camera is a bug to fix in the product, not to crop out.
   Done when: both images per clip, and every transition, would pass a human
   reviewer. A CLEAN verdict is not a pass on its own; it only means nothing
   mechanical was caught.
5. **Fix and re-record.** Repair data/script/product, delete the old raw dir,
   re-run, re-review. Selector fights (intercepted pointer events, hidden
   hover checkboxes) are normal — see
   [`PLAYWRIGHT-TRICKS.md`](PLAYWRIGHT-TRICKS.md). Done when: step 4 passes
   for all videos.
6. **Assemble and finalize.** Trim each clip's blank/loading lead-in and
   trailing dead air, then join and encode in one pass with `join(scenes, out,
   {dip, crossfade, fadeOut})` from [`scripts/compose.js`](scripts/compose.js);
   a scene may be given as `{file, start, end}` so the trim happens in the same
   encode. Dip to black (0.3–0.4 s) between scenes that share a layout, since a
   dissolve there ghosts each label into its neighbour; use a 0.3–0.5 s
   crossfade only when the scenes look nothing alike, and hard cuts when they
   are visually cleaner. For a single clip use `encode(input, out, {fadeOut:
   0.5})`, or `libx264` CRF 23 `-movflags +faststart` by hand.
   Re-extract frames at every computed join and inspect
   them before delivery. Use descriptive kebab-case names
   (`product-1-feature.mp4`), deliver to a durable directory (rules below), and
   clean up demo residue created in the app. Done when: duration is verified via
   ffprobe and the path is reported — as an **absolute path** if the chat UI
   renders inline video.

   Delivery durability rules: a shared link or inline chat render streams the
   file from its absolute path, so the link lives exactly as long as the file.
   Never deliver into a scratch, `.tmp`, or raw-recordings tree (later cleanup
   silently kills every previously shared link), and never trust a
   `~`-relative path: in sandboxed agent sessions `$HOME` is not the real home,
   so check `echo $HOME` and report the real absolute path. Ask for, or create,
   a durable delivery directory outside any temp tree, and reuse the same one
   for every recording of a given project.

## Reference

- Caption bar = the whole narration system: a fixed-position DOM element
  injected by `page.evaluate` (survives soft navigations within an SPA;
  re-inject after full page loads — `caption()` handles both). Its colours,
  variants and emphasis markup are in [`STYLE.md`](STYLE.md).
- Pointer motion is deterministic: all jitter comes from a seeded PRNG, so a
  re-record is comparable to the take it replaces. Never call `Math.random()`
  in a scene script; use `rnd()` from the lib. Between beats the pointer rests
  where it acted rather than returning to a corner; see [`STYLE.md`](STYLE.md).
- Frame rate `-r 0.2` (1 frame/5s) matches the 3-5s scene pacing: roughly
  one frame per scene. Use `-r 1` around joins and page reloads when hunting a
  flicker; extract exact boundary frames with `ffmpeg -ss <seconds> -frames:v 1`.
- The cursor overlay is an `addInitScript` that mirrors real `mousemove`/
  `mousedown` events, so it survives navigations and needs no per-scene code;
  `moveTo` animates the real Playwright mouse (hover states are genuine).
  If a callout bubble would sit in the lower third, the caption bar may
  collide — hide one of them for that beat.
- Give the script a no-record `--probe` mode that navigates each scene,
  verifies every callout selector, and prints the measured wall-clock time of
  every transition wait (page load, polling loop, backend event). Treat a
  missing selector as a failure, and equally any measured wait over ~5 s that
  is not a scripted reading pause: shrink it in the rig before recording
  (pre-trigger the event, tighten the poll) or, when the wait is inherent,
  note its timestamps as a planned cut for assembly. Then inspect sampled
  frames from every explanatory beat after the real render.
- Keep raw recordings per-video and per-scene in separate directories
  (`videos-raw/<name>/<scene>/`). Re-record a flawed scene rather than masking
  incorrect product behavior; assembling verified scene clips is expected.
- **No maximum length.** Record the whole story, then decide one video or
  several at assembly time. A viewer who asked for the walkthrough is not
  scrolling past it, and cutting a chapter to hit a number loses more than the
  length costs. What actually loses viewers is a beat that earns nothing, so
  cut those instead, at any duration.
  End every chapter with `cutPoint(page)`: overlays hidden, pointer parked, the
  result held still for ~1.5 s. That still stretch is a clean seam, so a single
  recording can be split into per-feature videos later without re-recording.
  Split when the chapters serve different audiences or answer different
  questions, not when the clock passes a threshold.
