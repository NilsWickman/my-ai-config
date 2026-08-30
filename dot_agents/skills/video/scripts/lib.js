// Shared helpers for demo walkthrough recordings. Adapt start() to the app
// under test (BASE, authentication, readiness) and theme.js to its brand; the
// rest is app-agnostic.
//
// Human-feel layer: a fake cursor overlay is injected via addInitScript and
// follows the *real* Playwright mouse (so hover states are genuine). Always
// drive interactions through moveTo()/click()/typeInto() — raw locator.click()
// teleports and looks scripted on camera.
//
// Motion is DETERMINISTIC: every jitter comes from a seeded PRNG, so two runs
// of the same script produce the same cursor path. That is what makes the A/B
// wipe in compose.js line up (see AB-COMPARISON.md).
const { chromium } = require('playwright');
const { THEME, adoptAppTheme, cleanOnScreenText, renderMarkup } = require('./theme');

const BASE = process.env.DEMO_BASE_URL || 'http://localhost:8080';
const RAW_DIR = process.env.DEMO_RAW_DIR || `${__dirname}/videos-raw`;
const VIEWPORT = { width: 1600, height: 900 };

// --- deterministic randomness -----------------------------------------------
// Seeded so identical scripts trace identical cursor paths. Never call
// Math.random() in a recording script; call rnd() instead.
const DEFAULT_SEED = Number(process.env.DEMO_SEED || 20260810);

function makeRng(seed = DEFAULT_SEED) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let globalRng = makeRng();
const rnd = () => globalRng();
const resetRandom = (seed = DEFAULT_SEED) => { globalRng = makeRng(seed); };

// Each page can own a private stream. pair.js gives both sides the same seed,
// so lockstep actions that interleave in the event loop still trace identical
// cursor paths on both recordings.
const pageRnd = (page) => (page && page.__rng) || rnd;

// Rest spots draw from their own stream. In pair mode only one side computes
// the spot (see pair.js), and if that came out of the pointer stream the two
// sides would fall out of step from the next click onwards.
function restRnd(page) {
  if (!page.__restRng) page.__restRng = makeRng(((page.__seed || DEFAULT_SEED) ^ 0x9e3779b9) >>> 0);
  return page.__restRng;
}

// --- session ----------------------------------------------------------------

async function start(videoName, { authenticate, base, viewport } = {}) {
  const vp = viewport || VIEWPORT;
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 2,
      recordVideo: { dir: `${RAW_DIR}/${videoName}`, size: vp },
    });
    await context.addInitScript(cursorInitScript, {
      size: THEME.cursor.size,
      halo: THEME.cursor.haloOpacity,
      accent: THEME.accent,
    });

    // Authenticate before creating the first recorded page, so login is never
    // captured. The callback can use context.request (shared cookie jar), or
    // newContext() above can load a pre-authenticated storageState.
    if (authenticate) await authenticate(context);
    const page = await context.newPage();
    page.__cursor = null; // null = off camera; the first move glides in
    page.__base = base || BASE;
    page.__viewport = vp;
    return { browser, context, page };
  } catch (error) {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

async function stop({ browser, context }) {
  try {
    await context.close(); // flushes the video file
  } finally {
    await browser.close();
  }
}

async function goto(page, path) {
  const url = /^https?:/.test(path) ? path : `${page.__base || BASE}${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// --- cursor overlay ---------------------------------------------------------
// Runs in the page on every navigation: draws a cursor that tracks real mouse
// events, plus a click-pulse ring on mousedown. pointer-events: none, so it
// never intercepts the interactions it is filming.
function cursorInitScript({ size, halo, accent }) {
  const ensure = () => {
    if (document.getElementById('demo-cursor') || !document.body) return;
    const cur = document.createElement('div');
    cur.id = 'demo-cursor';
    cur.innerHTML =
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">` +
      `<circle cx="8" cy="8" r="9" fill="rgba(0,0,0,${halo})"/>` +
      '<path d="M5 2 L5 18 L9.5 14.5 L12.5 21 L15 20 L12 13.5 L18 13 Z" ' +
      'fill="#fff" stroke="#141414" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    Object.assign(cur.style, {
      position: 'fixed', left: '-60px', top: '-60px', zIndex: 2147483647,
      pointerEvents: 'none', margin: '0',
    });
    document.body.appendChild(cur);
  };
  document.addEventListener('mousemove', (e) => {
    // Page loads fire a synthetic move at (0,0); a scripted move never lands
    // there, so ignoring it keeps the pointer off camera until it really moves.
    if (e.clientX === 0 && e.clientY === 0) return;
    ensure();
    const cur = document.getElementById('demo-cursor');
    if (cur) { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }
  }, true);
  document.addEventListener('mousedown', (e) => {
    ensure();
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '10px', height: '10px', border: `3px solid ${accent}`, borderRadius: '50%',
      transform: 'translate(-50%,-50%) scale(1)', opacity: '0.9',
      pointerEvents: 'none', zIndex: 2147483646,
      transition: 'transform 450ms ease-out, opacity 450ms ease-out',
    });
    document.body.appendChild(ring);
    requestAnimationFrame(() => {
      ring.style.transform = 'translate(-50%,-50%) scale(4)';
      ring.style.opacity = '0';
    });
    setTimeout(() => ring.remove(), 600);
  }, true);
  document.addEventListener('DOMContentLoaded', ensure);
}

// --- pointer motion ---------------------------------------------------------

async function targetPoint(page, target) {
  const loc = typeof target === 'string' ? page.locator(target).first() : target.first();
  await loc.waitFor({ state: 'visible' });
  const box = await loc.boundingBox();
  if (!box) throw new Error('moveTo: target has no bounding box');
  const r = pageRnd(page);
  return {
    x: box.x + box.width / 2 + (r() - 0.5) * Math.min(10, box.width / 4),
    y: box.y + box.height / 2 + (r() - 0.5) * Math.min(6, box.height / 4),
  };
}

// Short acceleration, long deceleration: a hand approaches a target the way
// Fitts's law predicts, not with a symmetric ease-in-out.
function easeApproach(t) {
  const inOut = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const out = 1 - Math.pow(1 - t, 3);
  return 0.25 * inOut + 0.75 * out;
}

// Where the cursor enters from when it is off camera: just outside the nearest
// viewport edge, so it flies in rather than materialising mid-screen.
function entryPoint(page, to) {
  const vp = page.__viewport || VIEWPORT;
  const gaps = [
    { d: to.x, p: { x: -40, y: to.y } },
    { d: vp.width - to.x, p: { x: vp.width + 40, y: to.y } },
    { d: to.y, p: { x: to.x, y: -40 } },
    { d: vp.height - to.y, p: { x: to.x, y: vp.height + 40 } },
  ];
  return gaps.sort((a, b) => a.d - b.d)[0].p;
}

// Animate the real mouse along a slightly curved path at a roughly constant
// speed, so the overlay cursor (which tracks mousemove) travels like a hand.
async function moveTo(page, target, { duration } = {}) {
  const to = typeof target === 'object' && 'x' in target ? target : await targetPoint(page, target);
  const from = page.__cursor || entryPoint(page, to);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist < 2) { page.__cursor = to; return to; }
  const c = THEME.cursor;
  const ms = duration || Math.min(c.maxMs, Math.max(c.minMs, (dist / c.speed) * 1000));
  // Quadratic bezier: control point off the midpoint, perpendicular to travel.
  const bend = Math.min(80, dist * 0.15) * (pageRnd(page)() < 0.5 ? -1 : 1);
  const mx = (from.x + to.x) / 2 - ((to.y - from.y) / dist) * bend;
  const my = (from.y + to.y) / 2 + ((to.x - from.x) / dist) * bend;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = easeApproach(i / steps);
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mx + t ** 2 * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * my + t ** 2 * to.y;
    await page.mouse.move(x, y);
    await page.waitForTimeout(ms / steps);
  }
  page.__cursor = to;
  return to;
}

// Human click: glide to the element, settle, then a real mouse click at that
// point (the init-script ring provides the visual feedback).
async function click(page, target, opts = {}) {
  const point = await moveTo(page, target, opts);
  await page.waitForTimeout(180 + pageRnd(page)() * 120);
  await page.mouse.click(point.x, point.y);
}

// Move and dwell so the hover state actually renders on camera before the
// next beat. Use it whenever the hover reveals something worth seeing.
async function hoverBeat(page, target, ms = 900) {
  await moveTo(page, target);
  await page.waitForTimeout(ms);
}

async function dragTo(page, from, to) {
  const a = await moveTo(page, from);
  await page.waitForTimeout(160);
  await page.mouse.down();
  await moveTo(page, to, { duration: 700 });
  await page.waitForTimeout(160);
  await page.mouse.up();
  return a;
}

// Human typing: click the field, then per-character keystrokes with jitter.
async function typeInto(page, target, text) {
  await click(page, target);
  await page.waitForTimeout(150);
  const r = pageRnd(page);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(60 + r() * 80);
  }
}

// Where the pointer should rest during a reading hold.
//
// Sending it to a fixed corner after every beat is the single loudest tell that
// a recording is scripted: no hand returns to the same pixel eight times in a
// row. So the rule is "get out of the way, then relax": if the pointer does not
// cover the caption or a callout it only drifts a little, and if it does, it
// takes the shortest exit out of what it is covering.
//
// Returns null when the pointer is still off camera, so an opening beat plays
// with no cursor in frame at all.
async function restPoint(page, { margin = THEME.park.rest.margin } = {}) {
  const cur = page.__cursor;
  if (!cur) return null;
  const vp = page.__viewport || VIEWPORT;
  const boxes = await page.evaluate(() =>
    ['demo-caption', 'demo-callout', 'demo-callout-ring']
      .map((id) => document.getElementById(id))
      .filter((el) => el && el.style.display !== 'none')
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }));

  const r = restRnd(page);
  const inset = 40;
  const clamp = (v, hi) => Math.max(inset, Math.min(hi - inset, v));
  const fits = (p) => p.x > inset && p.x < vp.width - inset && p.y > inset && p.y < vp.height - inset;
  const covers = (p) => boxes.find((b) =>
    p.x > b.x - margin && p.x < b.x + b.w + margin &&
    p.y > b.y - margin && p.y < b.y + b.h + margin);

  if (!covers(cur)) {
    // Out of the way already: a small relaxing drift, not a trip home.
    const [lo, hi] = THEME.park.rest.drift;
    const angle = r() * Math.PI * 2;
    const d = lo + r() * (hi - lo);
    return { x: clamp(cur.x + Math.cos(angle) * d, vp.width), y: clamp(cur.y + Math.sin(angle) * d, vp.height) };
  }

  // In the way: step out of each overlapping box by its nearest edge. Loops
  // because leaving the caption can land the pointer inside a callout.
  let p = cur;
  for (let i = 0; i < 4; i++) {
    const b = covers(p);
    if (!b) break;
    const exits = [
      { d: p.x - (b.x - margin), p: { x: b.x - margin - 10, y: p.y } },
      { d: (b.x + b.w + margin) - p.x, p: { x: b.x + b.w + margin + 10, y: p.y } },
      { d: p.y - (b.y - margin), p: { x: p.x, y: b.y - margin - 10 } },
      { d: (b.y + b.h + margin) - p.y, p: { x: p.x, y: b.y + b.h + margin + 10 } },
    ].filter((e) => fits(e.p)).sort((m, n) => m.d - n.d);
    if (!exits.length) break;
    p = exits[0].p;
  }
  // Jitter so repeated exits from the same caption do not stack on one pixel,
  // dropped if it would push the pointer back into what it just left.
  const j = { x: clamp(p.x + (r() - 0.5) * 30, vp.width), y: clamp(p.y + (r() - 0.5) * 20, vp.height) };
  return covers(j) ? p : j;
}

// Move the pointer to its rest spot for a hold. Pass restAt to impose a spot
// computed elsewhere (pair.js does, so both versions rest on the same pixel).
async function settle(page, opts = {}) {
  const point = opts.restAt || await restPoint(page, opts);
  if (!point) return null;
  return moveTo(page, point);
}

// Send the pointer to a fixed corner. Use when a beat must clear a whole
// region (a callout bubble in the lower third, a menu that opens downward);
// settle() is the default because a corner every time reads as a machine.
async function park(page, corner = THEME.park.corner) {
  const vp = page.__viewport || VIEWPORT;
  const { x: ix, y: iy } = THEME.park.inset;
  const points = {
    'bottom-right': { x: vp.width - ix, y: vp.height - iy },
    'bottom-left': { x: ix, y: vp.height - iy },
    'top-right': { x: vp.width - ix, y: iy / 2 },
    'top-left': { x: ix, y: iy / 2 },
  };
  return moveTo(page, points[corner] || points['bottom-right']);
}

async function smoothScrollTo(page, selector) {
  await page.locator(selector).first().evaluate((el) =>
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await page.waitForTimeout(700);
}

async function scrollBy(page, dy, steps = 12) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(24);
  }
  await page.waitForTimeout(300);
}

// --- narration --------------------------------------------------------------
// Floating caption bar: scene-level narration, burned into the recording.
// Idempotent, safe to call after navigations. Options:
//   kind: 'narration' | 'problem' | 'result' | 'step'   (see theme.js)
//   step: number shown as a chip when kind === 'step'
//   hold: required reading time in ms; always drives the drain line
function requireCaptionHold(hold) {
  if (!Number.isFinite(hold) || hold <= 0) {
    throw new Error('caption() requires a positive hold in milliseconds so every narrated beat has a timer; prefer beat() when possible');
  }
  return hold;
}

async function caption(page, text, { kind = 'narration', step, hold, timerStartedAt } = {}) {
  hold = requireCaptionHold(hold);
  timerStartedAt = timerStartedAt || Date.now();
  const variant = THEME.kinds[kind] || THEME.kinds.narration;
  await page.evaluate((a) => {
    const c = a.theme;
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.innerHTML =
        '<div data-rail></div>' +
        '<div data-body><span data-chip></span><span data-text></span></div>' +
        '<div data-drain-track><div data-drain></div></div>';
      Object.assign(el.style, {
        position: 'fixed', bottom: c.bottom + 'px', left: '50%',
        transform: 'translateX(-50%)', display: 'flex', alignItems: 'stretch',
        background: c.bg, color: c.ink, borderRadius: c.radius + 'px',
        maxWidth: c.maxWidth, zIndex: 2147483645, overflow: 'hidden',
        fontFamily: a.font, boxShadow: c.shadow,
        pointerEvents: 'none',
      });
      const rail = el.querySelector('[data-rail]');
      Object.assign(rail.style, { width: c.railWidth + 'px', flex: '0 0 auto' });
      const body = el.querySelector('[data-body]');
      Object.assign(body.style, {
        padding: '13px 24px', fontSize: c.size + 'px', lineHeight: String(c.lineHeight),
        display: 'flex', alignItems: 'baseline', gap: '12px',
      });
      const chip = el.querySelector('[data-chip]');
      Object.assign(chip.style, {
        display: 'none', minWidth: '26px', height: '26px', borderRadius: '13px',
        fontSize: Math.round(c.size * 0.72) + 'px', fontWeight: '700',
        alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
        alignSelf: 'center', color: '#0b1220',
      });
      const track = el.querySelector('[data-drain-track]');
      Object.assign(track.style, {
        position: 'absolute', left: '0', right: '0', bottom: '0', height: '3px',
      });
      const drain = el.querySelector('[data-drain]');
      Object.assign(drain.style, {
        height: '100%', width: '100%', transformOrigin: 'left center',
        transform: 'scaleX(0)', opacity: '0',
      });
      document.body.appendChild(el);
    }

    const railColor = a.rail || a.accent;
    el.querySelector('[data-rail]').style.background = railColor;
    el.querySelector('[data-text]').innerHTML = a.html;
    const chip = el.querySelector('[data-chip]');
    if (a.step != null) {
      chip.textContent = String(a.step);
      chip.style.display = 'inline-flex';
      chip.style.background = railColor;
    } else {
      chip.style.display = 'none';
    }
    el.style.display = 'flex';

    // Entrance: slide up and fade whenever the text changes, so the bar reads
    // as a narrator taking a turn rather than a static subtitle track.
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(12px)';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${c.enterMs}ms ease-out, transform ${c.enterMs}ms cubic-bezier(0.22,1,0.36,1)`;
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Mandatory drain timer. It derives progress from a shared wall-clock start
    // instead of a CSS transition, so paired browsers show the same width even
    // if one evaluates this function a frame later than the other.
    const drain = el.querySelector('[data-drain]');
    if (el.__demoDrainFrame) cancelAnimationFrame(el.__demoDrainFrame);
    drain.style.transition = 'none';
    drain.style.background = railColor;
    drain.style.opacity = '0.85';
    const tickDrain = () => {
      const progress = Math.max(0, Math.min(1, (Date.now() - a.timerStartedAt) / a.hold));
      drain.style.transform = `scaleX(${1 - progress})`;
      if (progress < 1) el.__demoDrainFrame = requestAnimationFrame(tickDrain);
      else el.__demoDrainFrame = null;
    };
    tickDrain();
  }, {
    // Emphasis takes the variant's colour, not the global accent: a blue bold
    // word inside a red problem caption reads as two unrelated signals.
    html: renderMarkup(text, variant.rail || THEME.accent),
    theme: THEME.caption,
    font: THEME.fontFamily,
    accent: THEME.accent,
    rail: variant.rail,
    step: kind === 'step' ? (step ?? null) : null,
    hold,
    timerStartedAt,
  });
  await page.waitForTimeout(260);
}

// One narrated beat: set the caption, settle the pointer, hold for reading
// time. This is the unit a scene is built from. opts.park takes a corner name
// to force park() instead of settle(), or false to leave the pointer alone.
async function beat(page, text, ms = 4500, opts = {}) {
  const startedAt = Date.now();
  await caption(page, text, { ...opts, hold: ms, timerStartedAt: startedAt });
  if (typeof opts.park === 'string') await park(page, opts.park);
  else if (opts.park !== false) await settle(page, opts);
  const left = ms - (Date.now() - startedAt);
  if (left > 0) await page.waitForTimeout(left);
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (!el) return;
    if (el.__demoDrainFrame) cancelAnimationFrame(el.__demoDrainFrame);
    el.__demoDrainFrame = null;
    el.style.display = 'none';
  });
}

// Coach mark: highlight ring around the target plus a pointing bubble beside
// it, auto-placed on the side with the most room. Use for "look here" beats;
// keep caption() for scene-level narration. Remove with hideCallout().
async function callout(page, selector, text) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible' });
  await loc.evaluate((el, a) => {
    document.getElementById('demo-callout')?.remove();
    document.getElementById('demo-callout-ring')?.remove();
    const r = el.getBoundingClientRect();
    const pad = 6;

    const ring = document.createElement('div');
    ring.id = 'demo-callout-ring';
    Object.assign(ring.style, {
      position: 'fixed', left: r.left - pad + 'px', top: r.top - pad + 'px',
      width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px',
      border: `3px solid ${a.color}`, borderRadius: '8px',
      pointerEvents: 'none', zIndex: 2147483644, boxShadow: `0 0 0 3px ${a.color}40`,
    });
    document.body.appendChild(ring);

    const bub = document.createElement('div');
    bub.id = 'demo-callout';
    bub.innerHTML = a.html;
    Object.assign(bub.style, {
      position: 'fixed', background: a.color, color: '#fff',
      padding: '10px 15px', borderRadius: '9px', fontSize: a.size + 'px', lineHeight: '1.35',
      maxWidth: '320px', fontFamily: a.font,
      pointerEvents: 'none', zIndex: 2147483645, boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
    });
    document.body.appendChild(bub);
    const b = bub.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14;
    const room = { right: vw - r.right, left: r.left, bottom: vh - r.bottom, top: r.top };
    let x, y, side;
    if (room.right > b.width + gap + 8) side = 'right';
    else if (room.left > b.width + gap + 8) side = 'left';
    else if (room.bottom > b.height + gap + 8) side = 'bottom';
    else side = 'top';
    if (side === 'right') { x = r.right + gap; y = r.top + r.height / 2 - b.height / 2; }
    if (side === 'left') { x = r.left - gap - b.width; y = r.top + r.height / 2 - b.height / 2; }
    if (side === 'bottom') { x = r.left + r.width / 2 - b.width / 2; y = r.bottom + gap; }
    if (side === 'top') { x = r.left + r.width / 2 - b.width / 2; y = r.top - gap - b.height; }
    bub.style.left = Math.max(8, Math.min(vw - b.width - 8, x)) + 'px';
    bub.style.top = Math.max(8, Math.min(vh - b.height - 8, y)) + 'px';

    // Arrow: small rotated square bridging bubble and ring.
    const arrow = document.createElement('div');
    Object.assign(arrow.style, {
      position: 'absolute', width: '12px', height: '12px', background: a.color,
      transform: 'rotate(45deg)',
    });
    if (side === 'right') Object.assign(arrow.style, { left: '-5px', top: 'calc(50% - 6px)' });
    if (side === 'left') Object.assign(arrow.style, { right: '-5px', top: 'calc(50% - 6px)' });
    if (side === 'bottom') Object.assign(arrow.style, { top: '-5px', left: 'calc(50% - 6px)' });
    if (side === 'top') Object.assign(arrow.style, { bottom: '-5px', left: 'calc(50% - 6px)' });
    bub.appendChild(arrow);
  }, {
    html: renderMarkup(text, '#fff'),
    color: THEME.callout.color,
    size: THEME.callout.size,
    font: THEME.fontFamily,
  });
}

async function hideCallout(page) {
  await page.evaluate(() => {
    document.getElementById('demo-callout')?.remove();
    document.getElementById('demo-callout-ring')?.remove();
  });
}

const pause = (page, ms) => page.waitForTimeout(ms);

// End a chapter on a stable after-state: overlays gone, pointer out of the way,
// the product's own result held still. That still stretch is a clean cut point,
// so one long recording can be split into several videos at assembly time
// without re-recording. Call it between chapters and once before stop().
async function cutPoint(page, ms = 1500, { corner } = {}) {
  await hideCallout(page);
  await hideCaption(page);
  await park(page, corner);
  await page.waitForTimeout(ms);
}

module.exports = {
  start, stop, goto,
  caption, beat, hideCaption, callout, hideCallout,
  moveTo, click, hoverBeat, dragTo, typeInto, park, settle, restPoint,
  smoothScrollTo, scrollBy, pause, cutPoint,
  rnd, resetRandom, makeRng, DEFAULT_SEED,
  THEME, adoptAppTheme, cleanOnScreenText,
  BASE, RAW_DIR, VIEWPORT,
};
