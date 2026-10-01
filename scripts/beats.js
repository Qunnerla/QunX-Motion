#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A
// Read the user's song: tempo, every beat, bar starts, sections (intro / build / drop / break / outro) and accents,
// so the clip can be cut to the song's own beats. Nothing is uploaded anywhere; the file is read on this machine.
// usage: node beats.js song.mp3 [--length 20] [--bpm 128] [--click] [--out song.beats.json]
//   --length  clip length in seconds: also suggests which part of the song to use (drop landing mid-clip)
//   --bpm     override the tempo if the guess is double / half (the output lists the alternatives)
//   --click   also write song.click.wav: the song with a click on every beat, for the user to check by ear
// decode: ffmpeg if installed, otherwise the Chromium that Playwright uses. Assumes 4 beats per bar.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { args } = require('./_browser');

const SR = 22050, N = 1024, HOP = 256, FPS = SR / HOP;          // ~11.6 ms per analysis frame

/* ---------- 1. decode to mono 22.05 kHz ---------- */
async function decode(file) {
  try {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error('ffmpeg could not read ' + file + ': ' + String(e.stderr || e.message).split('\n')[0]);
  }
  const { launch } = require('./_browser');                    // no ffmpeg: let Chromium decode it
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const b64 = fs.readFileSync(file).toString('base64');
    const out = await page.evaluate(async ({ b64, SR }) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(u.buffer);
      const n = ab.length, mono = new Int16Array(n);
      for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += Math.max(-1, Math.min(1, d[i] / ab.numberOfChannels)) * 32767; }
      let s = ''; const b = new Uint8Array(mono.buffer); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    }, { b64, SR });
    const raw = Buffer.from(out, 'base64'), i16 = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2), f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767;
    return f;
  } finally { await browser.close(); }
}

/* ---------- 2. spectrum per frame -> 40 log bands, onset strength, loudness ---------- */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
function analyse(x) {
  const F = Math.max(1, Math.floor((x.length - N) / HOP) + 1), NB = 40;
  const edges = Array.from({ length: NB + 1 }, (_, i) => Math.round(30 * Math.pow(8000 / 30, i / NB) / (SR / N)));
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const bands = [], rms = new Float32Array(F), flux = new Float32Array(F), low = new Float32Array(F);
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = null;
  for (let f = 0; f < F; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = x[f * HOP + i] || 0; e += v * v; re[i] = v * win[i]; im[i] = 0; }
    rms[f] = 10 * Math.log10(e / N + 1e-10);
    fft(re, im);
    const L = new Float32Array(NB);
    for (let b = 0; b < NB; b++) { let s = 0; for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) s += re[k] * re[k] + im[k] * im[k]; L[b] = Math.log10(1 + 1000 * s / N); }
    if (prev) for (let b = 0; b < NB; b++) { const d = Math.max(0, L[b] - prev[b]); flux[f] += d; if (b < 12) low[f] += d; }   // bands under ~150 Hz = kick / bass
    bands.push(L); prev = L;
  }
  return { F, bands, rms, flux, low };
}
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))) || 1; };
function normOnset(flux) {                                      // subtract the local mean (0.4 s), keep what sticks out
  const w = Math.round(0.2 * FPS), o = new Float32Array(flux.length);
  let s = 0; const cs = [0]; for (const v of flux) cs.push(s += v);
  for (let i = 0; i < flux.length; i++) { const a = Math.max(0, i - w), b = Math.min(flux.length, i + w + 1); o[i] = Math.max(0, flux[i] - (cs[b] - cs[a]) / (b - a)); }
  const sd = std(Array.from(o)); for (let i = 0; i < o.length; i++) o[i] /= sd;
  return o;
}

/* ---------- 3. tempo: autocorrelation of the onset curve, with a soft preference around 115 BPM ---------- */
function tscore(on, bpm) {                                     // the lag plus its multiples: sharper peak, better precision
  let s = 0;
  [[1, 1], [2, 0.5], [3, 0.33], [4, 0.25]].forEach(([m, w]) => {
    const lag = m * 60 * FPS / bpm, l0 = Math.floor(lag), fr = lag - l0; if (l0 + 1 >= on.length) return; let a = 0;
    for (let i = l0 + 1; i < on.length; i++) a += on[i] * ((1 - fr) * on[i - l0] + fr * on[i - l0 - 1]);
    s += w * a / (on.length - l0);
  });
  return s * Math.exp(-0.5 * (Math.log2(bpm / 115) / 1.0) ** 2);
}
function tempo(on) {
  const cand = [];
  for (let bpm = 55; bpm <= 210; bpm += 0.25) cand.push({ bpm, score: tscore(on, bpm) });
  const peaks = cand.filter((c, i) => i > 0 && i < cand.length - 1 && c.score >= cand[i - 1].score && c.score >= cand[i + 1].score).sort((a, b) => b.score - a.score);
  const best = peaks[0], alt = [];
  for (const p of peaks.slice(1)) {
    const r = p.bpm / best.bpm;
    if ([0.5, 2, 2 / 3, 1.5, 0.75, 4 / 3].some(k => Math.abs(r - k) < 0.03) && !alt.some(a => Math.abs(a.bpm - p.bpm) < 2)) alt.push(p);
    if (alt.length >= 2) break;
  }
  return { bpm: best.bpm, score: best.score, conf: best.score / (peaks[1] ? peaks[1].score : best.score / 2), alt: alt.map(a => ({ bpm: a.bpm, relative: +(a.score / best.score).toFixed(2) })) };
}

/* ---------- 4. beat tracking (dynamic programming: strong onsets + steady spacing, follows slow tempo drift) ---------- */
function localScore(on, bpm) {                                  // onsets smoothed a little around each frame
  const g = Math.max(1, 60 * FPS / bpm / 32), L = on.length, loc = new Float32Array(L), R = Math.ceil(3 * g);
  for (let i = 0; i < L; i++) { let s = 0; for (let d = -R; d <= R; d++) { const j = i + d; if (j >= 0 && j < L) s += on[j] * Math.exp(-0.5 * (d / g) ** 2); } loc[i] = s; }
  return loc;
}
function track(loc, a0, a1, bpm) {
  a0 = Math.round(a0); a1 = Math.round(a1);
  const P = 60 * FPS / bpm, L = a1 - a0, score = new Float32Array(L), back = new Int32Array(L).fill(-1), TIGHT = 100;
  for (let t = 0; t < L; t++) {
    let bs = -Infinity, bi = -1;
    for (let tau = t - Math.round(2 * P); tau <= t - Math.round(P / 2); tau++) {
      if (tau < 0) continue;
      const v = score[tau] - TIGHT * Math.log((t - tau) / P) ** 2;
      if (v > bs) { bs = v; bi = tau; }
    }
    score[t] = loc[a0 + t] + (bi >= 0 ? bs : 0); back[t] = bi;
  }
  let end = L - 1, top = -Infinity;
  for (let t = Math.max(0, L - Math.round(2 * P)); t < L; t++) if (score[t] > top) { top = score[t]; end = t; }
  const beats = []; for (let t = end; t >= 0; t = back[t]) beats.unshift(a0 + t);
  return beats;
}
// most produced songs sit on a fixed grid: fit one line (period + phase) through the tracked beats, strong beats count more,
// then keep the grid if most tracked beats sit on it (quiet intros without drums no longer drag the phase off the beat)
function beatsIn(on, loc, a0, a1, bpm, alive) {
  let beats = track(loc, a0, a1, bpm);
  while (beats.length && !alive(beats[0])) beats.shift();
  while (beats.length && !alive(beats[beats.length - 1])) beats.pop();
  if (beats.length < 4) return { beats, onGrid: false };
  const P0 = 60 * FPS / bpm, first = beats[0], lastF = beats[beats.length - 1];
  const K = beats.map(f => Math.round((f - first) / P0)), Wt = beats.map(f => Math.max(0.05, loc[f]));
  let sw = 0, sk = 0, st = 0, skk = 0, skt = 0;
  K.forEach((k, i) => { const w = Wt[i], t = beats[i]; sw += w; sk += w * k; st += w * t; skk += w * k * k; skt += w * k * t; });
  let P = (sw * skt - sk * st) / (sw * skk - sk * sk || 1); if (!(Math.abs(P / P0 - 1) < 0.03)) P = P0;
  const wrap = r => ((r % P) + 1.5 * P) % P - P / 2;
  const res = beats.map((f, i) => ({ r: wrap(f - (first + K[i] * P)), w: Wt[i] })).sort((p, q) => p.r - q.r);
  let acc = 0, t0 = first; const half = res.reduce((s0, x) => s0 + x.w, 0) / 2; for (const x of res) { acc += x.w; if (acc >= half) { t0 = first + x.r; break; } }
  let g0 = t0 - Math.floor((t0 - first + P / 2) / P) * P;
  while (g0 - P >= a0 - 0.08 * FPS && alive(Math.max(0, g0 - P))) g0 -= P;             // the grid reaches back into the quiet intro
  const grid = []; for (let t = g0; t < a1 && (t <= lastF + P / 2 || alive(t)); t += P) grid.push(t);
  const agree = beats.filter(f => grid.some(g => Math.abs(g - f) < 0.06 * FPS)).length / beats.length;
  return agree >= 0.8 ? { beats: grid, onGrid: true } : { beats, onGrid: false };
}

/* ---------- 5. bars, tempo map, sections, accents ---------- */
function main(x, a) {
  const dur = x.length / SR, { F, bands, rms, flux, low } = analyse(x);
  const on = normOnset(flux), lowOn = normOnset(low);
  const tp = tempo(on); let bpm = a.bpm ? +a.bpm : tp.bpm;
  const loud = Math.max(...rms), alive = f => rms[Math.round(f)] > loud - 40;          // no beats in leading / trailing silence
  const loc = localScore(on, bpm);

  // tempo changes: estimate the tempo in 8 s windows; a window that clearly prefers another tempo starts a new part
  const WIN = Math.round(8 * FPS), STEP = Math.round(2 * FPS), parts = [];
  const octave = (b, ref) => [1, 2, 0.5].some(k => Math.abs(b * k / ref - 1) < 0.04);   // double / half time counts as the same tempo
  if (!a.bpm) for (let w0 = 0; w0 + WIN <= F; w0 += STEP) {
    const sl = on.slice(w0, w0 + WIN), lt = tempo(sl);
    const v = octave(lt.bpm, bpm) || tscore(sl, bpm) > lt.score * 0.8 ? bpm : lt.bpm, c = w0 + (WIN >> 1), last = parts[parts.length - 1];
    if (last && octave(v, last.bpm)) last.to = c; else parts.push({ bpm: v, from: c, to: c });
  }
  const segs = parts.filter(p => p.to - p.from >= 2 * STEP || parts.length === 1);
  let beats = [], onGrid = true;
  if (segs.length <= 1) ({ beats, onGrid } = beatsIn(on, loc, 0, F, bpm, alive));
  else {                                                            // track each part at its own tempo, then find where one hands over
    const runs = segs.map((p, i) => beatsIn(on, localScore(on, p.bpm), i ? Math.max(0, segs[i - 1].to - WIN) : 0, i < segs.length - 1 ? Math.min(F, segs[i + 1].from + WIN) : F, p.bpm, alive));
    const base = [...loc].sort((p, q) => p - q)[loc.length >> 1], gain = (bs, x0, x1) => bs.filter(f => f >= x0 && f < x1).reduce((s0, f) => s0 + (loc[Math.round(f)] || 0) - base, 0);
    const cut = [-Infinity];
    for (let i = 1; i < segs.length; i++) {
      let best = -Infinity, at = (segs[i - 1].to + segs[i].from) / 2;
      for (let c = segs[i - 1].to - WIN / 2; c <= segs[i].from + WIN / 2; c += 4) {
        const g = gain(runs[i - 1].beats, cut[i - 1], c) + gain(runs[i].beats, c, F);
        if (g > best) { best = g; at = c; }
      }
      cut.push(at);
    }
    cut.push(F);
    runs.forEach((r, i) => { const minGap = 0.6 * 60 * FPS / segs[i].bpm; r.beats.filter(f => f >= cut[i] && f < cut[i + 1]).forEach(f => { if (!beats.length || f - beats[beats.length - 1] > minGap) beats.push(f); }); onGrid = onGrid && r.onGrid; });
    segs.forEach((p, i) => { p.from = Math.max(0, cut[i]); p.len = cut[i + 1] - p.from; });
  }
  if (beats.length < 8) throw new Error('Too few beats found: is this a song with a pulse? Ask the user for the BPM and the time of the first beat.');
  const T = beats.map(f => Math.max(0, (f * HOP + N / 2) / SR));

  // tempo map: local tempo over 8 beats; steady if it stays within ±2.5 %
  const loc8 = T.map((t, i) => { const a0 = Math.max(0, i - 4), b0 = Math.min(T.length - 1, i + 4); return 60 * (b0 - a0) / (T[b0] - T[a0]); });
  const med = [...loc8].sort((p, q) => p - q)[loc8.length >> 1];
  const tempoMap = []; loc8.forEach((b, i) => { const last = tempoMap[tempoMap.length - 1]; if (!last || Math.abs(b - last.bpm) / last.bpm > 0.04) tempoMap.push({ t: +T[i].toFixed(2), bpm: +b.toFixed(1) }); });
  const steady = segs.length <= 1 && (onGrid || loc8.filter(b => Math.abs(b - med) / med > 0.025).length < loc8.length * 0.1);
  if (segs.length > 1) bpm = +segs.slice().sort((p, q) => q.len - p.len)[0].bpm.toFixed(2);   // the main part's tempo
  if (segs.length > 1) { tempoMap.length = 0; segs.forEach(p => tempoMap.push({ t: +Math.max(0, p.from / FPS).toFixed(2), bpm: +p.bpm.toFixed(1) })); }
  if (segs.length <= 1) bpm = +(60 * (T.length - 1) / (T[T.length - 1] - T[0])).toFixed(2);   // the grid's real average

  // bar starts: the beat phase with the most low-end punch and the biggest change in sound on it
  const bandAt = (i0, i1) => { const m = new Float32Array(40); let n = 0; for (let f = Math.max(0, i0); f < Math.min(F, i1); f++, n++) for (let b = 0; b < 40; b++) m[b] += bands[f][b]; return m.map(v => v / (n || 1)); };
  const dist = (p, q) => Math.sqrt(p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0));
  const beatLow = beats.map(f => Math.max(...Array.from({ length: 7 }, (_, d) => lowOn[Math.round(f) + d - 3] || 0)));
  const change = beats.map((f, i) => i < 2 || i > beats.length - 3 ? 0 : dist(bandAt(Math.round(beats[i - 2]), Math.round(f)), bandAt(Math.round(f), Math.round(beats[i + 2]))));
  const nz = arr => { const m = mean(arr), s = std(arr); return arr.map(v => (v - m) / s); };
  const zl = nz(beatLow), zc = nz(change);
  const ph = [0, 1, 2, 3].map(p => mean(zl.filter((_, i) => i % 4 === p)) + mean(zc.filter((_, i) => i % 4 === p)));
  const order = [0, 1, 2, 3].sort((p, q) => ph[q] - ph[p]), phase = order[0];
  const barConf = +(ph[order[0]] - ph[order[1]]).toFixed(2);
  const downbeats = T.filter((_, i) => i % 4 === phase);

  // sections: compare the 4 bars before and after every bar line; big differences are section changes
  const barF = downbeats.map((t, k) => { const f0 = Math.round(t * FPS), f1 = Math.round((downbeats[k + 1] || dur) * FPS);
    const r = mean(Array.from(rms.slice(f0, f1))), d = mean(Array.from(on.slice(f0, f1))); return { t, v: [...bandAt(f0, f1), r / 3, d * 3], rms: r }; });
  const nov = barF.map((_, k) => k < 2 || k > barF.length - 2 ? 0 : dist(barF.slice(Math.max(0, k - 4), k).reduce((s, b) => s.map((v, i) => v + b.v[i] / Math.min(4, k)), barF[0].v.map(() => 0)),
    barF.slice(k, k + 4).reduce((s, b, _, arr) => s.map((v, i) => v + b.v[i] / arr.length), barF[0].v.map(() => 0))));
  const nm = mean(nov), ns = std(nov), cuts = [0];
  nov.forEach((v, k) => { if (v > nm + 0.5 * ns && v >= (nov[k - 1] || 0) && v >= (nov[k + 1] || 0) && k - cuts[cuts.length - 1] >= 4) cuts.push(k); });
  const step = k => k > 0 && k < barF.length ? dist(barF[k - 1].v, barF[k].v) : 0;   // snap each change to the bar where the sound jumps most
  for (let i = 1; i < cuts.length; i++) { let b = cuts[i]; for (let k = cuts[i] - 2; k <= cuts[i] + 2; k++) if (k > cuts[i - 1] + 1 && (i + 1 >= cuts.length || k < cuts[i + 1] - 1) && step(k) > step(b)) b = k; cuts[i] = b; }
  const secs = cuts.map((k, i) => { const k1 = cuts[i + 1] || barF.length; const r = mean(barF.slice(k, k1).map(b => b.rms)); return { t: +barF[k].t.toFixed(2), end: +(barF[k1] ? barF[k1].t : dur).toFixed(2), bars: k1 - k, db: r }; });
  const top = Math.max(...secs.map(s => s.db));
  secs.forEach((s, i) => {
    const d = top - s.db; s.energy = d < 3 ? 3 : d < 7 ? 2 : d < 12 ? 1 : 0;
    const p = secs[i - 1];
    s.label = i === 0 && s.energy <= 1 ? 'intro' : p && s.db - p.db >= 4 && s.energy >= 2 ? 'drop' : i === secs.length - 1 && p && s.db < p.db - 2 ? 'outro' : p && p.db - s.db >= 4 ? 'break' : 'verse/chorus';
    if (s.label === 'drop' && p && p.label !== 'intro') { const f0 = Math.round(p.t * FPS), f1 = Math.round(p.end * FPS), h = (f0 + f1) >> 1; if (mean(Array.from(rms.slice(h, f1))) - mean(Array.from(rms.slice(f0, h))) > 1.5) p.label = 'build'; }
    s.db = +s.db.toFixed(1);
  });
  const drops = secs.filter(s => s.label === 'drop').map(s => s.t);

  // accents: the strongest ~12 % of beats (snare cracks, crashes, hits) -> RGB kicks, punches, stamps
  const strength = beats.map(f => loc[Math.round(f)] || 0), cut = [...strength].sort((p, q) => q - p)[Math.floor(strength.length * 0.12)];
  const accents = T.filter((_, i) => strength[i] >= cut).map(t => +t.toFixed(3));

  // where to start the clip: bar line, the biggest drop at 35–65 % of the clip, ends near a bar line
  let windows = [];
  if (a.length) {
    const Lc = +a.length, big = drops.length ? drops.slice().sort((p, q) => (secs.find(s => s.t === q).db) - (secs.find(s => s.t === p).db))[0] : null;
    for (const s of downbeats) {
      if (s + Lc > dur + 0.01) break;
      let sc = 0, why = [];
      if (big != null && big > s && big < s + Lc) { const pos = (big - s) / Lc; sc += 3 - Math.abs(pos - 0.5) * 6; why.push(`drop at ${(big - s).toFixed(1)} s`); }
      if (secs.some(x => Math.abs(x.t - s) < 0.05)) { sc += 1; why.push('starts on a section'); }
      const endGap = Math.min(...downbeats.map(d => Math.abs(d - (s + Lc)))); if (endGap < 0.15) { sc += 0.5; why.push('ends on a bar line'); }
      windows.push({ start: +s.toFixed(3), end: +(s + Lc).toFixed(3), score: +sc.toFixed(2), why: why.join(', ') || 'bar line' });
    }
    windows = windows.sort((p, q) => q.score - p.score).filter((w, i, arr) => arr.findIndex(o => Math.abs(o.start - w.start) < 4) === i).slice(0, 3);
  }

  const unsure = segs.length <= 1 && !steady;                     // no steady pulse: sparse drums, rubato, live playing
  return { file: path.basename(a._[0]), duration: +dur.toFixed(2), bpm, bpmGuess: +tp.bpm.toFixed(2), bpmConfidence: +tp.conf.toFixed(2), bpmAlternatives: tp.alt, fixedGrid: onGrid, tempoSteady: steady, beatsUnsure: unsure, tempoMap: segs.length > 1 ? tempoMap : [],
    firstBeat: +T[0].toFixed(3), firstDownbeat: +downbeats[0].toFixed(3), barConfidence: barConf, beats: T.map(t => +t.toFixed(3)), downbeats: downbeats.map(t => +t.toFixed(3)),
    barLoudness: barF.map(b => +b.rms.toFixed(1)), sections: secs, drops, accents, windows };
}

(async () => {
  const a = args(process.argv.slice(2));
  const file = a._[0];
  if (!file || !fs.existsSync(file)) { console.log('usage: node beats.js song.mp3 [--length 20] [--bpm 128] [--click] [--out song.beats.json]'); process.exit(2); }
  let r, x;
  try { x = await decode(file); r = main(x, a); }
  catch (e) { console.error(e.message); process.exit(3); }
  const out = a.out || file.replace(/\.[^.]+$/, '') + '.beats.json';
  fs.writeFileSync(out, JSON.stringify(r, null, 1));
  const f = s => s.toFixed(2).padStart(6);
  console.log(`${r.file}: ${r.duration} s · ${r.bpm} BPM${r.tempoSteady && r.bpmAlternatives.length ? ' (could also be ' + r.bpmAlternatives.map(x => x.bpm).join(' / ') + ')' : ''} · ${r.beatsUnsure ? 'BEATS UNSURE (no steady pulse): run with --click and let the user listen, or ask for the BPM' : r.tempoSteady ? 'steady tempo' : 'TEMPO CHANGES: ' + r.tempoMap.map(m => m.bpm + ' @' + m.t + 's').join(', ')}`);
  console.log(`first beat ${r.firstBeat} s · first bar ${r.firstDownbeat} s (bar confidence ${r.barConfidence}${r.barConfidence < 0.3 ? ', low: ask the user or check by ear' : ''}) · ${r.beats.length} beats`);
  console.log('sections:'); r.sections.forEach(s => console.log(`  ${f(s.t)} – ${f(s.end)}  ${String(s.bars).padStart(3)} bars  energy ${s.energy}  ${s.label}`));
  if (r.windows.length) { console.log(`clip windows (${a.length} s):`); r.windows.forEach(w => console.log(`  songStart ${w.start}  → ${w.end}   ${w.why}`)); }
  if (a.click) {                                                  // song + clicks on every beat (higher on bar starts): the user checks by ear
    const y = Float32Array.from(x, v => v * 0.6), bars = new Set(r.downbeats.map(t => Math.round(t * SR)));
    r.beats.forEach(t => { const i0 = Math.round(t * SR), hi = bars.has(i0), f = hi ? 1600 : 1000;
      for (let i = 0; i < 0.03 * SR && i0 + i < y.length; i++) y[i0 + i] += (hi ? 0.5 : 0.35) * Math.sin(2 * Math.PI * f * i / SR) * Math.exp(-i / (0.008 * SR)); });
    const wav = Buffer.alloc(44 + y.length * 2); wav.write('RIFF', 0); wav.writeUInt32LE(36 + y.length * 2, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(y.length * 2, 40); y.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
    const cf = file.replace(/\.[^.]+$/, '') + '.click.wav'; fs.writeFileSync(cf, wav); console.log('click check: ' + cf + ' (low click = beat, high click = bar start)');
  }
  console.log('written: ' + out);
})();
