#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A
// The user's own videos inside a clip — WITHOUT opening whole video files (a 2 GB showreel stalls a chat for minutes).
//
// 1) look:  node clips.js <folder or video files…> [--out clips-out] [--thumbs 6]
//           reads only each file's header (ffprobe: length, size, fps, codec) and grabs a few frames with a fast seek,
//           → clips-out/index.json + one contact sheet per video (NN-name.jpg) + all.jpg (every video, one row each) to pick from
// 2) cut:   node clips.js cut <video> --from 12.5 --to 16 [--name intro] [--dir clips] [--height 720] [--fps 60] [--crop 9:16]
//           node clips.js cut --plan plan.json [--dir clips]        plan.json = [{ "src": "...", "from": 12.5, "to": 16, "name": "intro" }, …]
//           → clips/<name>.mp4 (H.264, for Safari / iPhone / Chrome) + clips/<name>.webm (VP9, for Chromium, which the check /
//             render scripts use) — no sound, short keyframe spacing so scrubbing lands fast, faststart; clips/clips.json lists them
//           --height 720 (default, the short side) · 1080 when a video fills the whole frame · --fps: never more than the source · --crop 9:16 | 1:1 | 16:9
//           --no-webm: only the .mp4 (then check.js / qa.js / render.js can't show it in Playwright's Chromium)
// needs ffmpeg + ffprobe on PATH
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { args } = require('./_browser');

const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi|mts|m2ts|wmv|flv|3gp)$/i;
const SKIP = new Set(['node_modules', '.git', 'clips', 'clips-out', 'qa-out', 'check-out', 'dist', 'build']);
const run = (bin, argv) => spawnSync(bin, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const need = bin => { if (run(bin, ['-version']).status !== 0) { console.error(`${bin} not found on PATH. Install ffmpeg (https://ffmpeg.org), or ask the user to trim the parts to use and send those.`); process.exit(2); } };
const mb = n => (n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1) + ' MB';
const slug = s => s.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^\w฀-๿-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'clip';

function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate:stream_tags=rotate:stream_side_data=rotation', '-of', 'json', file]);
  if (r.status !== 0) return { error: (r.stderr || '').trim().split('\n').pop() || 'unreadable' };
  const j = JSON.parse(r.stdout), v = (j.streams || []).find(s => s.codec_type === 'video'), a = (j.streams || []).some(s => s.codec_type === 'audio');
  if (!v) return { error: 'no video stream' };
  const fr = s => { const [n, d] = String(s || '0/1').split('/').map(Number); return d ? n / d : 0; };
  const rot = Math.abs(+((v.tags && v.tags.rotate) || ((v.side_data_list || []).find(x => x.rotation != null) || {}).rotation || 0));
  const [w, h] = rot === 90 || rot === 270 ? [v.height, v.width] : [v.width, v.height];
  return { duration: +(+j.format.duration || 0).toFixed(3), size: +j.format.size || fs.statSync(file).size, width: w, height: h, fps: +(fr(v.avg_frame_rate) || fr(v.r_frame_rate)).toFixed(3), codec: v.codec_name, audio: a, rotated: rot || 0 };
}
function walk(p, out = [], depth = 0) {
  let st; try { st = fs.statSync(p); } catch (e) { return out; }
  if (st.isFile()) { if (VIDEO.test(p)) out.push(p); return out; }
  if (depth > 3) return out;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) if (!SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(p, e.name), out, depth + 1);
  return out;
}

// frames with a fast input seek (-ss before -i): ffmpeg jumps to the nearest keyframe instead of decoding from the start
function sheet(file, info, out, n) {
  const tmp = out + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const times = Array.from({ length: n }, (_, i) => +(info.duration * (i + 0.5) / n).toFixed(2)), got = [];
  times.forEach((t, i) => {
    const f = path.join(tmp, `${String(i).padStart(2, '0')}.jpg`);
    const base = ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-an'];
    const vf = 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black';
    let r = run('ffmpeg', [...base, '-vf', vf + `,drawtext=text='${t.toFixed(1)}s':x=6:y=h-th-6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6`, '-q:v', '4', f]);
    if (r.status !== 0) r = run('ffmpeg', [...base, '-vf', vf, '-q:v', '4', f]);           // ffmpeg without fonts: no time labels
    if (r.status === 0 && fs.existsSync(f)) got.push(f);
  });
  if (!got.length) { fs.rmSync(tmp, { recursive: true, force: true }); return null; }
  const r = run('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%02d.jpg'), '-vf', `tile=${got.length}x1:padding=4:color=white`, '-frames:v', '1', '-q:v', '4', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return r.status === 0 ? { file: out, times } : null;
}

function look(a) {
  need('ffprobe'); need('ffmpeg');
  const files = [...new Set(a._.flatMap(p => walk(path.resolve(p))))].sort();
  if (!files.length) { console.error('No video files found in: ' + a._.join(', ')); process.exit(1); }
  const out = a.out && a.out !== true ? a.out : 'clips-out', n = Math.max(2, Math.min(10, +(a.thumbs || 6)));
  fs.mkdirSync(out, { recursive: true });
  const list = [];
  files.forEach((f, i) => {
    const info = probe(f), num = String(i + 1).padStart(2, '0'), item = { n: i + 1, file: f, name: path.basename(f), ...info };
    if (!info.error && info.duration > 0) { const s = sheet(f, info, path.join(out, `${num}-${slug(path.basename(f))}.jpg`), n); if (s) { item.sheet = path.basename(s.file); item.sheetTimes = s.times; } }
    list.push(item);
    process.stdout.write(`  ${num}  ${item.name.padEnd(34).slice(0, 34)} ${info.error ? 'ERROR ' + info.error : `${info.duration.toFixed(1).padStart(6)} s  ${info.width}×${info.height}  ${info.fps} fps  ${info.codec}${info.audio ? ' +audio' : ''}  ${mb(info.size)}${info.rotated ? '  (phone, rotated ' + info.rotated + '°)' : ''}`}\n`);
  });
  // all.jpg: one row per video, in list order (row 1 = video 01)
  const rows = list.filter(x => x.sheet).map(x => path.join(out, x.sheet));
  if (rows.length) {
    const W = Math.max(...rows.map(r => { const p = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', r]); return +p.stdout.trim() || 0; }));
    const inputs = rows.flatMap(r => ['-i', r]), pads = rows.map((_, i) => `[${i}:v]pad=${W}:ih:0:0:color=white[p${i}]`).join(';');
    const fc = rows.length > 1 ? `${pads};${rows.map((_, i) => `[p${i}]`).join('')}vstack=inputs=${rows.length}` : `[0:v]pad=${W}:ih:0:0:color=white`;
    run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-frames:v', '1', '-q:v', '4', path.join(out, 'all.jpg')]);
  }
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(list, null, 2));
  const total = list.reduce((s, x) => s + (x.size || 0), 0);
  console.log(`${list.length} videos, ${mb(total)} — nothing was decoded in full. Sheets: ${out}/NN-*.jpg, all: ${out}/all.jpg (row n = video n), list: ${out}/index.json`);
}

function cutOne(job, a) {
  const src = path.resolve(job.src), info = probe(src);
  if (info.error) throw new Error(`${job.src}: ${info.error}`);
  const from = Math.max(0, +job.from || 0), to = Math.min(info.duration, job.to != null ? +job.to : info.duration);
  if (!(to > from)) throw new Error(`${job.src}: --to must be after --from (and inside ${info.duration}s)`);
  const dir = job.dir || (a.dir && a.dir !== true ? a.dir : 'clips'); fs.mkdirSync(dir, { recursive: true });
  const name = slug(job.name || `${path.basename(src)}-${from.toFixed(1)}`), H = +(job.height || a.height || 720), F = Math.min(+(job.fps || a.fps || 60), info.fps || 60);
  const crop = job.crop || (a.crop && a.crop !== true ? a.crop : null);
  const vf = [];
  if (crop) { const [cw, ch] = String(crop).split(':').map(Number); vf.push(`crop='min(iw,ih*${cw}/${ch})':'min(ih,iw*${ch}/${cw})'`); }
  vf.push(`scale='if(gte(iw,ih),-2,min(${H},iw))':'if(gte(iw,ih),min(${H},ih),-2)'`, `fps=${+F.toFixed(3)}`, 'format=yuv420p');   // the SHORT side becomes --height (portrait stays sharp)
  const g = Math.max(1, Math.round(F / 4));                        // a keyframe every 1/4 s: scrubbing finds a frame fast
  const common = ['-v', 'error', '-y', '-ss', String(from), '-to', String(to), '-i', src, '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', vf.join(',')];
  const mp4 = path.join(dir, name + '.mp4'), webm = path.join(dir, name + '.webm');
  let r = run('ffmpeg', [...common, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-profile:v', 'high', '-g', String(g), '-keyint_min', '1', '-sc_threshold', '0', '-movflags', '+faststart', mp4]);
  if (r.status !== 0) throw new Error('ffmpeg (mp4) failed: ' + (r.stderr || '').trim().split('\n').slice(-3).join(' '));
  const noWebm = job.webm === false || a['no-webm'];
  if (!noWebm) {
    r = run('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-g', String(g), webm]);
    if (r.status !== 0) throw new Error('ffmpeg (webm) failed: ' + (r.stderr || '').trim().split('\n').slice(-3).join(' '));
  }
  const o = probe(mp4);
  const rec = { name, mp4: path.basename(mp4), webm: noWebm ? null : path.basename(webm), duration: o.duration, width: o.width, height: o.height, fps: o.fps, src: path.basename(src), from, to, sizes: { mp4: fs.statSync(mp4).size, webm: noWebm ? 0 : fs.statSync(webm).size } };
  const man = path.join(dir, 'clips.json'); let all = []; try { all = JSON.parse(fs.readFileSync(man, 'utf8')); } catch (e) {}
  all = all.filter(x => x.name !== name).concat(rec); fs.writeFileSync(man, JSON.stringify(all, null, 2));
  console.log(`  ${name}: ${from}–${to} s of ${rec.src} → ${o.width}×${o.height} ${o.fps} fps ${o.duration.toFixed(2)} s · mp4 ${mb(rec.sizes.mp4)}${rec.webm ? ' · webm ' + mb(rec.sizes.webm) : ''}`);
  if (rec.sizes.mp4 > 15 * 1048576) console.log(`    ! ${mb(rec.sizes.mp4)} is heavy for phones: shorten it, or --height 540`);
  return rec;
}

(async () => {
  const argv = process.argv.slice(2), a = args(argv.slice(argv[0] === 'cut' ? 1 : 0));
  if (argv[0] === 'cut') {
    need('ffprobe'); need('ffmpeg');
    const jobs = a.plan ? JSON.parse(fs.readFileSync(a.plan, 'utf8')) : [{ src: a._[0], from: a.from, to: a.to, name: a.name && a.name !== true ? a.name : null }];
    if (!jobs.length || !jobs[0].src) { console.log('usage: node clips.js cut <video> --from 12.5 --to 16 [--name intro] [--dir clips] [--height 720] [--fps 60] [--crop 9:16]'); process.exit(2); }
    let bad = 0; for (const j of jobs) { try { cutOne(j, a); } catch (e) { bad++; console.error('  ✗ ' + e.message); } }
    process.exit(bad ? 1 : 0);
  }
  if (!a._.length) { console.log('usage: node clips.js <folder or videos…> [--out clips-out]   |   node clips.js cut <video> --from s --to s [--name n]'); process.exit(2); }
  look(a);
})().catch(e => { console.error(e.message || e); process.exit(1); });
