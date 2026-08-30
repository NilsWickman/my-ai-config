// Presentation tokens for demo recordings.
//
// THIS IS THE FILE YOU ADAPT PER PROJECT. Point `accent` at the app's own
// brand colour (or call adoptAppTheme() to read it straight out of the running
// app's CSS variables) so the narration layer looks like part of the product
// instead of a generic overlay. Everything else has a sane default.

const THEME = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',

  // Accent drives: caption rail, bold emphasis, click pulse, step chips.
  accent: '#4da3ff',

  caption: {
    bg: 'rgba(16,18,26,0.93)',
    ink: '#f2f5fb',
    size: 22,          // px, before any downscale to 1080p
    lineHeight: 1.4,
    maxWidth: '68%',
    bottom: 28,        // px from viewport bottom
    radius: 12,
    railWidth: 5,
    enterMs: 250,      // slide-up + fade when the text changes
    // Wide and soft: a tight shadow survives video compression as a visible
    // rectangle behind the bar instead of reading as a shadow.
    shadow: '0 10px 40px rgba(0,0,0,0.45)',
  },

  // Semantic variants. Keep this list short: consistency reads as one product,
  // a rainbow of one-off colours reads as a slide deck.
  kinds: {
    narration: { rail: null },        // null = use accent
    problem:   { rail: '#ff6b5f' },
    result:    { rail: '#3ecf8e' },
    step:      { rail: null },
  },

  cursor: {
    size: 28,          // px; 22 disappears once 1600x900 is downscaled
    haloOpacity: 0.22,
    speed: 900,        // px/s of travel, so short and long moves feel alike
    minMs: 240,
    maxMs: 1200,
  },

  // Where the pointer goes during a reading hold.
  //   rest   = the default: stay near what you just touched, and only move if
  //            the caption or a callout is actually in the way (see lib.settle)
  //   corner = the explicit park() fallback, for beats that must clear a region
  park: {
    corner: 'bottom-right', inset: { x: 56, y: 150 },
    rest: { margin: 22, drift: [12, 30] },
  },

  callout: { color: '#ff5f56', size: 16 },
};

// Read the app's own accent out of the live DOM. Pass the CSS custom property
// names your app actually uses; the first one that resolves wins.
async function adoptAppTheme(page, varNames = ['--accent', '--primary', '--color-primary']) {
  const found = await page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    for (const n of names) {
      const v = cs.getPropertyValue(n).trim();
      if (v) return v;
    }
    return null;
  }, varNames);
  if (found) THEME.accent = found;
  return THEME.accent;
}

// On-screen text must not contain em dashes (house style); rewrite the common
// "clause — clause" pattern instead of trusting script authors.
function cleanOnScreenText(text) {
  return String(text).replace(/\s*—\s*/g, ', ');
}

// `**word**` becomes an accent-coloured emphasis. Everything else is escaped:
// captions quote real product data, which can contain angle brackets.
function renderMarkup(text, accent) {
  const escaped = cleanOnScreenText(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g,
    (_, word) => `<b style="color:${accent};font-weight:650">${word}</b>`);
}

module.exports = { THEME, adoptAppTheme, cleanOnScreenText, renderMarkup };
