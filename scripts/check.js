#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
// Check a clip before sending it:
//   frames at every chapter + mid-transition, forward vs reverse scrub (must match),
//   console errors, no autoplay on open, captions inside the frame, text leaving the frame.
// usage: node check.js clip.html [--aspect 9:16] [--out check-out] [--step 0.5]      (quick, before sending)
//        node check.js clip.html --deep [qa.js options]                          (deep bug check after sending = scripts/qa.js)
// output: <out>/sheet.png (contact sheet), <out>/report.json, exit code 1 when something failed
const fs = require('fs');
const path = require('path');
const { launch, openClip, args } = require('./_browser');

// --deep: the full bug check after sending — same as scripts/qa.js (every other option is passed through)
if (process.argv.includes('--deep')) {
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'qa.js'), ...process.argv.slice(2).filter(x => x !== '--deep')], { stdio: 'inherit' });
  process.exit(r.status == null ? 2 : r.status);
}

(async () => {
  const a = args(process.argv.slice(2), { out: 'check-out' });
  const file = a._[0];
  if (!file) { console.log('usage: node check.js clip.html [--aspect 9:16] [--out dir] [--step 0.5]'); process.exit(2); }
  fs.mkdirSync(a.out, { recursive: true });
  const browser = await launch();
  const { page, errors } = await openClip(browser, file, { query: { aspect: a.aspect, safe: '' } });

  // 1. must not play by itself
  await page.waitForTimeout(1200);
  const auto = await page.evaluate(() => ({ t: CLIP.tl.time(), active: CLIP.tl.isActive() }));
  const autoplay = auto.t > 0 || auto.active;

  // 2. times to inspect: each chapter start, +0.3 s, and the middle of each chapter; or a fixed step
  const info = await page.evaluate(() => ({ END: CLIP.END, ch: CLIP.CHAPTERS.map(c => ({ t: c.t, n: c.n })), W: CLIP.W, H: CLIP.H }));
  let times = [];
  if (a.step) for (let t = 0; t < info.END; t += +a.step) times.push(+t.toFixed(3));
  else {
    const starts = info.ch.map(c => c.t).concat(info.END);
    for (let i = 0; i < info.ch.length; i++) { const s = starts[i], e = starts[i + 1]; times.push(s + 0.05, s + 0.3, (s + e) / 2, e - 0.15); }
  }
  times = [...new Set(times.map(t => Math.max(0, Math.min(info.END - 0.02, +t.toFixed(3)))))].sort((x, y) => x - y);

  const shoot = async t => {
    await page.evaluate(t => { CLIP.seek(t); }, t);            // braces: never return the timeline from evaluate (it hangs)
    await page.evaluate(() => CLIP.settle && CLIP.settle());
    await page.waitForTimeout(40);
    return (await page.locator('#stage').screenshot()).toString('base64');
  };
  const fwd = []; for (const t of times) fwd.push(await shoot(t));
  await page.evaluate(e => { CLIP.seek(e); }, info.END - 0.01);
  const rev = []; for (const t of [...times].reverse()) rev.unshift(await shoot(t));

  // 3. compare forward vs reverse, build the contact sheet (done in the page with canvas, no extra packages)
  const result = await page.evaluate(async ({ fwd, rev, times, labels }) => {
    const img = b64 => createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' }));
    const diffs = [], thumbs = [];
    for (let i = 0; i < fwd.length; i++) {
      const A = await img(fwd[i]), Bm = await img(rev[i]);
      const c = new OffscreenCanvas(240, Math.round(240 * A.height / A.width)), x = c.getContext('2d');
      x.drawImage(A, 0, 0, c.width, c.height); const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height); x.drawImage(Bm, 0, 0, c.width, c.height); const db = x.getImageData(0, 0, c.width, c.height).data;
      let bad = 0; for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 90) bad++;
      diffs.push(bad / (c.width * c.height));
      thumbs.push(A);
    }
    const cols = 6, tw = 320, th = Math.round(tw * thumbs[0].height / thumbs[0].width), pad = 22;
    const sheet = new OffscreenCanvas(cols * (tw + 6), Math.ceil(thumbs.length / cols) * (th + pad + 6)), sx = sheet.getContext('2d');
    sx.fillStyle = '#fff'; sx.fillRect(0, 0, sheet.width, sheet.height); sx.font = '14px sans-serif';
    thumbs.forEach((t, i) => {
      const X = (i % cols) * (tw + 6), Y = Math.floor(i / cols) * (th + pad + 6);
      sx.fillStyle = diffs[i] > 0.004 ? '#d11' : '#111'; sx.fillText(`${times[i].toFixed(2)}s ${labels[i] || ''}${diffs[i] > 0.004 ? '  REVERSE MISMATCH' : ''}`, X + 2, Y + 15);
      sx.drawImage(t, X, Y + pad, tw, th);
    });
    const blob = await sheet.convertToBlob({ type: 'image/png' });
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { diffs, sheet: btoa(s) };
  }, { fwd, rev, times, labels: times.map(t => (info.ch.filter(c => c.t <= t).pop() || {}).n) });
  fs.writeFileSync(path.join(a.out, 'sheet.png'), Buffer.from(result.sheet, 'base64'));

  // 4. headline-size text that is mostly on screen but clipped by the frame edge (warning: some moves leave on purpose)
  const overflow = [];
  for (const t of times) {
    const o = await page.evaluate(t => {
      CLIP.seek(t);
      const st = document.querySelector('#stage').getBoundingClientRect(), bad = [];
      for (const el of document.querySelectorAll('#stage *')) {
        if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('#safe')) continue;
        let p = el, hidden = false; while (p && p.id !== 'stage') { const s = getComputedStyle(p); if (s.visibility === 'hidden' || +s.opacity < 0.05) { hidden = true; break; } p = p.parentElement; }
        if (hidden) continue;
        const r = el.getBoundingClientRect(); if (!r.width) continue;
        const ix = Math.max(0, Math.min(r.right, st.right) - Math.max(r.left, st.left)), iy = Math.max(0, Math.min(r.bottom, st.bottom) - Math.max(r.top, st.top));
        const frac = ix * iy / (r.width * r.height), big = parseFloat(cs.fontSize) * (st.width / CLIP.W) >= Math.min(st.width, st.height) * 0.03;
        if (big && frac > 0.5 && frac < 0.97) bad.push((el.id ? '#' + el.id : el.getAttribute('class') || el.tagName) + ' "' + el.textContent.trim().slice(0, 24) + '"');
      }
      return bad;
    }, t);
    if (o.length) overflow.push({ t, items: [...new Set(o)].slice(0, 5) });
  }

  const mismatch = times.map((t, i) => ({ t, diff: +result.diffs[i].toFixed(4) })).filter(d => d.diff > 0.004);
  const report = { file, aspect: a.aspect || 'default', duration: info.END, chapters: info.ch, autoplay, errors: [...new Set(errors)], reverseMismatch: mismatch, partlyOutOfFrame: overflow, sheet: path.join(a.out, 'sheet.png') };
  fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();

  const ok = !autoplay && !report.errors.length && !mismatch.length;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}  ${info.END.toFixed(2)} s, ${info.ch.length} chapters, ${times.length} frames checked`);
  if (autoplay) console.log('  ✗ clip starts playing by itself (bind onComplete after tl.time(END) / tl.time(0))');
  report.errors.forEach(e => console.log('  ✗ ' + e));
  mismatch.forEach(m => console.log(`  ✗ ${m.t}s looks different when scrubbing backwards (${(m.diff * 100).toFixed(1)}% pixels) — see references/gotchas.md`));
  overflow.forEach(o => console.log(`  ! ${o.t}s text partly outside the frame: ${o.items.join(', ')}`));
  console.log('  sheet: ' + report.sheet);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
