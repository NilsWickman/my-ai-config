# A/B comparison videos

An opinionated **mode on top of the narration layer**, not a separate kind of
video: the same task, driven identically through two versions of the product,
joined by a divider that sweeps across the frame and replaces the old version
with the new one in place. Use it when the difference between two versions is
what attention must be steered to.

Captions, callouts and pointer behaviour are unchanged and non-negotiable here:
everything in [`STYLE.md`](STYLE.md) still applies, and the wipe is one more
beat inside an otherwise ordinary narrated scene. This extends step 3 of
[`SKILL.md`](SKILL.md); steps 1, 2, 4, 5 and 6 apply as written.

## Use it when, and only when

Use it when the difference is **visible in a single frame**: layout, density,
what a screen shows at rest, how much noise surrounds the thing that matters.
The wipe puts old and new in the same screen position, which is the only way an
eye compares fine detail reliably.

Do not use it when the difference is **temporal**: fewer steps, less waiting,
one click instead of four. A wipe cannot show that, because both sides are
pinned to the same moment in the scene. Record two ordinary walkthrough clips
and cut between them, or state the difference in a caption over the new version.

Side by side was considered and rejected. Halving the width makes product text
unreadable after the downscale to 1080p, and two panels ask the viewer to
compare across a gap instead of in place.

## The rig

[`scripts/pair.js`](scripts/pair.js) drives both versions from one script. Every
action is issued to both in the same tick and awaited together, so a slower
version delays the faster one instead of drifting away from it. Both pages get
the same seeded random stream, so the pointer traces the same path on both.

`pair.beat()` also computes the pointer's rest spot **once** and imposes it on
both sides. The pointer settles relative to what it last touched, and the two
versions put their controls in different places, so per-side settling would
leave two cursors a few dozen pixels apart, which the sweep then shows as a
double pointer.

The mandatory caption timer also receives one shared wall-clock start. Its width
is derived from elapsed time on every frame, so both browsers stay aligned even
when one evaluates the caption a frame later. Keep the timer in both raw clips;
removing it to avoid seam drift violates the narration contract.

```js
const { startPair } = require('./pair');
const { wipe } = require('./compose');

const pair = await startPair('sessions-ab', {
  before: { base: 'http://localhost:4123', label: 'Upstream' },
  after:  { base: 'http://localhost:8080', label: 'Ours' },
  authenticate: async (context, side) => { /* same cookie jar trick, per side */ },
});

await pair.goto('/sessions');
await pair.pages.before.waitForSelector('[data-session-row]');
await pair.pages.after.waitForSelector('[data-session-row]');
await pair.sync();                       // REQUIRED, see below

await pair.beat('The same six sessions, in both versions', 4500);
await pair.click('[data-session-row]');  // or { before: '.row', after: '[data-session-row]' }
await pair.beat('Status now lives on the **row itself**', 5000, { kind: 'result' });
await pair.hideCaption();

const clips = await pair.stop();
wipe({
  ...clips,
  out: '/srv/demos/myapp/sessions-ab.mp4',
  at: 7.5, duration: 1.2,
  labels: { before: 'Upstream', after: 'Ours' },
  labelPos: 'bottom',
});
```

Any value can be given per side as `{ before, after }`: paths, selectors,
caption text. Use `pair.each((page, side) => ...)` for anything the wrappers do
not cover.

### Time the sweep from the script, not by hand

A hardcoded `at` is guesswork that a slightly slower page load invalidates, and
the failure is silent: the divider crosses a click instead of a hold. Measure
instead. Take a timestamp when `sync()` returns and let the beat that owns the
sweep report where it landed:

```js
const clock = { t0: 0, at: null };
// ... await pair.sync(); clock.t0 = Date.now();

async function sweepBeat(pair, text, ms, opts = {}) {
  await pair.caption(text, { ...opts, hold: ms });
  await pair.settle();
  clock.at = (Date.now() - clock.t0) / 1000 + 0.25 + 0.9;  // sync tail, then into the hold
  await pair.pause(ms);
}
```

The 0.25 is the tail `sync()` holds after the flash clears; 0.9 puts the sweep
that far into the hold. Keep `hold > 0.9 + duration + 1.5` so the beat has
reading time left on the far side of the sweep.

### pair.sync() is not optional

Playwright records from the page's **first paint**, and two browsers do not
paint at the same instant: half a second apart is normal for a local page.
Without a sync marker the two files are offset by that much, which is enough to
show one caption on the left of the divider and the next caption on the right.

`pair.sync()` flashes both pages black for 300 ms; `wipe()` finds that flash
with `blackdetect` and aligns on it. Call it once, after both pages are ready
and before the first caption. Two things it handles that are easy to get wrong
if you write your own:

- It **waits before flashing**, so both files have started. Flash too early and
  the marker falls before the slower clip's first frame: that clip then has no
  marker at all, and the fallback silently misaligns the seam.
- `blackdetect` runs at a low `pix_th`. A dark product UI sits around luma 20,
  and a looser threshold reports the whole clip as one endless black stretch,
  which reads exactly like "no marker found".

`wipe()` throws when only one of the two clips carries the marker, because
aligning on it would be worse than not aligning at all. Re-record; never nudge
`at` by hand.

## Editorial rules

- **Sweep during a hold, never during an action.** Pick `at` inside a reading
  pause where nothing on screen is animating, so the divider is the only motion
  in the frame. A sweep over a click or a list update reads as a glitch.
- **One sweep per clip.** Two at most, and only as there-and-back on the same
  screen. Every extra sweep costs the viewer the position they had learned.
- **Sweep duration 0.9 to 1.4 s.** Faster reads as a cut, slower reads as a
  slideshow transition.
- **The caption the sweep runs under must be true of both sides.** It reads
  continuously across the divider while both halves are visible, so a claim
  about one version is a lie on the other half of the seam. The beats around it
  are free: before the sweep only the old version is on camera and the caption
  may describe it, after the sweep only the new one is.
- **Point at the new version after the sweep, not during.** A post-sweep
  `callout` is placed on that side only, `{ before: null, after: selector }`,
  which is also the only way to point at a control the old version does not
  have. This is where a comparison earns its keep: the sweep shows the change,
  the callout says what it buys.
- **Badges go where the app's chrome is not.** `labelPos: 'bottom'` when the app
  has a header; the default `'top'` collides with it.
- **Identical framing.** Same viewport, same scroll position, same seeded
  pointer path. `startPair` enforces the viewport; the lockstep wrappers enforce
  the rest as long as you never drive one page directly.
- **The comparison must be honest.** Same data, same starting state, same task.
  If the old version genuinely looks better in some frame, that is a product
  finding to report, not a frame to crop.

## Touring a whole system

For "show me the system, old versus new", do not stretch one recording across
several screens. Record **one pair per screen**, give each its own sweep, and
join the verified scene clips:

```js
join(
  [{ file: 'full-overview.mp4', start: 0.15, end: 25.40 }, /* ... */],
  out, { dip: 0.32, fadeOut: 0.6 },
);
```

- **Dip to black between scenes, do not crossfade.** Two scenes of the same
  product share a layout, so a dissolve ghosts every label into its neighbour
  and reads as a rendering bug. The dip also absorbs the fact that each scene
  restarts on the old version after the previous one ended on the new one.
- **Navigate inside a scene, not across scenes.** A scene that starts on the
  list, clicks into the detail and then sweeps shows a flow rather than a
  screenshot. Put the sweep after the navigation, in the following hold.
- **Give each screen the full kit, not just a sweep.** A tour of four sweeps in
  a row is a slideshow. Filter or search before the sweep so the comparison
  lands on a state the viewer watched being built, and point at the payoff with
  a post-sweep callout. Budget roughly 24 s for a screen with interaction
  against 20 s for one without.
- **Hold about 2 s after `hideCaption()` before `stop()`.** Playwright drops
  the last frames when the context closes, and without the hold the final beat
  loses part of its reading time. `join()` trims the tail with `end`.
- **Find each `end` instead of estimating it.** The last change inside the
  caption strip is `hideCaption()`; cut a third of a second after it:
  `ffmpeg -i scene.mp4 -vf "crop=1100:130:250:770,select='gt(scene,0.03)',metadata=print:file=-" -f null -`
- Keep the whole tour under 90 s. Four screens with interaction lands near 92 s,
  which is the ceiling, not the target; a fifth belongs in a second video.

## Review checklist, in addition to step 4

- At a frame mid-sweep, the caption reads continuously across the divider with
  no horizontal offset in the text.
- The timer line is present on both halves, has the same width across the divider,
  and continues draining throughout the sweep.
- The divider hairline is visible on both halves, including over light UI.
- The corner badge hands over as the divider passes it, and never labels a
  strip of the version it is not describing.
- `wipe()` printed no drift warning and no missing-sync warning.
- Both halves show the same scroll position and the same records.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "no sync flash found" in either clip | `pair.sync()` missing, or a page painted over it | Call `sync()` after both pages are ready; check nothing else holds z-index 2147483647 |
| "the sync flash is in X but not in Y" | the flash fell before the slower clip's first frame | Let both pages paint longer before flashing; `pair.sync()` already waits 900 ms, raise it on a slow app |
| Two cursors visible during the sweep | one side was driven directly, or a pointer move was not lockstepped | Drive everything through the `pair.*` wrappers; `pair.beat()` already shares one rest spot |
| "the two aligned clips differ by Ns" | one version genuinely stalled on some action | Fix the wait in the script, or accept it as a product finding and say so |
| Divider stuck at the frame edge | a hand-written `drawbox` divider | `drawbox` evaluates `x` once at init; the divider must be a moving `overlay`, which is what `wipe()` does |
| Text on one half only | that version puts its content where the other has whitespace | Choose a scene where both versions fill the same region, or drop to two separate clips |
