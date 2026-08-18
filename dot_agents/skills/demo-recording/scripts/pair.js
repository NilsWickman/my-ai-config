// Lockstep recorder for A/B comparison videos: drives two versions of the same
// app through the identical script at the identical moment, producing two
// frame-aligned clips that compose.js wipes between. See AB-COMPARISON.md.
//
// Sync is guaranteed by construction, not by luck: every action is issued to
// both sides in the same tick and awaited together, so a slower version delays
// the faster one instead of drifting away from it.
const path = require('path');
const lib = require('./lib');

// Accepts either one value for both sides, or { before, after } when the two
// versions need different selectors, paths, or text.
function sides(arg) {
  const perSide = arg && typeof arg === 'object' && !Array.isArray(arg) &&
    ('before' in arg || 'after' in arg) && !('x' in arg);
  return perSide ? { before: arg.before, after: arg.after } : { before: arg, after: arg };
}

async function startPair(videoName, {
  before,                 // { base, label }
  after,                  // { base, label }
  authenticate,           // async (context, side) => {}
  viewport,
  seed = lib.DEFAULT_SEED,
} = {}) {
  const vp = viewport || lib.VIEWPORT;
  const sessions = {};
  try {
    // Sequential launch, not Promise.all: two chromium cold starts racing for
    // CPU is the one place where the machine, not the script, sets the pace.
    for (const side of ['before', 'after']) {
      const cfg = side === 'before' ? before : after;
      sessions[side] = await lib.start(`${videoName}/${side}`, {
        base: cfg.base,
        viewport: vp,
        authenticate: authenticate ? (ctx) => authenticate(ctx, side) : undefined,
      });
      const page = sessions[side].page;
      page.__seed = seed;
      page.__rng = lib.makeRng(seed);  // same stream on both sides
    }
  } catch (error) {
    for (const s of Object.values(sessions)) await lib.stop(s).catch(() => {});
    throw error;
  }

  const pages = { before: sessions.before.page, after: sessions.after.page };

  const both = (fn) => Promise.all(['before', 'after'].map((side) => fn(pages[side], side)));
  const pick = (arg, side) => sides(arg)[side];

  return {
    pages,
    labels: { before: before.label, after: after.label },
    viewport: vp,

    goto: (p) => both((pg, s) => lib.goto(pg, pick(p, s))),
    click: (sel, opts) => both((pg, s) => lib.click(pg, pick(sel, s), opts)),
    moveTo: (sel, opts) => both((pg, s) => lib.moveTo(pg, pick(sel, s), opts)),
    hoverBeat: (sel, ms) => both((pg, s) => lib.hoverBeat(pg, pick(sel, s), ms)),
    typeInto: (sel, text) => both((pg, s) => lib.typeInto(pg, pick(sel, s), pick(text, s))),
    caption: (text, opts = {}) => {
      const timerStartedAt = Date.now();
      return both((pg, s) => lib.caption(pg, pick(text, s), { ...opts, timerStartedAt }));
    },

    // Same as lib.beat(), except the rest spot and mandatory timer start are
    // computed once and imposed on both sides. The pointer settles relative to
    // where it last acted, and the two versions put their controls in different
    // places, so per-side settling would leave two cursors a few dozen pixels
    // apart, visible as a double pointer for the length of the sweep.
    async beat(text, ms = 4500, opts = {}) {
      const startedAt = Date.now();
      await both((pg, s) => lib.caption(pg, pick(text, s), {
        ...opts, hold: ms, timerStartedAt: startedAt,
      }));
      if (typeof opts.park === 'string') await both((pg) => lib.park(pg, opts.park));
      else if (opts.park !== false) {
        const restAt = await lib.restPoint(pages.after, opts);
        if (restAt) await both((pg) => lib.settle(pg, { ...opts, restAt }));
      }
      const left = ms - (Date.now() - startedAt);
      if (left > 0) await both((pg) => lib.pause(pg, left));
    },
    // A null selector for one side skips it. Use { before: null, after: sel }
    // for a callout after the sweep: only the new version is on camera then,
    // and the control being pointed at often does not exist in the old one.
    callout: (sel, text) => both((pg, s) =>
      (pick(sel, s) ? lib.callout(pg, pick(sel, s), pick(text, s)) : null)),
    hideCaption: () => both((pg) => lib.hideCaption(pg)),
    hideCallout: () => both((pg) => lib.hideCallout(pg)),
    park: (corner) => both((pg) => lib.park(pg, corner)),
    settle: async (opts = {}) => {
      const restAt = await lib.restPoint(pages.after, opts);
      if (restAt) await both((pg) => lib.settle(pg, { ...opts, restAt }));
    },
    scrollBy: (dy, steps) => both((pg) => lib.scrollBy(pg, dy, steps)),
    pause: (ms) => both((pg) => lib.pause(pg, ms)),

    // Escape hatch for anything the wrappers do not cover. The callback gets
    // (page, side) and both sides still run in the same tick.
    each: both,

    // Flash both pages black for a moment. Playwright starts recording when a
    // context is created, and the two contexts cannot be created at the same
    // instant, so the clips do not share a t=0. compose.wipe() finds this flash
    // in each file and aligns on it. Call it once, after both pages are ready
    // and before the first caption.
    async sync(ms = 300) {
      // Playwright's recording only starts at the page's first paint, and two
      // browsers do not paint at the same instant: measured 0.5 s apart on a
      // local page. Flash too early and the marker falls before the slower
      // clip's first frame, which is worse than no marker at all because the
      // fallback then looks like it worked. Let both files start first.
      await both((pg) => lib.pause(pg, 900));
      await both((pg) => pg.evaluate((d) => {
        const el = document.createElement('div');
        el.id = 'demo-sync';
        Object.assign(el.style, {
          position: 'fixed', inset: '0', background: '#000',
          zIndex: 2147483647, pointerEvents: 'none',
        });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), d);
      }, ms));
      await both((pg) => lib.pause(pg, ms + 250));
    },

    // Closes both contexts and writes the two clips to fixed names so compose()
    // does not have to guess Playwright's generated filenames. saveAs pulls the
    // artifact over the browser connection, so the context is flushed first and
    // the browser only closes once both files are on disk.
    async stop(outDir = `${lib.RAW_DIR}/${videoName}`) {
      const videos = { before: pages.before.video(), after: pages.after.video() };
      const out = {};
      try {
        await Promise.all([sessions.before.context.close(), sessions.after.context.close()]);
        for (const side of ['before', 'after']) {
          out[side] = path.resolve(outDir, `${side}.webm`);
          await videos[side].saveAs(out[side]);
        }
      } finally {
        await Promise.all([
          sessions.before.browser.close().catch(() => {}),
          sessions.after.browser.close().catch(() => {}),
        ]);
      }
      return out;
    },
  };
}

module.exports = { startPair };
