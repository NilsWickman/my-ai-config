// Step-4 review, cheap enough to run on every clip in a take.
//
// Reading 40+ extracted PNGs one at a time is the slowest part of reviewing a
// recording, and most of those frames are of a caption already checked in the
// frame before. This does the mechanical checks in ffmpeg (freezes, black
// lead-in and tail, duration) and renders the visual check as ONE timestamped
// contact sheet per clip, so the eyeballing costs a single image read. Only
// when a tile looks wrong is a full-resolution frame worth pulling, which
// `frameAt()` does by timestamp.
//
//   node review.js clip.webm [more.webm ...]
//   node review.js --json clip.webm
//   node review.js --frame 12.5 clip.webm      # one full-res frame
//
// A clean report is not a pass on its own: the contact sheet still has to be
// looked at. What this removes is the per-frame round trip, not the review.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
];
const findFont = () => FONT_CANDIDATES.find((f) => fs.existsSync(f)) || null;

function ffmpegStderr(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8' });
  return `${r.stderr || ''}${r.stdout || ''}`;
}

function duration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  return Number(out.trim());
}

// Frozen video longer than a caption's reading pause is dead air: either the
// scene is waiting on something it should not be filming, or a beat is
// over-held. Threshold sits just above the longest legitimate hold.
function freezes(file, { minSeconds = 6 } = {}) {
  const text = ffmpegStderr(['-i', file, '-vf', `freezedetect=n=0.003:d=${minSeconds}`, '-f', 'null', '-']);
  const out = [];
  let start = null;
  for (const line of text.split('\n')) {
    const s = line.match(/freeze_start:\s*([\d.]+)/);
    const d = line.match(/freeze_duration:\s*([\d.]+)/);
    if (s) start = Number(s[1]);
    if (d && start !== null) {
      out.push({ start, seconds: Number(d[1]) });
      start = null;
    }
  }
  if (start !== null) out.push({ start, seconds: null });
  return out;
}

// Playwright starts recording before the first paint, so every raw clip opens
// on black. Anything past ~1.5 s is a lead-in to trim at assembly.
function blackRuns(file) {
  const text = ffmpegStderr(['-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.05', '-f', 'null', '-']);
  return [...text.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
}

/**
 * One timestamped contact sheet per clip (more if the clip is long). Each tile
 * carries its source timestamp, so a suspect tile maps straight to a
 * `--frame <t>` pull without counting frames.
 */
function contactSheet(file, outDir, { interval = 5, cols = 5, width = 320 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const frames = Math.max(1, Math.ceil(duration(file) / interval));
  const c = Math.min(cols, frames);
  const rows = Math.min(8, Math.ceil(frames / c));
  const font = findFont();
  const stamp = font
    ? `,drawtext=fontfile=${font}:text='%{pts\\:hms}':x=4:y=4:fontsize=12:` +
      `fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=3`
    : '';
  const out = path.join(outDir, `${base}-sheet-%02d.png`);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', file,
    '-vf', `fps=1/${interval},scale=${width}:-2${stamp},tile=${c}x${rows}:padding=6:margin=6:color=0x1b1b1f`,
    '-fps_mode', 'vfr', out,
  ]);
  return fs.readdirSync(outDir)
    .filter((f) => f.startsWith(`${base}-sheet-`))
    .sort()
    .map((f) => path.join(outDir, f));
}

/**
 * The caption band alone, stacked one sample per row at close to full width.
 * A tile in the contact sheet is too small to read caption text, and captions
 * are the one thing step 4 must read word for word. Cropping the band instead
 * of shrinking the frame keeps them legible for the price of a second image.
 */
function captionStrip(file, outDir, { interval = 5, band = 120, width = 900, rows = 12 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const font = findFont();
  const stamp = font
    ? `,drawtext=fontfile=${font}:text='%{pts\\:hms}':x=6:y=6:fontsize=16:` +
      `fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=3`
    : '';
  const out = path.join(outDir, `${base}-captions-%02d.png`);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', file,
    '-vf', `fps=1/${interval},crop=iw:${band}:0:ih-${band}${stamp},scale=${width}:-2,` +
      `tile=1x${rows}:padding=4:margin=4:color=0x1b1b1f`,
    '-fps_mode', 'vfr', out,
  ]);
  return fs.readdirSync(outDir)
    .filter((f) => f.startsWith(`${base}-captions-`))
    .sort()
    .map((f) => path.join(outDir, f));
}

/** Pull one full-resolution frame, for when a tile looks wrong. */
function frameAt(file, seconds, outPath) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(seconds), '-i', file, '-frames:v', '1', outPath]);
  return outPath;
}

function review(file, { outDir, freezeSeconds = 6, leadIn = 1.5, interval = 5 } = {}) {
  const dir = outDir || path.join(path.dirname(file), 'review');
  const dur = duration(file);
  const frz = freezes(file, { minSeconds: freezeSeconds });
  const black = blackRuns(file);
  const head = black.find((b) => b.start < 0.5);
  const tail = black.find((b) => b.end > dur - 0.5);

  const flags = [];
  for (const f of frz) {
    flags.push(`frozen ${f.seconds ? `${f.seconds.toFixed(1)}s` : 'to end'} at ${f.start.toFixed(1)}s`);
  }
  if (head && head.end > leadIn) flags.push(`black lead-in ${head.end.toFixed(1)}s, trim it`);
  if (tail) flags.push(`black tail from ${tail.start.toFixed(1)}s`);

  return {
    file,
    duration: Number(dur.toFixed(1)),
    freezes: frz,
    blackLeadIn: head ? Number(head.end.toFixed(2)) : 0,
    sheets: contactSheet(file, dir, { interval }),
    captions: captionStrip(file, dir, { interval }),
    flags,
    verdict: flags.length ? 'CHECK' : 'CLEAN',
  };
}

module.exports = { review, contactSheet, frameAt, freezes, blackRuns, duration };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const frameIdx = argv.indexOf('--frame');
  const files = argv.filter((a, i) => !a.startsWith('--') && !(frameIdx >= 0 && i === frameIdx + 1));

  if (frameIdx >= 0) {
    const t = Number(argv[frameIdx + 1]);
    for (const f of files) {
      const out = `${f.replace(/\.[^.]+$/, '')}-t${t}.png`;
      console.log(frameAt(f, t, out));
    }
    process.exit(0);
  }
  if (!files.length) {
    console.error('usage: node review.js [--json] [--frame <s>] <clip> [clip ...]');
    process.exit(1);
  }

  const results = files.map((f) => review(f));
  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`${r.verdict}  ${path.basename(r.file)}  ${r.duration}s`);
      for (const flag of r.flags) console.log(`   ! ${flag}`);
      for (const s of r.sheets) console.log(`   sheet ${s}`);
      for (const s of r.captions) console.log(`   captions ${s}`);
    }
  }
  process.exitCode = results.some((r) => r.verdict === 'CHECK') ? 2 : 0;
}
