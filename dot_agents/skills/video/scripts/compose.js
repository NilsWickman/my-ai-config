// ffmpeg assembly for demo recordings, and the A/B wipe in particular.
//
// wipe() takes two frame-aligned clips of the same scene (see pair.js) and
// sweeps a divider across the frame so the new version replaces the old one in
// place, at full resolution. Side-by-side was rejected on purpose: halving the
// width makes product text unreadable after the 1080p downscale, and the eye
// compares two things far better in one position than in two.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
];

function findFont() {
  const hit = FONT_CANDIDATES.find((f) => fs.existsSync(f));
  if (!hit) throw new Error('compose: no label font found, pass fontFile explicitly');
  return hit;
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const detail = (error.stderr || '').split('\n').slice(-14).join('\n');
    throw new Error(`${cmd} failed:\n${detail}`);
  }
}

function probe(file) {
  const out = run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=0', file,
  ]);
  const get = (k) => {
    const m = out.match(new RegExp(`^${k}=(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return {
    file,
    width: Number(get('width')),
    height: Number(get('height')),
    duration: Number(get('duration')),
  };
}

// Locate the black flash pair.sync() burned into the head of a clip, and
// return the second it ends. That instant, not the file start, is the shared
// origin of two lockstep recordings.
// pix_th is deliberately low: a dark product UI sits around luma 20, and a
// looser threshold reports the whole clip as one long black stretch that never
// ends, which reads here as "no marker found".
function findSync(file, { window = 8 } = {}) {
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-t', String(window), '-i', file,
    '-vf', 'blackdetect=d=0.08:pix_th=0.05', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/black_start:([\d.]+)\s+black_end:([\d.]+)/);
  return m ? Number(m[2]) : null;
}

// drawtext text= is single-quoted in the filtergraph, so colons are safe; a
// literal apostrophe would end the quote, and % is a strftime escape.
const escText = (s) => String(s).replace(/\\/g, '').replace(/'/g, '’').replace(/%/g, ' percent');

/**
 * Sweep between two aligned clips.
 *
 * @param {string}  before      clip of the old version (fills the frame first)
 * @param {string}  after       clip of the new version (sweeps in)
 * @param {string}  out         .mp4 to write
 * @param {number}  at          seconds into the clip where the sweep starts
 * @param {number}  duration    sweep length in seconds (0.9-1.4 reads best)
 * @param {object}  labels      { before, after } corner badges, omit to skip
 * @param {string}  direction   'ltr' (default) or 'rtl'
 */
function wipe({
  before, after, out, at, duration = 1.1, labels = null,
  direction = 'ltr', fontFile, fps = 30, crf = 20,
  dividerColor = 'white', labelSize, labelPos = 'top', align = 'auto',
}) {
  const a = probe(before);
  const b = probe(after);
  if (!(a.duration > 0) || !(b.duration > 0)) throw new Error('compose.wipe: input has no duration');

  const W = a.width, H = a.height;

  // Playwright starts recording at context creation, so the two files do not
  // share a t=0 and comparing them frame-for-frame would compare different
  // moments of the scene. Align on the flash pair.sync() burned in instead.
  let offA = 0, offB = 0;
  if (align === 'auto') {
    offA = findSync(before) || 0;
    offB = findSync(after) || 0;
    if (!offA !== !offB) {
      // One of two lockstep clips carries the marker: the flash happened before
      // the other file's first frame. Aligning on it would be worse than not
      // aligning at all, so refuse rather than ship a silently offset seam.
      throw new Error('compose.wipe: the sync flash is in ' + (offA ? before : after) +
        ' but not in ' + (offA ? after : before) + '. Re-record: pair.sync() must run ' +
        'after both pages have painted.');
    } else if (!offA && !offB) {
      console.warn('compose.wipe: WARNING no sync flash found in either clip. ' +
        'Falling back to the file start, which drifts by however long the second ' +
        'browser took to paint. Call pair.sync() at the top of the scene.');
    } else {
      console.log(`wipe: aligned on sync flash (before +${offA.toFixed(2)}s, after +${offB.toFixed(2)}s)`);
    }
  } else if (align && typeof align === 'object') {
    offA = align.before || 0;
    offB = align.after || 0;
  }

  const drift = Math.abs((a.duration - offA) - (b.duration - offB));
  if (drift > 0.5) {
    console.warn(`compose.wipe: WARNING the two aligned clips differ by ${drift.toFixed(2)}s. ` +
      'The wipe assumes lockstep recordings, so anything past the sweep may not line up. ' +
      'Re-record with pair.js rather than nudging this by hand.');
  }
  const total = Math.min(a.duration - offA, b.duration - offB);
  if (at + duration > total) {
    throw new Error(`compose.wipe: sweep ends at ${(at + duration).toFixed(2)}s but the aligned clips are only ${total.toFixed(2)}s`);
  }

  // xfade does the reveal. Both inputs are trimmed around the sweep so the new
  // version keeps its OWN timestamps: xfade shifts input 2 by `offset`, so
  // trimming input 2 at `offset` cancels the shift exactly. Without this the
  // two versions would be compared at different moments of the scene.
  const sweepEnd = at + duration;
  const transition = direction === 'rtl' ? 'wipeleft' : 'wiperight';
  const progress = `clip((t-${at})/${duration},0,1)`;
  const edge = direction === 'rtl' ? `(${W}-${W}*${progress})` : `(${W}*${progress})`;

  const norm = (i, cut) =>
    `[${i}:v]scale=${W}:${H}:flags=lanczos,setsar=1,fps=${fps},${cut},setpts=PTS-STARTPTS`;
  const chain = [
    `${norm(0, `trim=start=${offA}:end=${offA + sweepEnd}`)}[a]`,
    `${norm(1, `trim=start=${offB + at}`)}[b]`,
    `[a][b]xfade=transition=${transition}:duration=${duration}:offset=${at}[m0]`,
    // The divider rides along as two moving overlays: a soft dark shadow under
    // a bright hairline, so the seam reads on both light and dark product UIs.
    // It has to be overlay rather than drawbox, because drawbox evaluates its
    // x expression once at init and would leave the line pinned at the edge.
    `[2:v]format=rgba,colorchannelmixer=aa=0.30[shadow]`,
    `[m0][shadow]overlay=x='${edge}-6':y=0:eval=frame:enable='between(t,${at},${sweepEnd})'[m1]`,
    `[m1][3:v]overlay=x='${edge}-1':y=0:eval=frame:enable='between(t,${at},${sweepEnd})'[m2]`,
  ];

  let last = 'm2';
  if (labels && labels.before && labels.after) {
    const font = fontFile || findFont();
    const size = labelSize || Math.max(20, Math.round(H * 0.029));
    const pad = 12;
    const margin = 34;
    // Hand the leading corner over the moment the divider clears the badge, so
    // it never labels a strip of the version it is not describing.
    const badgeWidth = margin + 2 * pad +
      Math.max(String(labels.before).length, String(labels.after).length) * size * 0.62;
    const swapAt = at + duration * Math.min(1, badgeWidth / W);

    const leftX = `${margin}`;
    const rightX = `w-tw-${margin}`;
    const lead = direction === 'rtl' ? rightX : leftX;
    const trail = direction === 'rtl' ? leftX : rightX;

    // Badges sit in a corner, so they collide with whatever chrome the app
    // already puts there. Move them with labelPos when the header is in the way.
    const y = labelPos === 'bottom' ? `h-th-${margin + 2 * pad}` : `${margin}`;
    const badge = (text, x, enable, tag, next) =>
      `[${tag}]drawtext=fontfile=${font}:text='${escText(text)}':x=${x}:y=${y}:` +
      `fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=${pad}:` +
      `enable='${enable}'[${next}]`;

    chain.push(badge(labels.before, lead, `lt(t,${swapAt})`, last, 'l1'));
    chain.push(badge(labels.after, lead, `gte(t,${swapAt})`, 'l1', 'l2'));
    chain.push(badge(labels.before, trail, `between(t,${swapAt},${sweepEnd})`, 'l2', 'l3'));
    last = 'l3';
  }

  chain.push(`[${last}]format=yuv420p[v]`);

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  run('ffmpeg', [
    '-y', '-i', before, '-i', after,
    '-f', 'lavfi', '-i', `color=c=black:s=12x${H}:r=${fps}`,
    '-f', 'lavfi', '-i', `color=c=${dividerColor}:s=3x${H}:r=${fps}`,
    '-filter_complex', chain.join(';'),
    '-map', '[v]', '-t', String(total),
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow',
    '-movflags', '+faststart', out,
  ]);
  const result = probe(out);
  console.log(`wipe: ${path.basename(out)} ${result.width}x${result.height} ${result.duration.toFixed(2)}s ` +
    `(sweep ${at}s -> ${(at + duration).toFixed(2)}s, ${direction})`);
  return result;
}

/**
 * Join verified scene clips into one video, trimming each in the same pass so
 * the footage is encoded once rather than twice.
 *
 * @param {Array<string|{file:string,start?:number,end?:number}>} inputs  scenes, in order
 * @param {string}   out        .mp4 to write
 * @param {number}   dip        seconds of dip to black between scenes, 0 to skip
 * @param {number}   crossfade  seconds of dissolve between scenes, 0 for hard cuts
 * @param {number}   fadeOut    seconds of fade to black at the end, 0 to skip
 *
 * Pick one of dip or crossfade. A dissolve between two scenes that share a
 * layout ghosts every label into its neighbour and reads as a rendering bug;
 * dip to black there instead, and keep crossfade for scenes that look nothing
 * alike.
 */
function join(inputs, out, { dip = 0, crossfade = 0, fadeOut = 0, fps = 30, crf = 23 } = {}) {
  if (dip > 0 && crossfade > 0) throw new Error('compose.join: use dip or crossfade, not both');
  if (!inputs.length) throw new Error('compose.join: no inputs');
  const scenes = inputs.map((i) => (typeof i === 'string' ? { file: i } : i));
  const metas = scenes.map((s) => {
    const m = probe(s.file);
    const start = s.start || 0;
    const end = Math.min(s.end == null ? m.duration : s.end, m.duration);
    if (end <= start) throw new Error(`compose.join: ${s.file} trims to nothing`);
    return { ...m, start, end, duration: end - start };
  });
  const W = metas[0].width, H = metas[0].height;
  const odd = metas.find((m) => m.width !== W || m.height !== H);
  if (odd) throw new Error(`compose.join: ${odd.file} is ${odd.width}x${odd.height}, expected ${W}x${H}`);

  const chain = metas.map((m, i) => {
    // A dip is applied per scene: out to black at the end of every scene but
    // the last, in from black at the start of every scene but the first.
    const fades = [];
    if (dip > 0 && i > 0) fades.push(`fade=t=in:st=0:d=${dip}`);
    if (dip > 0 && i < metas.length - 1) {
      fades.push(`fade=t=out:st=${(m.duration - dip).toFixed(2)}:d=${dip}`);
    }
    return `[${i}:v]scale=${W}:${H},setsar=1,fps=${fps},` +
      `trim=start=${m.start}:end=${m.end},setpts=PTS-STARTPTS` +
      (fades.length ? `,${fades.join(',')}` : '') + `[s${i}]`;
  });
  let last = 's0';
  let total = metas[0].duration;

  if (crossfade > 0) {
    for (let i = 1; i < inputs.length; i++) {
      // Each xfade consumes `crossfade` seconds of overlap, so the offset is
      // measured against the running length of what has been joined so far.
      const offset = total - crossfade;
      chain.push(`[${last}][s${i}]xfade=transition=fade:duration=${crossfade}:offset=${offset}[j${i}]`);
      last = `j${i}`;
      total += metas[i].duration - crossfade;
    }
  } else if (inputs.length > 1) {
    chain.push(`${metas.map((_, i) => `[s${i}]`).join('')}concat=n=${inputs.length}:v=1:a=0[j]`);
    last = 'j';
    total = metas.reduce((sum, m) => sum + m.duration, 0);
  }

  const tail = fadeOut > 0 ? `fade=t=out:st=${(total - fadeOut).toFixed(2)}:d=${fadeOut},` : '';
  chain.push(`[${last}]${tail}format=yuv420p[v]`);

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  run('ffmpeg', [
    '-y', ...scenes.flatMap((s) => ['-i', s.file]),
    '-filter_complex', chain.join(';'),
    '-map', '[v]',
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow',
    '-movflags', '+faststart', out,
  ]);
  const result = probe(out);
  const how = crossfade > 0 ? `${crossfade}s crossfades` : dip > 0 ? `${dip}s dips to black` : 'hard cuts';
  console.log(`join: ${path.basename(out)} ${scenes.length} scenes, ${result.duration.toFixed(2)}s (${how})`);
  return result;
}

// Delivery encode for ordinary walkthrough clips.
function encode(input, out, { crf = 23, fadeOut } = {}) {
  const meta = probe(input);
  const filters = ['format=yuv420p'];
  if (fadeOut) filters.unshift(`fade=t=out:st=${(meta.duration - fadeOut).toFixed(2)}:d=${fadeOut}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  run('ffmpeg', ['-y', '-i', input, '-vf', filters.join(','),
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow',
    '-movflags', '+faststart', out]);
  return probe(out);
}

module.exports = { probe, wipe, join, encode, findFont, findSync };

// CLI: node compose.js wipe <before> <after> <out> <at> [duration] [labelBefore] [labelAfter]
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'wipe') {
    const [before, after, out, at, dur, lb, la] = rest;
    wipe({
      before, after, out, at: Number(at), duration: dur ? Number(dur) : undefined,
      labels: lb && la ? { before: lb, after: la } : null,
    });
  } else if (cmd === 'probe') {
    console.log(JSON.stringify(probe(rest[0]), null, 2));
  } else {
    console.error('usage: node compose.js wipe <before> <after> <out> <at> [dur] [labelBefore] [labelAfter]');
    process.exit(1);
  }
}
