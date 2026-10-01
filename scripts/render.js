#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
// Frame-exact export (optional — screen recording stays the default way to get a video).
// Steps the timeline one frame at a time, screenshots the stage, renders the sound offline, muxes with ffmpeg.
//
// usage: node render.js clip.html [options]
//   --out clip.mp4        output file (default: <clip>.mp4)
//   --fps 60              frames per second (24 / 30 / 60 / 120)
//   --aspect 9:16         override the clip's aspect (template clips only)
//   --scale 1             0.5 = half resolution (quick previews)
//   --from 0 --to <end>   render part of the clip (seconds)
//   --alpha mov|webm|png  transparent background: ProRes 4444 .mov (After Effects / Premiere), VP9 .webm, or a PNG sequence folder
//   --gif                 also write a small GIF preview (640 px wide, 15 fps)
//   --no-audio            skip the sound
// always writes <out>.srt when the clip has captions.
// needs: Playwright (npm i playwright) and ffmpeg on PATH
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch, openClip, args } = require('./_browser');

function ffmpegOk() { const r = spawnSync('ffmpeg', ['-version']); return r.status === 0; }
function wav(chs, sr) {
  const n = chs[0].length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chs[c][i] * 32767))), 44 + i * 4 + c * 2);
  return buf;
}
const srtTime = s => { const ms = Math.round(s * 1000); const h = ms / 3600000 | 0, m = (ms / 60000 | 0) % 60, sec = (ms / 1000 | 0) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
function run(argv, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', argv, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] }); let err = '';
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg failed:\n' + err.slice(-1500))));
    if (input) input(p.stdin);
  });
}

(async () => {
  const a = args(process.argv.slice(2), { fps: '60', scale: '1' });
  const file = a._[0];
  if (!file) { console.log('usage: node render.js clip.html [--out clip.mp4] [--fps 60] [--alpha mov|webm|png] [--gif]'); process.exit(2); }
  if (!ffmpegOk()) { console.error('ffmpeg not found on PATH. Install it (https://ffmpeg.org) or keep using screen recording.'); process.exit(2); }
  const fps = +a.fps, scale = +a.scale, alpha = a.alpha === true ? 'mov' : a.alpha;
  const base = (a.out || file.replace(/\.html?$/i, '') + (alpha ? '-alpha' : '') + '.mp4').replace(/\.(mp4|mov|webm)$/i, '');
  fs.mkdirSync(path.dirname(path.resolve(base)), { recursive: true });
  const outVideo = base + (alpha === 'mov' ? '.mov' : alpha === 'webm' ? '.webm' : alpha === 'png' ? '' : '.mp4');

  const browser = await launch();
  // open once to read the frame size, then reopen with a viewport that matches it exactly
  let { page } = await openClip(browser, file, { query: { aspect: a.aspect } });
  const { W, H, END } = await page.evaluate(() => ({ W: CLIP.W, H: CLIP.H, END: CLIP.END }));
  await page.close();
  const opened = await openClip(browser, file, { width: W, height: H, scale, query: { aspect: a.aspect, alpha: alpha ? 1 : null, safe: '' } });
  page = opened.page;
  await page.addStyleTag({ content: `.player{max-width:none!important;padding:0!important;margin:0!important}.controls,.chapters,.hint{display:none!important}
    .screen{width:${W}px!important;max-width:none!important;border-radius:0!important}html,body{overflow:hidden}` });
  await page.evaluate(() => { window.CLIP_RENDERING = true; CLIP.setSafe(''); fit(); });

  const from = +(a.from || 0), to = Math.min(END, +(a.to || END));
  const total = Math.max(1, Math.floor((to - from) * fps));
  const tmpVideo = base + '.video' + (alpha === 'mov' ? '.mov' : alpha === 'webm' ? '.webm' : '.mp4');
  const shot = async i => {
    const t = Math.min(to - 1e-3, from + i / fps);
    await page.evaluate(t => { CLIP.seek(t); }, t);
    await page.evaluate(() => CLIP.settle && CLIP.settle());                // user's videos: wait until each shows its exact frame
    return page.screenshot({ type: 'png', omitBackground: !!alpha, clip: { x: 0, y: 0, width: W, height: H } });
  };
  const t0 = Date.now();
  const progress = i => { if (i % fps === 0 || i === total - 1) process.stdout.write(`\r  frame ${i + 1}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`); };

  if (alpha === 'png') {
    fs.mkdirSync(base + '-frames', { recursive: true });
    for (let i = 0; i < total; i++) { fs.writeFileSync(path.join(base + '-frames', `frame_${String(i).padStart(6, '0')}.png`), await shot(i)); progress(i); }
  } else {
    const codec = alpha === 'mov' ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
      : alpha === 'webm' ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28']
      : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart'];
    await run(['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...codec, '-r', String(fps), tmpVideo], async stdin => {
      for (let i = 0; i < total; i++) { const png = await shot(i); if (!stdin.write(png)) await new Promise(r => stdin.once('drain', r)); progress(i); }
      stdin.end();
    });
  }
  process.stdout.write('\n');

  // sound: every cue rendered offline (same synth as the player), then muxed
  let audio = null;
  if (!a['no-audio'] && alpha !== 'png') {
    const b64 = await page.evaluate(async ({ from, to }) => {
      const [l, r] = await CLIP.renderAudio(48000);
      const s0 = Math.floor(from * 48000), s1 = Math.ceil(to * 48000);
      const out = new Float32Array((s1 - s0) * 2);
      for (let i = s0; i < s1; i++) { out[(i - s0) * 2] = l[i] || 0; out[(i - s0) * 2 + 1] = r[i] || 0; }
      const u8 = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, { from, to });
    const f = new Float32Array(Buffer.from(b64, 'base64').buffer.slice(0));
    const L = new Float32Array(f.length / 2), R = new Float32Array(f.length / 2);
    for (let i = 0; i < L.length; i++) { L[i] = f[i * 2]; R[i] = f[i * 2 + 1]; }
    audio = base + '.wav'; fs.writeFileSync(audio, wav([L, R], 48000));
  }
  if (alpha !== 'png') {
    if (audio) {
      const ac = alpha === 'webm' ? ['-c:a', 'libopus'] : alpha === 'mov' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'aac', '-b:a', '192k'];
      await run(['-y', '-i', tmpVideo, '-i', audio, '-c:v', 'copy', ...ac, '-shortest', outVideo]);
      fs.unlinkSync(tmpVideo);
    } else fs.renameSync(tmpVideo, outVideo);
  }

  // captions -> .srt
  const caps = await page.evaluate(({ from, to }) => CLIP.CAPTIONS.filter(c => c.end > from && c.t < to).map(c => ({ t: Math.max(0, c.t - from), end: Math.min(to, c.end) - from, text: c.text.replace(/<[^>]+>/g, '') })), { from, to });
  if (caps.length) fs.writeFileSync(base + '.srt', caps.map((c, i) => `${i + 1}\n${srtTime(c.t)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));

  if (a.gif && alpha !== 'png') {
    const src = alpha ? outVideo : outVideo;
    await run(['-y', '-i', src, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', base + '.gif']);
  }
  await browser.close();
  console.log('done:', [alpha === 'png' ? base + '-frames/' : outVideo, audio, caps.length ? base + '.srt' : null, a.gif ? base + '.gif' : null].filter(Boolean).join('  '));
})().catch(e => { console.error('\n' + (e.message || e)); process.exit(1); });
