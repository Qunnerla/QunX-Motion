#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
// Deep bug check AFTER the clip was sent (check.js stays the quick check before sending).
//   picture  : a frame every --step s in every promised aspect — text cut by the frame / its box, text on text, subtitles over
//              the main text, platform UI zones (9:16), unreadable contrast, tiny text, placeholders, black / empty frames,
//              flicker, jumps that are not cuts, long still spells, two scenes left on together, forward vs backward scrub
//   timeline : tweens fighting over one property, dead air, length vs the agreed length (±5 %), subtitles (overlap, too short)
//   sound    : rendered offline — clipping, loudness, silence where music should play, doubled / piled-up effects, bright pings too close, cuts off the beat
//   player   : play / pause, drag the bar, chapter buttons, fps menu, Music / SFX / CC, safe zone, fullscreen, keys, the loop,
//              real-time playback (dropped frames, console errors), then again on a phone-sized screen with a slow CPU
// usage: node qa.js clip.html [--aspect 16:9,9:16] [--length 20] [--fps 60] [--step 0.25] [--out qa-out] [--quick] [--beat-cut]
//   --length  the agreed length in seconds   --quick  skip real-time playback and the phone pass   --beat-cut  every cut must land on a beat
// output: <out>/report.md (read this), <out>/report.json, <out>/<n>-<time>.png = the frame of each finding, boxed in red
// exit: 0 = nothing high / medium, 1 = high or medium findings, 2 = could not run
const fs = require('fs');
const path = require('path');
const { launch, openClip, args } = require('./_browser');

const SEV = { high: 3, medium: 2, low: 1 };
const findings = [], ran = [], skipped = [];
const add = (sev, area, what, o = {}) => findings.push({ sev, area, what, ...o });
const lumRGB = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrastRGB = (p, q) => { const x = lumRGB(...p), y = lumRGB(...q); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// seek without letting a broken clip stop the check: the error becomes a finding
const SAFE_SEEK = t => { try { CLIP.seek(t); } catch (e) { (window.__qaErr = window.__qaErr || []).push(`${(+t).toFixed(2)} s: ${e.message}`); } };
const fmtT = t => (t == null ? '' : (+t).toFixed(2) + ' s');

// merge the same finding over consecutive samples into one time range; keep those that last `minDur`
function runs(hits, step, minDur = 0) {
  const by = {};
  for (const h of hits) (by[h.key] = by[h.key] || []).push(h);
  const out = [];
  for (const k in by) {
    const hs = by[k].sort((a, b) => a.t - b.t); let cur = null;
    for (const h of hs) {
      if (cur && h.t - cur.to <= step * 1.51) { cur.to = h.t; cur.n++; }
      else { if (cur) out.push(cur); cur = { ...h, from: h.t, to: h.t, n: 1 }; }
    }
    if (cur) out.push(cur);
  }
  return out.filter(r => r.to - r.from + step >= minDur - 1e-6);
}

/* ---------- in-page helpers (installed once per page) ---------- */
const PAGE_HELPERS = () => {
  window.__qa = { thumbs: {}, TW: 192 };
  const Q = window.__qa;
  const img = b64 => createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' }));
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  Q.contrast = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  Q.rgb = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length >= 3 && (p[3] === undefined || p[3] > 0.9) ? p.slice(0, 3) : null; };
  // decode a stage screenshot: keep a small thumbnail under `key`; for each text rect, the dominant colour behind it
  Q.fr = {};
  Q.take = async (key, b64, rects) => {
    const st0 = document.querySelector('#stage').getBoundingClientRect();     // where the user's videos are (fractions of the frame)
    Q.fr[key] = (window.CLIP && CLIP.FOOTAGE || []).filter(f => f.v.style.visibility === 'visible').map(f => { const r = f.v.getBoundingClientRect(); return { src: f.src, x: (r.left - st0.left) / st0.width, y: (r.top - st0.top) / st0.height, w: r.width / st0.width, h: r.height / st0.height }; });
    const bm = await img(b64), W = bm.width, H = bm.height;
    const th = Math.round(Q.TW * H / W), c = new OffscreenCanvas(Q.TW, th), x = c.getContext('2d');
    x.drawImage(bm, 0, 0, Q.TW, th); Q.thumbs[key] = x.getImageData(0, 0, Q.TW, th).data;
    const out = [];
    if (rects && rects.length) {
      const big = new OffscreenCanvas(W, H), bx = big.getContext('2d'); bx.drawImage(bm, 0, 0); const d = bx.getImageData(0, 0, W, H).data;
      for (const r of rects) {
        const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(W, Math.ceil(r.x + r.w)), y1 = Math.min(H, Math.ceil(r.y + r.h));
        if (x1 - x0 < 2 || y1 - y0 < 2) { out.push(null); continue; }
        // colour grades / glows change how the letters really look, so the ink is measured in the picture too (the cluster nearest the CSS colour)
        const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        const hist = new Map(), sx = Math.max(1, Math.floor((x1 - x0) / 60)), sy = Math.max(1, Math.floor((y1 - y0) / 30));
        const put = (xx, yy) => { const i = (yy * W + xx) * 4, p = [d[i], d[i + 1], d[i + 2]], k = (p[0] >> 4) + ',' + (p[1] >> 4) + ',' + (p[2] >> 4), e = hist.get(k) || { n: 0, s: [0, 0, 0] };
          e.n++; e.s[0] += p[0]; e.s[1] += p[1]; e.s[2] += p[2]; hist.set(k, e); };
        for (let yy = y0; yy < y1; yy += sy) for (let xx = x0; xx < x1; xx += sx) put(xx, yy);
        const cl = [...hist.values()].map(e => ({ n: e.n, c: e.s.map(v => v / e.n) })), tot = cl.reduce((a, e) => a + e.n, 0);
        let ink = null; for (const e of cl) if (e.n >= tot * 0.04 && dist(e.c, r.fg) < 170 && (!ink || dist(e.c, r.fg) < dist(ink.c, r.fg))) ink = e;
        const inkC = ink ? ink.c : r.fg;
        let bgC = null;
        if (r.glow) {                                   // glowing text: the halo is part of the letters, the background is the ring just outside it
          const hist2 = new Map(), pad = Math.round((y1 - y0) * 0.6), X0 = Math.max(0, x0 - pad), Y0 = Math.max(0, y0 - pad), X1 = Math.min(W, x1 + pad), Y1 = Math.min(H, y1 + pad);
          hist.clear(); for (let yy = Y0; yy < Y1; yy += sy) for (let xx = X0; xx < X1; xx += sx) if (xx < x0 - 2 || xx > x1 + 2 || yy < y0 - 2 || yy > y1 + 2) put(xx, yy);
          let best = null; for (const e of hist.values()) if (!best || e.n > best.n) best = e; if (best) bgC = best.s.map(v => v / best.n);
        } else { let best = null; for (const e of cl) if (dist(e.c, inkC) >= 70 && (!best || e.n > best.n)) best = e; if (best) bgC = best.c; }
        out.push({ bg: bgC || inkC, ink: inkC });
      }
    }
    return out;
  };
  Q.stats = key => { const d = Q.thumbs[key]; let s = 0, s2 = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += l; s2 += l * l; } const m = s / n; return { mean: m, std: Math.sqrt(Math.max(0, s2 / n - m * m)) }; };
  // ex = true: leave out videos that are on screen in both frames (their own picture moves on its own; appearing / vanishing still counts)
  Q.diff = (a, b, ex) => { const A = Q.thumbs[a], B = Q.thumbs[b], tw = Q.TW, th = A.length / 4 / tw;
    const R = ex ? (Q.fr[a] || []).filter(r => (Q.fr[b] || []).some(q => q.src === r.src && Math.abs(q.x - r.x) < 0.02 && Math.abs(q.y - r.y) < 0.02)) : [];
    const skip = R.map(r => [r.x * tw - 1, r.y * th - 1, (r.x + r.w) * tw + 1, (r.y + r.h) * th + 1]);
    let bad = 0, n = 0; for (let i = 0; i < A.length; i += 4) { if (skip.length) { const px = (i / 4) % tw, py = Math.floor(i / 4 / tw); if (skip.some(s => px >= s[0] && px <= s[2] && py >= s[1] && py <= s[3])) continue; } n++; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 60) bad++; } return bad / (A.length / 4); };
  // everything with text on the stage right now, in screenshot pixels
  Q.probe = () => {
    const st = document.querySelector('#stage').getBoundingClientRect(), k = st.width / CLIP.W, M = Math.min(CLIP.W, CLIP.H), items = [];
    const label = el => el.id ? '#' + el.id : (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''));
    const path = el => { const p = []; let e = el; while (e && e.id !== 'stage' && p.length < 3) { p.unshift(label(e)); if (e.id) break; e = e.parentElement; } return p.join(' ') ; };
    let qid = 0; const ids = new Map(); for (const el of document.querySelectorAll('#stage *')) ids.set(el, ++qid);
    for (const el of document.querySelectorAll('#stage *')) {
      if (el.closest('#safe') || el.closest('#qa-mark') || el.closest('[data-ghost]') || el.closest('svg') && el.tagName.toLowerCase() !== 'text') continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()), txt = own.map(n => n.textContent).join('').trim(); if (!txt) continue;
      let op = 1, e = el, hidden = false;
      while (e && e.id !== 'stage') { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none') { hidden = true; break; } op *= +s.opacity; e = e.parentElement; }
      if (hidden || op < 0.05) continue;
      let r = null; for (const n of own) { const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (!q.width || !q.height) continue;
        r = r ? { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; }
      if (!r) continue; r.width = r.right - r.left; r.height = r.bottom - r.top; if (r.width < 1 || r.height < 1) continue;
      const anc = []; for (let e2 = el.parentElement; e2 && e2.id !== 'stage'; e2 = e2.parentElement) anc.push(ids.get(e2));
      const cs = getComputedStyle(el);
      let box = null, b = el.parentElement;
      while (b && b.id !== 'stage' && !b.classList.contains('scene') && !b.classList.contains('world')) {
        const s = getComputedStyle(b), bg = Q.rgb(s.backgroundColor), clip = s.overflow !== 'visible' || s.overflowX !== 'visible';
        if (bg || clip || parseFloat(s.borderTopWidth) > 0) { const br = b.getBoundingClientRect(); box = { x: br.left - st.left, y: br.top - st.top, w: br.width, h: br.height, clip, bg: !!bg, label: label(b), k, isBox: true }; break; }
        b = b.parentElement;
      }
      const clipped = !!(b && box && box.clip && (b.classList.contains('mask')));
      items.push({ id: ids.get(el), anc, label: path(el), text: txt.slice(0, 40), x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height, op, size: r.height / k, M, k,
        fg: Q.rgb(cs.color), clipText: /text/.test(cs.webkitBackgroundClip || cs.backgroundClip || ''), glow: [el, el.parentElement].some(g => g && [getComputedStyle(g).filter, getComputedStyle(g).textShadow].some(f => [...(f || '').matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g)].some(m => +m[3] >= 2))), defocus: (() => { for (let g = el; g && g.id !== 'stage'; g = g.parentElement) { const m = /blur\(([\d.]+)px/.exec(getComputedStyle(g).filter); if (m && +m[1] >= 1.5) return true; } return false; })(), cap: !!el.closest('#cc'), box, mask: clipped, el: null });
    }
    // a scene counts as on screen only when something inside it is actually visible in the frame
    const seen = s => { const c = getComputedStyle(s); if (c.visibility === 'hidden' || +c.opacity <= 0.05) return false; let n = 0;
      for (const e of s.querySelectorAll('*')) { if (++n > 600) return true; if (e.children.length && e.tagName.toLowerCase() !== 'svg') continue;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.right < st.left || r.left > st.right || r.bottom < st.top || r.top > st.bottom) continue;
        let op = 1, v = true; for (let p = e; p && p !== s.parentElement; p = p.parentElement) { const q = getComputedStyle(p); if (q.visibility === 'hidden' || q.display === 'none') { v = false; break; } op *= +q.opacity; }
        if (v && op > 0.05) return true; }
      return false; };
    const scenes = [...document.querySelectorAll('#stage .scene:not([data-ghost])')].filter(seen).map(s => s.id || s.className);
    return { items, scenes, SW: st.width, SH: st.height, k };
  };
  // every tween with an absolute start / end, the props it drives and its targets (keyframes and staggers opened up)
  Q.tweens = () => {
    const SPECIAL = new Set(['duration', 'ease', 'delay', 'stagger', 'onUpdate', 'onComplete', 'onStart', 'onReverseComplete', 'onRepeat', 'keyframes', 'overwrite', 'immediateRender', 'repeat', 'yoyo', 'repeatDelay', 'id', 'callbackScope', 'startAt', 'runBackwards', 'data', 'paused', 'inherit', 'lazy', 'transformOrigin', 'onUpdateParams', 'onCompleteParams', 'onStartParams', 'yoyoEase', 'reversed', 'autoRevert', 'parent', 'modifiers', 'snap', 'svgOrigin', 'smoothOrigin', 'force3D', 'clearProps', 'easeEach', 'onInterrupt']);
    const ALIAS = { autoAlpha: 'opacity', rotate: 'rotation', scale: ['scaleX', 'scaleY'] };
    const ids = new Map(); let nid = 0; window.__qaEls = {}; const idOf = o => { if (!ids.has(o)) { ids.set(o, ++nid); window.__qaEls[nid] = o; } return ids.get(o); };
    const name = o => o instanceof Element ? (o.id ? '#' + o.id : o.tagName.toLowerCase() + (typeof o.className === 'string' && o.className ? '.' + o.className.split(' ')[0] : '')) : (Object.keys(o).length ? 'object{' + Object.keys(o).slice(0, 2).join(',') + '}' : '{}');
    const out = [];
    const walk = (tl, off) => tl.getChildren(false, true, true).forEach(c => {
      const s = off + c.startTime();
      if (c instanceof gsap.core.Timeline) return walk(c, s);
      if (c.timeline && c.timeline.getChildren(false, true, true).length) return walk(c.timeline, s);
      const props = []; for (const kk of Object.keys(c.vars || {})) { if (SPECIAL.has(kk) || typeof c.vars[kk] === 'function' && kk.startsWith('on')) continue; const a = ALIAS[kk] || kk; (Array.isArray(a) ? a : [a]).forEach(p => props.push(p)); }
      const targets = (c.targets() || []).map(o => ({ id: idOf(o), name: name(o), dom: o instanceof Element, empty: !(o instanceof Element) && !Object.keys(o).length }));
      const vis = ['autoAlpha', 'opacity', 'visibility', 'display'].filter(p => p in (c.vars || {})).map(p => { const v = c.vars[p]; return p === 'visibility' ? (v === 'hidden' ? 0 : 1) : p === 'display' ? (v === 'none' ? 0 : 1) : +v; })[0];
      out.push({ s, e: s + c.totalDuration(), d: c.totalDuration(), props, targets, vis: vis === undefined || isNaN(vis) ? null : vis });
    });
    walk(CLIP.tl, 0);
    return out;
  };
  // the sound, rendered offline, measured in the page (nothing big crosses to Node)
  Q.audio = async (musicOnly = false) => {
    const all = CLIP.CUES.slice();                         // musicOnly: render the music without the effects, to find where it drops out
    if (musicOnly) { const keep = all.filter(c => typeof groupOf === 'function' && groupOf(c.type) === 'music'); CLIP.CUES.splice(0, CLIP.CUES.length, ...keep); }
    let L, R; try { [L, R] = await CLIP.renderAudio(48000); } finally { CLIP.CUES.splice(0, CLIP.CUES.length, ...all); }
    const sr = 48000, n = L.length;
    let peak = 0, clipped = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
    const win = sr / 10, rms = []; for (let i = 0; i + win <= n; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += (L[j] * L[j] + R[j] * R[j]) / 2; rms.push(Math.sqrt(s / win)); }
    const db = v => 20 * Math.log10(Math.max(v, 1e-9));
    const blocks = []; for (let i = 0; i + 4 <= rms.length; i += 1) blocks.push(Math.sqrt((rms[i] ** 2 + rms[i + 1] ** 2 + rms[i + 2] ** 2 + rms[i + 3] ** 2) / 4));
    const gated = blocks.filter(v => db(v) > -60), integ = gated.length ? db(Math.sqrt(gated.reduce((a, v) => a + v * v, 0) / gated.length)) : -120;
    return { peak, peakDb: db(peak), clipped, rmsDb: rms.map(v => +db(v).toFixed(1)), integratedDb: +integ.toFixed(1), seconds: n / sr };
  };
};

(async () => {
  const a = args(process.argv.slice(2), { out: 'qa-out', step: '0.25' });
  const file = a._[0];
  if (!file) { console.log('usage: node qa.js clip.html [--aspect 16:9,9:16] [--length 20] [--fps 60] [--step 0.25] [--out qa-out] [--quick] [--beat-cut]'); process.exit(2); }
  fs.mkdirSync(a.out, { recursive: true });
  for (const f of fs.readdirSync(a.out)) if (/^\d+-.*\.png$/.test(f)) fs.unlinkSync(path.join(a.out, f));
  const step = Math.max(0.05, +a.step), browser = await launch();
  const aspects = a.aspect && a.aspect !== true ? String(a.aspect).split(',').map(s => s.trim()) : [null];
  const shotsToTake = [];                               // findings that get a picture: {i, aspect, t, rects}
  let meta = null;

  /* ================= 1. picture + timeline, per aspect ================= */
  for (const asp of aspects) {
    const { page, errors } = await openClip(browser, file, { width: 1000, height: 760, query: { aspect: asp, safe: '' } });
    await page.evaluate(PAGE_HELPERS);
    const info = await page.evaluate(() => ({ END: CLIP.END, W: CLIP.W, H: CLIP.H, ch: CLIP.CHAPTERS.map(c => ({ t: c.t, n: c.n })).sort((x, y) => x.t - y.t),
      caps: CLIP.CAPTIONS.map(c => ({ t: c.t, end: c.end, text: String(c.text).replace(/<[^>]+>/g, '') })),
      cfg: typeof CONFIG !== 'undefined' ? { fps: CONFIG.fps, bpm: CONFIG.bpm, bed: CONFIG.bed, music: !!CONFIG.music, mood: CONFIG.mood, captions: CONFIG.captions } : {},
      useBeat: !!window.USE_BEAT, hush: typeof HUSH !== 'undefined' ? HUSH : [], BT: CLIP.BT || null,
      trans: typeof TRANS !== 'undefined' ? TRANS.map(x => ({kind: x.kind, from: x.from, to: x.to})) : [], endAt: (CLIP.CHAPTERS.find(c => c.end) || {}).t ?? null }));
    const A = asp || `${info.W}:${info.H}`.replace('1920:1080', '16:9').replace('1080:1920', '9:16'), VERT = info.H > info.W, M = Math.min(info.W, info.H);
    const fps = +(a.fps || info.cfg.fps || 60), frame = 1 / fps, END = info.END;
    if (!meta) meta = { ...info, fps };
    const cutTimes = info.ch.map(c => c.t);
    const twEarly = await page.evaluate(() => __qa.tweens());
    const visSets = twEarly.filter(x => x.d <= 1e-6 && x.vis != null).map(x => x.s);   // scene switches: the blink check covers these
    const nearCut = (t, tol = 0.12) => cutTimes.some(c => Math.abs(c - t) <= tol);
    const inTrans = (a, b = a) => info.trans.some(w => b >= w.from - 0.1 && a <= w.to + 0.1);   // inside a transition: overlaps, blur and odd frames are the point

    const times = []; for (let t = 0; t < END - 1e-3; t += step) times.push(+t.toFixed(3));
    info.ch.forEach(c => { times.push(+Math.min(END - 0.02, c.t + 0.05).toFixed(3)); });
    times.push(+(END - 0.02).toFixed(3));
    const T = [...new Set(times)].sort((x, y) => x - y);

    const shoot = async (key, t, withProbe) => {
      await page.evaluate(SAFE_SEEK, t);
      await page.evaluate(() => CLIP.settle && CLIP.settle());
      await page.waitForTimeout(25);
      const pr = withProbe ? await page.evaluate(() => __qa.probe()) : null;
      const b64 = (await page.locator('#stage').screenshot()).toString('base64');
      const bgs = await page.evaluate(({ key, b64, rects }) => __qa.take(key, b64, rects), { key, b64, rects: pr ? pr.items.filter(i => i.fg && !i.clipText && i.op > 0.95).map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h, fg: i.fg, glow: i.glow })) : [] });
      if (pr) { let j = 0; pr.items.forEach(i => { if (i.fg && !i.clipText && i.op > 0.95) { const o = bgs[j++]; if (o) { i.bg = o.bg; i.fg = o.ink; } } }); }
      return pr;
    };

    const probes = [];
    for (const t of T) probes.push({ t, ...(await shoot('f' + t, t, true)) });
    // backwards: same times, from the end
    await page.evaluate(SAFE_SEEK, END - 0.01);
    for (const t of [...T].reverse()) await shoot('r' + t, t, false);
    ran.push(`picture ${A}: ${T.length} frames every ${step} s + the same frames scrubbing backwards`);

    const hits = [], placeholders = new Map();
    const SAFE = { t: 210, b: 320, l: 60, r: 120 };        // "all platforms" (largest of TikTok / Reels / Shorts), 1080×1920
    for (const p of probes) {
      const k = p.k, inStage = (x, y, w, h) => { const ix = Math.max(0, Math.min(x + w, p.SW) - Math.max(x, 0)), iy = Math.max(0, Math.min(y + h, p.SH) - Math.max(y, 0)); return ix * iy / Math.max(1, w * h); };
      const shown = p.items.filter(i => i.op > 0.5);
      for (const i of shown) {
        const frac = inStage(i.x, i.y, i.w, i.h), big = i.size >= M * 0.03;
        const boxIn = i.box ? inStage(i.box.x, i.box.y, i.box.w, i.box.h) : 1;   // a card peeking in from the side is composition, not a bug
        if (big && frac > 0.6 && frac < 0.97 && boxIn > 0.8) hits.push({ key: 'edge|' + i.label + '|' + i.text, t: p.t, sev: 'medium', area: 'picture', what: `text cut by the frame edge: "${i.text}"`, where: i.label, rects: [i] });
        if (i.box && !i.cap && i.op > 0.9) {
          const B = i.box, tol = Math.max(2, 3 * k), tv = tol + (B.clip ? 0.3 * i.h : 0);    // a line box is taller than the letters: allow that inside masks
          const out = i.x < B.x - tol || i.y < B.y - tv || i.x + i.w > B.x + B.w + tol || i.y + i.h > B.y + B.h + tv;
          if (out && frac > 0.97 && inStage(B.x, B.y, B.w, B.h) > 0.97) hits.push({ key: 'box|' + i.label + '|' + i.text, t: p.t, sev: 'high', area: 'picture',
            what: B.clip ? `text cut off by its box (${B.label}): "${i.text}"` : `text spills out of its box (${B.label}): "${i.text}"`, where: i.label, rects: [i, { ...B, box: true }] });
        }
        if (i.size < M * 0.022 && i.op > 0.9 && !i.cap && frac > 0.97) hits.push({ key: 'small|' + i.label, t: p.t, sev: 'low', area: 'picture', what: `text too small to read on a phone (${Math.round(i.size)} px of ${M}): "${i.text}"`, where: i.label, rects: [i] });
        if (/\[[^\]]{2,}\]|PLACEHOLDER|lorem ipsum|\bTODO\b/i.test(i.text) && !placeholders.has(i.text)) placeholders.set(i.text, { t: p.t, i });
        if (i.bg && i.fg && i.op > 0.95 && frac > 0.97 && !i.defocus) {                 // blurred on purpose (rack focus, depth of field) is not a contrast bug
          const cr = contrastRGB(i.fg, i.bg);
          if (cr < 1.6) hits.push({ key: 'inv|' + i.label, t: p.t, sev: 'high', area: 'picture', what: `text almost invisible on its background (${cr.toFixed(1)}:1): "${i.text}"`, where: i.label, rects: [i] });
          else if (cr < (i.size >= M * 0.05 ? 2.2 : 3)) hits.push({ key: 'lowc|' + i.label, t: p.t, sev: 'medium', area: 'picture', what: `low contrast (${cr.toFixed(1)}:1): "${i.text}"`, where: i.label, rects: [i] });
        }
        if (VERT && frac > 0.5 && (i.cap || boxIn > 0.8)) {                  // a neighbour card peeking in at the bottom is composition
          const z = SAFE, kk = p.SW / 1080, inZone = i.y < z.t * kk || i.y + i.h > p.SH - z.b * kk || i.x + i.w > p.SW - z.r * kk || i.x < z.l * kk;
          if (inZone && (i.cap || i.size >= M * 0.03)) hits.push({ key: 'safe|' + i.label + '|' + i.text, t: p.t, sev: i.cap ? 'high' : 'medium', area: 'picture', what: `${i.cap ? 'subtitle' : 'text'} under the TikTok / Reels / Shorts buttons: "${i.text}"`, where: i.label, rects: [i] });
        }
      }
      // text on text, subtitles over the main text
      for (let x = 0; x < shown.length; x++) for (let y = x + 1; y < shown.length; y++) {
        const P = shown[x], Q2 = shown[y];
        if (P.anc.includes(Q2.id) || Q2.anc.includes(P.id)) continue;
        const ix = Math.max(0, Math.min(P.x + P.w, Q2.x + Q2.w) - Math.max(P.x, Q2.x)), iy = Math.max(0, Math.min(P.y + P.h, Q2.y + Q2.h) - Math.max(P.y, Q2.y)), inter = ix * iy;
        if (!inter) continue;
        const small = Math.min(P.w * P.h, Q2.w * Q2.h);
        if (P.cap || Q2.cap) { const o = P.cap ? Q2 : P; if (o.size >= M * 0.03 && inter > 0.05 * o.w * o.h) hits.push({ key: 'cc|' + o.label, t: p.t, sev: 'high', area: 'picture', what: `subtitle covers "${o.text}"`, where: o.label, rects: [P, Q2] }); }
        else if (inter > 0.2 * small && Math.max(P.size, Q2.size) >= M * 0.025) hits.push({ key: 'tt|' + [P.label, Q2.label].sort().join('+'), t: p.t, sev: 'medium', area: 'picture', what: `text on top of text: "${P.text}" / "${Q2.text}"`, where: P.label + ' + ' + Q2.label, rects: [P, Q2] });
      }
      if (p.scenes.length > 1) hits.push({ key: 'scenes|' + p.scenes.join('+'), t: p.t, sev: 'medium', area: 'picture', what: `two scenes on screen together (${p.scenes.join(' + ')})`, where: p.scenes.join(', '), rects: [] });
    }
    // how long a hit must last to count: moving things cross edges and each other on purpose
    const MIN = { edge: 0.75, box: 0.5, small: 1, ph: 0, inv: 0.5, lowc: 0.75, safe: 0.5, cc: 0.5, tt: 0.5, scenes: 1.0 };
    const perKind = {}, extra = {};                      // at most 6 of one kind per aspect; the rest become one summary line
    for (const r of runs(hits, step).sort((x, y) => x.from - y.from)) {
      const kind = r.key.split('|')[0];
      if (r.to - r.from + step < (MIN[kind] || 0) - 1e-6) continue;
      if (kind !== 'ph' && kind !== 'safe' && kind !== 'small' && info.trans.length && hits.filter(h => h.key === r.key && h.t >= r.from && h.t <= r.to).every(h => inTrans(h.t))) continue;
      if ((perKind[kind] = (perKind[kind] || 0) + 1) > 6) { (extra[kind] = extra[kind] || { n: 0, sev: r.sev, what: r.what.split(':')[0] }).n++; continue; }
      add(r.sev, r.area, r.what, { t: r.from, to: r.to, aspect: A, where: r.where, rects: r.rects });
    }
    for (const k in extra) add(extra[k].sev === 'high' ? 'high' : 'medium', 'picture', `+${extra[k].n} more of "${extra[k].what}" — fix the ones above first, then re-run`, { aspect: A, rects: [] });

    if (placeholders.size && asp === aspects[0]) { const L = [...placeholders.entries()]; add('medium', 'picture', `placeholder text still on screen (${L.length}): ${L.slice(0, 8).map(([x]) => '"' + x + '"').join(', ')}${L.length > 8 ? ' …' : ''}`, { t: L[0][1].t, aspect: A, rects: L.filter(([, v]) => Math.abs(v.t - L[0][1].t) < 0.01).map(([, v]) => v.i) }); }
    // pixels: black / empty frames, flicker, jumps that are not cuts, long still spells, backwards scrub
    const st = {}; for (const t of T) st[t] = await page.evaluate(k => __qa.stats(k), 'f' + t);
    const d = []; for (let i = 0; i + 1 < T.length; i++) d.push(await page.evaluate(([x, y]) => __qa.diff(x, y), ['f' + T[i], 'f' + T[i + 1]]));
    const hasF = await page.evaluate(() => !!(window.CLIP && CLIP.FOOTAGE && CLIP.FOOTAGE.length));
    const dx = []; for (let i = 0; i + 1 < T.length; i++) dx.push(hasF ? await page.evaluate(([x, y]) => __qa.diff(x, y, true), ['f' + T[i], 'f' + T[i + 1]]) : d[i]);   // without the videos' own motion
    for (let i = 1; i + 1 < T.length; i++) {
      const t = T[i], s = st[t], prev = st[T[i - 1]], next = st[T[i + 1]];
      const empty = s.std < 2.5, busyAround = prev.std > 6 && next.std > 6;
      if (t > 0.3 && t < END - 0.3 && empty && busyAround && !inTrans(t)) add(s.mean < 8 ? 'high' : 'medium', 'picture', s.mean < 8 ? 'black frame between two shots' : 'empty frame between two shots (nothing on screen)', { t, aspect: A, rects: [] });
    }
    for (let i = 1; i + 1 < T.length; i++) {
      const d02 = await page.evaluate(([x, y]) => __qa.diff(x, y), ['f' + T[i - 1], 'f' + T[i + 1]]);
      if (d[i - 1] > 0.3 && d[i] > 0.3 && d02 < 0.08 && T[i + 1] - T[i - 1] <= step * 2.2 && !inTrans(T[i])) add(nearCut(T[i], 0.3) ? 'low' : 'medium', 'picture', 'flash / flicker: one frame looks different from both neighbours', { t: T[i], aspect: A, rects: [] });
    }
    const fEdges = await page.evaluate(() => (CLIP.FOOTAGE || []).flatMap(f => [{ t: f.a != null ? f.a : f.t, src: f.src, k: 'appears' }, { t: f.b != null ? f.b : f.t + f.dur, src: f.src, k: 'disappears' }]));
    // jumps: a big change between two samples that happens inside ONE frame, away from any chapter start
    let snaps = 0, bis = 0;
    for (let i = 0; i < dx.length && snaps < 12; i++) {
      if (dx[i] < 0.02 || inTrans(T[i], T[i + 1]) || ++bis > 60) continue;
      let lo = T[i], hi = T[i + 1], loK = 'f' + lo, hiK = 'f' + hi, n = 0;
      while (hi - lo > frame * 1.5 && n++ < 8) {
        const mid = +((lo + hi) / 2).toFixed(4), key = 'b' + mid; await shoot(key, mid, false);
        const d1 = await page.evaluate(([x, y]) => __qa.diff(x, y, true), [loK, key]), d2 = await page.evaluate(([x, y]) => __qa.diff(x, y, true), [key, hiK]);
        if (d1 >= d2) { hi = mid; hiK = key; } else { lo = mid; loK = key; }
      }
      const dj = await page.evaluate(([x, y]) => __qa.diff(x, y, true), [loK, hiK]);
      let around = 0;                                   // fast motion changes a lot every frame; a snap changes a lot in ONE frame only
      if (dj > 0.5 * dx[i] && dj > 0.015 && !nearCut(hi, 0.1) && !nearCut(lo, 0.1)) {
        const pa = Math.max(0, lo - frame), pb = Math.min(END - 0.01, hi + frame); await shoot('pa', pa, false); await shoot('pb', pb, false);
        around = Math.max(await page.evaluate(([x, y]) => __qa.diff(x, y, true), ['pa', loK]), await page.evaluate(([x, y]) => __qa.diff(x, y, true), [hiK, 'pb']));
      }
      if (dj > 0.5 * dx[i] && dj > 0.015 && dj > 3 * around && !nearCut(hi, 0.1) && !nearCut(lo, 0.1) && !visSets.some(v => Math.abs(v - hi) < 0.05 || Math.abs(v - lo) < 0.05)) { snaps++; const edge = fEdges.find(e => Math.abs(e.t - hi) < 0.06 || Math.abs(e.t - lo) < 0.06); add('medium', 'picture', `sudden jump inside a shot (${Math.round(dj * 100)} % of the frame changes in one frame, no chapter starts here)${edge ? ` — video "${edge.src}" ${edge.k} here: widen footage(…, {show:[a, b]}) so its first / last frame waits in the frame` : ''}`, { t: lo, to: hi, aspect: A, rects: [] }); }
    }
    // instant sets that move something already on screen (tl.set x / y / scale … mid-shot) = a visible jump
    const MOVE = /^(x|y|xPercent|yPercent|scaleX|scaleY|rotation|left|top|width|height)$/;
    let setJumps = 0;
    for (const x of twEarly) {
      if (x.d > 1e-6 || !x.props.some(p => MOVE.test(p)) || nearCut(x.s, 0.1) || x.s < 0.05 || setJumps >= 10) continue;
      for (const g of x.targets.filter(g => g.dom)) {
        const r = await page.evaluate(({ id, t }) => {
          const el = window.__qaEls[id]; if (!el) return null;
          const box = () => { const q = el.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; };
          const vis = () => { let op = 1; for (let e = el; e && e.id !== 'stage'; e = e.parentElement) { const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') return 0; op *= +c.opacity; } return op; };
          const st = document.querySelector('#stage').getBoundingClientRect();
          try { CLIP.seek(Math.max(0, t - 0.004)); } catch (e) {} const a = box(), va = vis();
          try { CLIP.seek(t + 0.004); } catch (e) {} const b = box(), vb = vis();
          const moved = Math.max(...a.map((v, i) => Math.abs(v - b[i]))) / st.width, inFrame = b[0] < st.right && b[0] + b[2] > st.left && b[1] < st.bottom && b[1] + b[3] > st.top;
          return { moved, shown: Math.min(va, vb) > 0.3 && inFrame };
        }, { id: g.id, t: x.s });
        if (r && r.shown && r.moved > 0.01) { setJumps++; add('medium', 'picture', `${g.name} jumps ${Math.round(r.moved * 100)} % of the frame in one frame (tl.set ${x.props.join(', ')} at ${x.s.toFixed(2)} s while it is on screen, not at a cut)`, { t: x.s + 0.004, aspect: A, where: g.name, rects: [] }); }
      }
    }
    // still spells (core rule: the camera never sits still)
    let s0 = null;
    for (let i = 0; i <= d.length; i++) {
      const still = i < d.length && d[i] < 0.002;
      if (still && s0 == null) s0 = T[i];
      if (!still && s0 != null) { const e = T[i], len = e - s0; if (len >= 2.25 && s0 > 0.3 && e < END - 2.6) add(len >= 3.5 ? 'medium' : 'low', 'picture', `nothing moves for ${len.toFixed(1)} s (keep a slow push-in while text is read)`, { t: s0, to: e, aspect: A, rects: [] }); s0 = null; }
    }
    // backwards scrub
    const bad = []; for (const t of T) { const x = await page.evaluate(([p, q]) => __qa.diff(p, q), ['f' + t, 'r' + t]); if (x > 0.004) bad.push({ key: 'rev', t, x }); }
    for (const r of runs(bad, step)) add(r.to - r.from >= 0.5 ? 'high' : 'medium', 'timeline', `looks different when scrubbed backwards (references/gotchas.md)`, { t: r.from, to: r.to, aspect: A, rects: [] });

    // timeline + subtitles + length: only once
    if (asp === aspects[0]) {
      const tw = await page.evaluate(() => __qa.tweens());
      const lanes = {};
      for (const x of tw) { if (x.d <= 1e-6) continue; for (const g of x.targets) { if (g.empty) continue; for (const p of x.props) (lanes[g.id + '|' + p] = lanes[g.id + '|' + p] || { name: g.name, p, list: [] }).list.push(x); } }
      let fights = 0;
      for (const k in lanes) {
        const L = lanes[k].list.sort((u, v) => u.s - v.s);
        for (let i = 1; i < L.length; i++) for (let j = 0; j < i; j++) {
          const ov = Math.min(L[j].e, L[i].e) - L[i].s;
          if (ov > frame + 1e-4 && fights < 20) { fights++; add('medium', 'timeline', `two tweens move ${lanes[k].name} ${lanes[k].p} at the same time (${L[j].s.toFixed(2)}–${L[j].e.toFixed(2)} s and ${L[i].s.toFixed(2)}–${L[i].e.toFixed(2)} s): it jumps when the second one ends`, { t: L[i].s, to: Math.min(L[j].e, L[i].e), where: lanes[k].name, rects: [] }); }
        }
      }
      // blinks: an instant hide then show (or show then hide) of the same element within 0.3 s — a flicker the 0.25 s frames can miss
      const sets = {}; for (const x of tw) if (x.d <= 1e-6 && x.vis != null) for (const g of x.targets) if (g.dom) (sets[g.id] = sets[g.id] || { name: g.name, list: [] }).list.push({ t: x.s, v: x.vis > 0.05 ? 1 : 0 });
      for (const k in sets) { const L = sets[k].list.sort((u, v) => u.t - v.t);
        for (let i = 1; i < L.length; i++) if (L[i].v !== L[i - 1].v && L[i].t - L[i - 1].t > 1e-3 && L[i].t - L[i - 1].t < 0.3 && L[i - 1].t > 0.05) {
          const off = L[i - 1].v === 0; add(nearCut(L[i - 1].t, 0.05) && nearCut(L[i].t, 0.35) ? 'low' : 'high', 'picture', `${sets[k].name} ${off ? 'blinks off' : 'flashes on'} for ${Math.round((L[i].t - L[i - 1].t) * 1000)} ms (tl.set at ${L[i - 1].t.toFixed(2)} s and ${L[i].t.toFixed(2)} s)`, { t: L[i - 1].t + 0.001, to: L[i].t, where: sets[k].name, rects: [] }); } }
      // dead air: nothing tweens on the stage
      const iv = tw.filter(x => x.d > 1e-6 && x.targets.some(g => g.dom)).map(x => [x.s, x.e]).sort((u, v) => u[0] - v[0]);
      let cur = 0; for (const [s, e] of iv) { if (s - cur >= 1.5 && cur > 0.3 && s < END - 2.6) add('low', 'timeline', `no tween runs for ${(s - cur).toFixed(1)} s`, { t: cur, to: s, rects: [] }); cur = Math.max(cur, e); }
      ran.push(`timeline: ${tw.length} tweens, ${Object.keys(lanes).length} target/property lanes`);
      // agreed length
      if (a.length && a.length !== true) {
        const L = +a.length, off = (END - L) / L;
        if (Math.abs(off) > 0.05) add('high', 'timeline', `clip is ${END.toFixed(2)} s, agreed ${L} s (${off > 0 ? '+' : ''}${(off * 100).toFixed(0)} %): ask the user before sending (SKILL.md › Length is agreed)`, { rects: [] });
        ran.push(`length: ${END.toFixed(2)} s vs agreed ${L} s`);
      } else skipped.push('length vs agreed length (pass --length <seconds>)');
      // chapters and subtitles
      for (let i = 1; i < info.ch.length; i++) if (info.ch[i].t - info.ch[i - 1].t < 0.2) add('low', 'timeline', `chapters "${info.ch[i - 1].n}" and "${info.ch[i].n}" start ${Math.round((info.ch[i].t - info.ch[i - 1].t) * 1000)} ms apart`, { t: info.ch[i].t, rects: [] });
      if (info.ch.some(c => c.t > END)) add('low', 'timeline', 'a chapter starts after the end of the clip', { rects: [] });
      const caps = info.caps.slice().sort((x, y) => x.t - y.t);
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i], len = c.end - c.t, need = 0.8 + [...c.text].length * 0.055;
        if (i && caps[i - 1].end > c.t + 0.01) add('medium', 'subtitles', `two subtitles overlap: "${caps[i - 1].text}" / "${c.text}"`, { t: c.t, rects: [] });
        if (len < need) add('low', 'subtitles', `subtitle on screen ${len.toFixed(1)} s, needs about ${need.toFixed(1)} s to read: "${c.text}"`, { t: c.t, rects: [] });
        if (c.end > END + 0.01) add('low', 'subtitles', `subtitle runs past the end: "${c.text}"`, { t: c.t, rects: [] });
      }
    }
    const qErr = await page.evaluate(() => window.__qaErr || []);
    if (qErr.length) add('high', 'timeline', `the clip throws an error at ${qErr.length} frame(s) — first: ${qErr[0].slice(0, 160)}`, { t: parseFloat(qErr[0]), aspect: A, rects: [] });
    if (errors.length) [...new Set(errors)].forEach(e => add('high', 'player', 'console error while scrubbing: ' + e.slice(0, 160), { rects: [] }));
    // remember which aspect page to reuse for pictures
    shotsToTake.push({ asp, A });
    await page.close();
  }

  /* ================= 2. sound (offline render) ================= */
  const END = meta.END, fps = meta.fps;
  {
    const { page } = await openClip(browser, file, { width: 1000, height: 760, query: { aspect: aspects[0] } });
    await page.evaluate(PAGE_HELPERS);
    let au = null; try { au = await page.evaluate(() => __qa.audio()); } catch (e) { skipped.push('sound: renderAudio failed (' + e.message.split('\n')[0] + ')'); }
    const cues = await page.evaluate(() => CLIP.CUES.map(c => ({ t: c.t + (c.late || 0), type: c.type, g: typeof groupOf === 'function' ? groupOf(c.type) : 'sfx' })));
    if (au) {
      const music = meta.cfg.music || meta.cfg.bed;
      if (au.clipped > 10) add('high', 'sound', `sound clips: ${au.clipped} samples at full scale (peak ${au.peakDb.toFixed(1)} dBFS) — lower the loudest cues or the master`, { rects: [] });
      else if (au.peakDb > -0.3) add('medium', 'sound', `peak ${au.peakDb.toFixed(2)} dBFS, right at the limit`, { rects: [] });
      if (au.integratedDb > -8) add('medium', 'sound', `very loud overall (${au.integratedDb} dBFS RMS)`, { rects: [] });
      else if (au.integratedDb < -30 && au.integratedDb > -100) add('low', 'sound', `quiet overall (${au.integratedDb} dBFS RMS)`, { rects: [] });
      if (au.integratedDb <= -100) add(cues.length ? 'high' : 'low', 'sound', cues.length ? 'the clip has sound cues but renders silent' : 'the clip has no sound at all', { rects: [] });
      // silence where sound should be
      const inHush = t => (meta.hush || []).some(([x, y]) => t >= x - 0.1 && t <= y + 0.1), quiet = [];
      const mu = music ? await page.evaluate(() => __qa.audio(true)).catch(() => null) : null, src = mu || au;   // music alone, when there is music
      const mid = src.rmsDb.slice(3, -6).slice().sort((x, y) => x - y), med = mid.length ? mid[mid.length >> 1] : -60, thr = mu ? Math.min(-40, med - 20) : -55;
      src.rmsDb.forEach((v, i) => { const t = i / 10; if (v < thr && t > 0.3 && t < END - 0.6 && !inHush(t) && !(meta.endAt != null && t > meta.endAt + 1.2)) quiet.push({ key: 'q', t }); });
      for (const r of runs(quiet, 0.1)) { const len = r.to - r.from + 0.1; if (music ? len >= 0.8 : len >= 3) add(music ? 'medium' : 'low', 'sound', `silent for ${len.toFixed(1)} s${music ? ' while the music should play' : ''}`, { t: r.from, to: r.to + 0.1, rects: [] }); }
      ran.push(`sound: peak ${au.peakDb.toFixed(1)} dBFS, ${au.integratedDb} dBFS RMS, ${au.seconds.toFixed(1)} s rendered`);
    }
    // effects that double up or pile up
    const sfx = cues.filter(c => c.g === 'sfx').sort((x, y) => x.t - y.t);
    for (let i = 1; i < sfx.length; i++) if (sfx[i].type === sfx[i - 1].type && sfx[i].t - sfx[i - 1].t < 0.035) {
      let j = i; while (j + 1 < sfx.length && sfx[j + 1].type === sfx[i].type && sfx[j + 1].t - sfx[j].t < 0.035) j++;
      add('medium', 'sound', `"${sfx[i].type}" plays ${j - i + 2}× within ${Math.max(1, Math.round((sfx[j].t - sfx[i - 1].t) * 1000))} ms (sounds doubled / flanged, and adds up loud)`, { t: sfx[i - 1].t, rects: [] }); i = j; }
    for (let i = 0; i + 3 < sfx.length; i++) if (sfx[i + 3].t - sfx[i].t < 0.1) { let j = i + 3; while (j + 1 < sfx.length && sfx[j + 1].t - sfx[i].t < 0.1) j++;
      const kinds = [...new Set(sfx.slice(i, j + 1).map(c => c.type))]; add('low', 'sound', `${j - i + 1} effects start within 0.1 s (${kinds.join(', ')}): a pile-up, keep the one that matters`, { t: sfx[i].t, rects: [] }); i = j; }
    const HEAVY = /impact|boom|hit|slam|stamp|crash|sub/;
    for (let i = 1; i < sfx.length; i++) if (HEAVY.test(sfx[i].type) && HEAVY.test(sfx[i - 1].type) && sfx[i].t - sfx[i - 1].t < 0.08 && sfx[i].type !== sfx[i - 1].type) add('low', 'sound', `two heavy hits together (${sfx[i - 1].type} + ${sfx[i].type})`, { t: sfx[i].t, rects: [] });
    // bright pings (bells) too close together — pick one (references/sound.md › Less is more)
    const PING = /^(ding|softding|shimmer|tick)$/, pings = sfx.filter(c => PING.test(c.type));
    for (let i = 1; i < pings.length; i++){ const a = pings[i - 1], b = pings[i];
      if (b.t - a.t < 1.5 && !(a.type === 'tick' && b.type === 'tick')) add('medium', 'sound', `two bright pings ${((b.t - a.t) * 1000).toFixed(0)} ms apart (${a.type} → ${b.type}): keep one, give the other move a non-bell sound or none`, { t: a.t, to: b.t, rects: [] }); }
    ran.push(`sound cues: ${cues.length} (${sfx.length} effects)`);
    // cuts on the beat
    const beatCut = a['beat-cut'] || meta.cfg.music || meta.useBeat;
    const beatAt = meta.BT && meta.BT.length > 1 ? meta.BT : (meta.cfg.bpm ? Array.from({ length: Math.ceil(END * meta.cfg.bpm / 60) + 2 }, (_, i) => i * 60 / meta.cfg.bpm) : null);
    if (beatAt && (beatCut || meta.cfg.bed)) {
      const off = meta.ch.filter(c => c.t > 0.05).map(c => ({ c, dt: Math.min(...beatAt.map(b => Math.abs(b - c.t))) })).filter(x => x.dt > 1 / fps + 1e-4);
      if (beatCut) off.forEach(x => add('medium', 'sound', `cut "${x.c.n}" is ${Math.round(x.dt * 1000)} ms off the beat (more than 1 frame)`, { t: x.c.t, rects: [] }));
      else if (off.length) add('low', 'sound', `${off.length} of ${meta.ch.length - 1} cuts are off the music's beat (fine for a calm clip)`, { rects: [] });
      ran.push(`beats: ${beatAt.length} beats, ${meta.ch.length} chapters${beatCut ? ' (beat-cut)' : ''}`);
    }
    await page.close();
  }

  /* ================= 2b. the user's videos (footage) ================= */
  {
    const { page } = await openClip(browser, file, { width: 1000, height: 760, query: { aspect: aspects[0] } });
    const F = await page.evaluate(() => (CLIP.FOOTAGE || []).map(f => ({ src: f.src, t: f.t, dur: f.dur, a: f.a != null ? f.a : f.t, b: f.b != null ? f.b : f.t + f.dur, from: f.from, rate: f.rate, ok: f.ok, vd: f.v.duration || 0, files: [...f.v.querySelectorAll('source')].map(s => s.getAttribute('src')) })));
    if (F.length) {
      const dir = /^https?:/.test(file) ? null : path.dirname(path.resolve(file));
      for (const f of F) {
        if (!f.ok) add('high', 'footage', `video "${f.src}" does not load in this browser (missing file, or only a format it can't play — cut it with scripts/clips.js to get .mp4 + .webm)`, { t: f.t, rects: [] });
        if (f.ok && f.from + f.dur * f.rate > f.vd + 0.05) add('medium', 'footage', `video "${f.src}" is ${f.vd.toFixed(2)} s but the clip asks for ${(f.from + f.dur * f.rate).toFixed(2)} s: it freezes on its last frame`, { t: f.t + (f.vd - f.from) / f.rate, rects: [] });
        if (dir) for (const x of f.files) { const fp = path.resolve(dir, x); if (!fs.existsSync(fp)) add(/\.mp4$/i.test(x) ? 'medium' : 'low', 'footage', `${x} is missing${/\.mp4$/i.test(x) ? ' (Safari / iPhone play the .mp4)' : ' (Chromium, used by the check and render scripts, plays the .webm)'}`, { t: f.t, rects: [] });
          else { const sz = fs.statSync(fp).size; if (sz > 15 * 1048576) add('low', 'footage', `${x} is ${(sz / 1048576).toFixed(0)} MB — heavy on phones (shorter cut or --height 540)`, { rects: [] }); } }
      }
      // at most 2–3 videos playing at once (phones)
      const ev = F.flatMap(f => [[f.t, 1], [f.t + f.dur, -1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]); let cur = 0, peak = 0, at = 0;
      for (const [t, d] of ev) { cur += d; if (cur > peak) { peak = cur; at = t; } }
      if (peak > 3) add('medium', 'footage', `${peak} videos play at the same time (phones manage 2–3)`, { t: at, rects: [] });
      // scrubbing: every video must land on its exact frame
      const fpsV = meta.fps, badF = [];
      for (const f of F.filter(x => x.ok)) for (const k of [0.1, 0.5, 0.9]) {
        const t = f.t + f.dur * k;
        const r = await page.evaluate(async ({ t, i }) => { CLIP.seek(t); await CLIP.settle(); const f = CLIP.FOOTAGE[i]; const want = Math.min(f.from + (t - f.t) * f.rate, f.v.duration - 0.02); return { got: f.v.currentTime, want, vis: f.v.style.visibility }; }, { t, i: F.indexOf(f) });
        if (Math.abs(r.got - r.want) > 1.5 / fpsV || r.vis !== 'visible') badF.push({ f, t, r });
      }
      badF.slice(0, 6).forEach(b => add('high', 'footage', `video "${b.f.src}" shows ${b.r.got.toFixed(3)} s instead of ${b.r.want.toFixed(3)} s when scrubbed${b.r.vis !== 'visible' ? ' (and is hidden)' : ''}`, { t: b.t, rects: [] }));
      // outside its window it must be hidden
      for (const f of F) { const hid = await page.evaluate(({ t, i }) => { CLIP.seek(t); return CLIP.FOOTAGE[i].v.style.visibility; }, { t: Math.min(END - 0.01, f.b + 0.05), i: F.indexOf(f) }); if (hid === 'visible' && f.b + 0.05 < END) add('medium', 'footage', `video "${f.src}" is still showing after its shot ends`, { t: f.b, rects: [] }); }
      ran.push(`footage: ${F.length} videos, frame-exact scrub at ${F.filter(x => x.ok).length * 3} points, at most ${peak} at once`);
    }
    await page.close();
    meta.footage = F;
  }
  // while the clip plays: how far each visible video is from where the timeline says it should be
  const DRIFT = () => { window.__drift = []; const tick = () => { if (!window.__drift) return; const now = CLIP.tl.time();
    for (const f of CLIP.FOOTAGE || []) if (f.v.style.visibility === 'visible' && now - f.t > 0.3 && f.t + f.dur - now > 0.2) window.__drift.push({ src: f.src, t: now, d: f.v.currentTime - (f.from + (now - f.t) * f.rate), paused: f.v.paused });
    setTimeout(tick, 150); }; tick(); };
  const driftReport = async (page, where, sev) => {
    const d = await page.evaluate(() => { const x = window.__drift || []; window.__drift = null; return x; }); if (!d.length) return;
    const worst = d.reduce((m, x) => Math.abs(x.d) > Math.abs(m.d) ? x : m, d[0]), stalled = d.filter(x => x.paused).length;
    if (Math.abs(worst.d) > 0.15) add(sev, 'footage', `${where}: video "${worst.src}" runs ${Math.round(Math.abs(worst.d) * 1000)} ms ${worst.d > 0 ? 'ahead of' : 'behind'} the clip`, { t: worst.t, rects: [] });
    if (stalled > 2) add(sev, 'footage', `${where}: a video stayed paused while its shot played (${stalled} samples)`, { t: d.find(x => x.paused).t, rects: [] });
    ran.push(`${where}: footage drift max ${Math.round(Math.abs(worst.d) * 1000)} ms over ${d.length} samples`);
  };

  /* ================= 3. player ================= */
  {
    const { page, errors } = await openClip(browser, file, { width: 1280, height: 900, query: { aspect: aspects[0] } });
    const broken = findings.some(f => /throws an error|console error/.test(f.what));
    const fail = (what, o = {}) => add('high', 'player', what + (broken ? ' (may come from the error above)' : ''), { rects: [], ...o });
    const now = () => page.evaluate(() => CLIP.tl.time());
    const lbl = s => page.$eval(s, e => e.textContent.trim()).catch(() => null);
    try {
      await page.click('#play'); await page.waitForTimeout(800);
      const t1 = await now(); if (t1 < 0.3) fail(`Play does not start the clip (time ${t1.toFixed(2)} s after 0.8 s)`);
      if ((await lbl('#play')) !== 'Pause') add('low', 'player', 'Play button does not change to "Pause" while playing', { rects: [] });
      await page.click('#play'); const p1 = await now(); await page.waitForTimeout(400); const p2 = await now();
      if (Math.abs(p2 - p1) > 0.02) fail('Pause does not stop the clip');
      // drag the bar
      const r = await page.locator('#rail').boundingBox();
      await page.mouse.move(r.x + r.width * 0.5, r.y + r.height / 2); await page.mouse.down();
      const mid = await now(); await page.mouse.move(r.x + r.width * 0.25, r.y + r.height / 2, { steps: 4 }); const q = await now(); await page.mouse.up();
      if (Math.abs(mid - END / 2) > END * 0.03) fail(`clicking the middle of the bar goes to ${mid.toFixed(2)} s, not ~${(END / 2).toFixed(2)} s`);
      if (Math.abs(q - END / 4) > END * 0.03) fail(`dragging the bar does not follow the pointer (${q.toFixed(2)} s at 25 %)`);
      // chapter buttons
      const chs = await page.$$('#chapters button'), cht = meta.ch;
      if (chs.length !== cht.length) fail(`${chs.length} chapter buttons for ${cht.length} chapters`);
      for (let i = 0; i < Math.min(chs.length, cht.length); i++) { await chs[i].click(); const x = await now(); if (Math.abs(x - cht[i].t) > 0.03) { fail(`chapter button "${cht[i].n}" goes to ${x.toFixed(2)} s, not ${cht[i].t.toFixed(2)} s`); break; } }
      // fps menu
      await page.selectOption('#fps', '30'); await page.click('#play'); await page.waitForTimeout(2300);
      const m30 = parseInt(await lbl('#meter')); await page.click('#play');
      if (!(m30 > 0) || m30 > 34) add('medium', 'player', `fps menu set to 30 but the meter shows ${await lbl('#meter')}`, { rects: [] });
      await page.selectOption('#fps', String(meta.cfg.fps || 60));
      // Music / SFX / CC
      for (const [sel, a0] of [['#mus', 'Music'], ['#sfx', 'SFX']]) { const b = await lbl(sel); await page.click(sel); const c = await lbl(sel); if (b === c) fail(`${a0} button does not toggle`); await page.click(sel); }
      const ccVisible = await page.$eval('#ccb', e => !e.hidden);
      if (ccVisible !== meta.caps.length > 0) add('medium', 'player', ccVisible ? 'CC button shows but the clip has no subtitles' : 'the clip has subtitles but no CC button', { rects: [] });
      if (ccVisible) {
        const ct = meta.caps[0]; await page.evaluate(SAFE_SEEK, (ct.t + ct.end) / 2);
        const on = await page.$eval('#cc', e => e.textContent.trim().length > 0); await page.click('#ccb');
        const off = await page.$eval('#cc', e => e.textContent.trim().length > 0 && getComputedStyle(e).display !== 'none'); await page.click('#ccb');
        if (!on || off) fail(`CC button does not ${!on ? 'show' : 'hide'} the subtitle`);
      }
      // safe zone
      await page.selectOption('#safeSel', 'tiktok'); const sOn = await page.$eval('#safe', e => getComputedStyle(e).display !== 'none');
      await page.selectOption('#safeSel', ''); const sOff = await page.$eval('#safe', e => getComputedStyle(e).display === 'none');
      if (!sOn || !sOff) fail('safe-zone menu does not show / hide the overlay');
      // fullscreen (real or the iPhone fallback), then back
      await page.click('#fs'); await page.waitForTimeout(300);
      const fsOn = await page.evaluate(() => !!document.fullscreenElement || document.querySelector('#screen').classList.contains('ffs'));
      const fsBox = await page.locator('#screen').boundingBox();
      await page.keyboard.press('f'); await page.waitForTimeout(300);                          // Esc belongs to the browser; the clip's own F key toggles back
      const fsOff = await page.evaluate(() => !document.fullscreenElement && !document.querySelector('#screen').classList.contains('ffs'));
      if (!fsOn || !fsBox || fsBox.width < 100) fail('Fullscreen button does not go fullscreen'); else if (!fsOff) fail('cannot leave fullscreen');
      // keys
      await page.evaluate(SAFE_SEEK, 2); await page.keyboard.press('Home'); if (await now() > 0.02) fail('Home key does not restart');
      await page.keyboard.press('ArrowRight'); if (Math.abs(await now() - 1) > 0.05) fail('→ key does not jump 1 s');
      await page.keyboard.press('ArrowLeft'); if (await now() > 0.05) fail('← key does not jump back 1 s');
      await page.keyboard.press(' '); await page.waitForTimeout(500); if (await now() < 0.2) fail('Space does not play'); await page.keyboard.press(' ');
      for (const [key, sel] of [['m', '#mus'], ['s', '#sfx']]) { const b = await lbl(sel); await page.keyboard.press(key); if (b === await lbl(sel)) fail(`key ${key.toUpperCase()} does not toggle ${sel}`); await page.keyboard.press(key); }
      if (ccVisible) { const b = await lbl('#ccb'); await page.keyboard.press('c'); if (b === await lbl('#ccb')) fail('key C does not toggle subtitles'); await page.keyboard.press('c'); }
      await page.keyboard.press('z'); if (await page.$eval('#safeSel', e => e.value) === '') fail('key Z does not change the safe zone'); for (let i = 0; i < 4; i++) await page.keyboard.press('z');
      // loop: play over the end, it must restart and keep playing
      await page.evaluate(SAFE_SEEK, Math.max(0, END - 0.4));
      await page.click('#play'); await page.waitForTimeout(1300);
      const lt = await now(), stillOn = await lbl('#play');
      if (lt > 1.5 || lt < 0.2 || stillOn !== 'Pause') fail(`the loop does not restart cleanly (time ${lt.toFixed(2)} s after passing the end)`);
      await page.click('#play');
      ran.push('player: play / pause, bar, chapters, fps menu, Music / SFX / CC, safe zone, fullscreen, keys, loop');
      // real-time playback
      if (!a.quick) {
        const secs = Math.min(END, 30);
        await page.evaluate(SAFE_SEEK, 0); await page.evaluate(() => { window.__fr = []; const loop = ts => { window.__fr.push(ts); if (window.__fr.length < 20000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
        if (meta.footage && meta.footage.length) await page.evaluate(DRIFT);
        const e0 = errors.length; await page.click('#play'); await page.waitForTimeout(secs * 1000); await page.click('#play');
        if (meta.footage && meta.footage.length) await driftReport(page, 'playback', 'medium');
        const fr = await page.evaluate(() => window.__fr), dts = fr.slice(1).map((v, i) => v - fr[i]), avg = dts.length ? 1000 / (dts.reduce((x, y) => x + y, 0) / dts.length) : 0, long = dts.filter(v => v > 1000 / 60 * 1.6).length / Math.max(1, dts.length);
        if (avg < 40 || long > 0.2) add('medium', 'player', `playback on this machine: ${avg.toFixed(0)} fps, ${(long * 100).toFixed(0)} % long frames (a slow sandbox exaggerates this; watch it on the real device)`, { rects: [] });
        if (errors.length > e0) [...new Set(errors.slice(e0))].forEach(e => add('high', 'player', 'console error during playback: ' + e.slice(0, 160), { rects: [] }));
        ran.push(`playback: ${secs.toFixed(1)} s real time, ${avg.toFixed(0)} fps, ${(long * 100).toFixed(1)} % long frames`);
      } else skipped.push('real-time playback (--quick)');
    } catch (e) { fail('player test stopped: ' + e.message.split('\n')[0]); }
    await page.close();
  }

  /* ================= 4. phone ================= */
  if (!a.quick) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    try {
      const { page, errors } = await openClip(browser, file, { context: ctx, query: { aspect: aspects[0] } });
      const lay = await page.evaluate(() => { const s = document.querySelector('#screen').getBoundingClientRect(), c = [...document.querySelectorAll('.controls button, .controls select, .chapters button')].filter(e => !e.hidden).map(e => e.getBoundingClientRect());
        return { over: document.documentElement.scrollWidth - innerWidth, sw: s.width, sr: s.right, vw: innerWidth, small: c.filter(r => r.height && r.height < 28).length, offRight: c.filter(r => r.right > innerWidth + 1).length }; });
      if (lay.over > 1 || lay.offRight) add('medium', 'player', `on a phone the page scrolls sideways (${lay.over}px) / ${lay.offRight} controls off screen`, { rects: [] });
      if (lay.sw < 200 || lay.sr > lay.vw + 1) add('medium', 'player', `on a phone the clip does not fit the screen (${Math.round(lay.sw)}px wide)`, { rects: [] });
      if (lay.small) add('low', 'player', `${lay.small} player controls are smaller than a finger (under 28px tall) on a phone`, { rects: [] });
      const r = await page.locator('#rail').boundingBox();
      await page.touchscreen.tap(r.x + r.width * 0.5, r.y + r.height / 2); const tt = await page.evaluate(() => CLIP.tl.time());
      if (Math.abs(tt - END / 2) > END * 0.05) add('medium', 'player', `tapping the bar on a phone goes to ${tt.toFixed(2)} s, not ~${(END / 2).toFixed(2)} s`, { rects: [] });
      const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const ft = meta.footage && meta.footage.length ? Math.max(0, Math.min(...meta.footage.map(f => f.t)) - 0.5) : 0;   // with videos: play the part that has them
      await page.evaluate(SAFE_SEEK, ft); await page.evaluate(() => { window.__fr = []; const loop = ts => { window.__fr.push(ts); if (window.__fr.length < 5000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
      if (ft || (meta.footage && meta.footage.length)) await page.evaluate(DRIFT);
      await page.tap('#play'); await page.waitForTimeout(Math.min(END - ft, 6) * 1000); await page.tap('#play');
      if (meta.footage && meta.footage.length) await driftReport(page, 'phone playback', 'low');
      const fr = await page.evaluate(() => window.__fr), dts = fr.slice(1).map((v, i) => v - fr[i]), avg = dts.length ? 1000 / (dts.reduce((x, y) => x + y, 0) / dts.length) : 0;
      if (avg < 30) add('low', 'player', `phone pass (CPU slowed 4×): ${avg.toFixed(0)} fps — heavy shots may stutter on older phones; try 30 fps or lighter effects there`, { rects: [] });
      if (errors.length) [...new Set(errors)].forEach(e => add('high', 'player', 'console error on a phone: ' + e.slice(0, 160), { rects: [] }));
      ran.push(`phone (393×852, touch, CPU 4× slower): layout, tap on the bar, ${avg.toFixed(0)} fps`);
    } catch (e) { add('medium', 'player', 'phone pass stopped: ' + e.message.split('\n')[0], { rects: [] }); }
    await ctx.close();
  } else skipped.push('phone pass (--quick)');

  /* ================= 5. pictures of the findings ================= */
  findings.sort((x, y) => SEV[y.sev] - SEV[x.sev] || (x.t ?? 1e9) - (y.t ?? 1e9));
  findings.forEach((f, i) => { f.n = i + 1; });
  const pics = findings.filter(f => f.t != null && f.area !== 'sound' && SEV[f.sev] >= 2).slice(0, 24);
  const byAsp = {}; for (const f of pics) (byAsp[f.aspect || 'default'] = byAsp[f.aspect || 'default'] || []).push(f);
  for (const k in byAsp) {
    const { page } = await openClip(browser, file, { width: 1400, height: 1000, query: { aspect: k === 'default' ? aspects[0] : k, safe: '' } });
    for (const f of byAsp[k]) {
      const t = Math.min(END - 0.02, f.t + (f.to != null && f.to > f.t && /jump|flicker/.test(f.what) ? 0 : 0.001));
      await page.evaluate(SAFE_SEEK, t); await page.evaluate(() => CLIP.settle && CLIP.settle());
      const k0 = await page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().width / CLIP.W);
      await page.evaluate(({ rects, k0 }) => {
        const m = document.createElement('div'); m.id = 'qa-mark'; m.style.cssText = 'position:absolute;inset:0;z-index:99;pointer-events:none';
        for (const r of rects) { const b = document.createElement('i'); const s = r.k || k0; b.style.cssText = `position:absolute;left:${r.x / s}px;top:${r.y / s}px;width:${r.w / s}px;height:${r.h / s}px;outline:${Math.max(4, 6 / s * k0)}px solid ${r.isBox ? '#ffb000' : '#ff1744'};outline-offset:3px`; m.appendChild(b); }
        document.querySelector('#stage').appendChild(m);
      }, { rects: f.rects || [], k0 });
      const fn = `${String(f.n).padStart(2, '0')}-${t.toFixed(2)}s.png`;
      await page.locator('#stage').screenshot({ path: path.join(a.out, fn) }); f.image = fn;
      await page.evaluate(() => document.getElementById('qa-mark').remove());
    }
    await page.close();
  }
  await browser.close();

  /* ================= 6. report ================= */
  const count = s => findings.filter(f => f.sev === s).length;
  const clean = findings.map(({ rects, ...f }) => f);
  const rep = { file, duration: END, aspects: aspects.map(x => x || 'default'), fps, agreedLength: a.length && a.length !== true ? +a.length : null,
    summary: { high: count('high'), medium: count('medium'), low: count('low') }, findings: clean, checksRun: ran, skipped };
  fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(rep, null, 2));
  const md = [`# QA report — ${path.basename(file)}`, '', `${END.toFixed(2)} s · ${rep.aspects.join(', ')} · ${fps} fps${rep.agreedLength ? ` · agreed ${rep.agreedLength} s` : ''}`, '',
    `**${count('high')} high · ${count('medium')} medium · ${count('low')} low**`, ''];
  if (findings.length) {
    md.push('| # | Severity | Time | Aspect | Area | What | Where | Picture |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const f of findings) md.push(`| ${f.n} | ${f.sev} | ${f.t != null ? fmtT(f.t) + (f.to != null && f.to - f.t > 0.01 ? '–' + fmtT(f.to) : '') : ''} | ${f.aspect || ''} | ${f.area} | ${String(f.what).replace(/\|/g, '/')} | ${(f.where || '').replace(/\|/g, '/')} | ${f.image ? `![](${f.image})` : ''} |`);
  } else md.push('Nothing found.');
  md.push('', '## Checks run', ...ran.map(r => '- ' + r));
  if (skipped.length) md.push('', '## Skipped', ...skipped.map(r => '- ' + r));
  md.push('', 'Severity: **high** = the viewer sees or hears a mistake — fix before anyone posts it · **medium** = likely a mistake, look at the picture · **low** = polish.');
  fs.writeFileSync(path.join(a.out, 'report.md'), md.join('\n'));

  const bad = count('high') + count('medium');
  console.log(`${bad ? 'ISSUES' : 'CLEAN'}  ${file}  ${END.toFixed(2)} s  high ${count('high')} · medium ${count('medium')} · low ${count('low')}`);
  findings.slice(0, 40).forEach(f => console.log(`  ${f.sev === 'high' ? '✗' : f.sev === 'medium' ? '!' : '·'} ${f.t != null ? fmtT(f.t).padStart(8) : '        '} ${f.aspect ? '[' + f.aspect + '] ' : ''}${f.what}${f.image ? '  → ' + f.image : ''}`));
  console.log('  report: ' + path.join(a.out, 'report.md'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(/No window.CLIP|GSAP did not load|CLIP.ready/.test(e.message) ? e.message : (e.stack || e)); process.exit(2); });
