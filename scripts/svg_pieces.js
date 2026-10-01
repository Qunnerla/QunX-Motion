#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
// Split an SVG logo into pieces the logo kit can animate: letters out of one-path wordmarks (holes stay with their letter),
// marks and dots stay on their letter (i, j, Thai vowels and tone marks), every piece wrapped IN PLACE as <g class="lp">
// so gradients, clip paths and parent transforms keep working. Pieces are numbered in reading order (data-order).
// usage: node svg_pieces.js logo.svg [--out logo.pieces.svg] [--level letters|groups] [--no-stack] [--join 5+6,1+2]
//   --level groups  one piece per top-level group the designer made (e.g. icon + wordmark) instead of per letter
//   --no-stack      keep dots / marks / small inner shapes as their own pieces
//   --join 5+6      move these pieces as one (numbers from the preview), e.g. a Thai แ drawn as two shapes
// output: <out> (root <svg id="logo">, ready for the template's logo slot), <out>.png preview with numbered pieces, a table
// Only use it on the user's own logo or a client's they work for.
const fs = require('fs');
const { launch, args } = require('./_browser');

// runs in the page: everything uses the browser's own SVG geometry (getBBox / getBoundingClientRect)
function processSvg({ text, level, stack, join }) {
  const NS = 'http://www.w3.org/2000/svg', warn = [];
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return { error: 'Not a valid SVG file: ' + doc.querySelector('parsererror').textContent.split('\n')[0] };
  const root = document.importNode(doc.documentElement, true);
  document.getElementById('host').appendChild(root);
  root.querySelectorAll('metadata, *|namedview').forEach(e => e.remove());
  const designed = [...root.children].filter(e => e.tagName === 'g' && e.id);            // the designer's own top-level groups (icon, wordmark…)
  if (!root.getAttribute('viewBox')) {                                   // the template sizes the logo from its viewBox
    const w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
    const b = w && h ? { x: 0, y: 0, width: w, height: h } : root.getBBox();
    root.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
  }
  root.removeAttribute('width'); root.removeAttribute('height');
  root.style.width = '1000px'; root.style.height = 'auto';

  // references to gradients / patterns / clips that don't exist render black or not at all
  for (const el of root.querySelectorAll('*')) for (const at of ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'style']) {
    const v = el.getAttribute(at); if (!v) continue;
    for (const m of v.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) if (!root.querySelector('#' + CSS.escape(m[1]))) warn.push(`<${el.tagName} ${at}="url(#${m[1]})"> points to nothing: it renders black / invisible. Ask for the file with its <defs>, or set a flat colour.`);
  }
  if (root.querySelector('style') && /[>+~]/.test(root.querySelector('style').textContent)) warn.push('The <style> block uses child / sibling selectors; wrapping pieces can break them. Check the preview.');

  const HIDDEN = 'defs, clipPath, mask, pattern, symbol, marker, linearGradient, radialGradient, filter';
  const LEAF = 'path, rect, circle, ellipse, polygon, polyline, line, text, use, image';
  const wrap = el => { const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'lp'); el.parentNode.insertBefore(g, el); g.appendChild(el); return g; };
  const area = r => r.width * r.height;

  // ---- one path with many shapes -> one path per shape; holes and islands stay with the shape around them ----
  function subpaths(d) {
    const out = []; let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, cur = null, needM = false;
    const f = n => +n.toFixed(3);
    const sep = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
    const num = () => { sep(); const m = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/y; m.lastIndex = i; const r = m.exec(d); if (!r) throw new Error('bad number at ' + i); i = m.lastIndex; return +r[0]; };
    const flag = () => { sep(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error('bad arc flag at ' + i); return +c; };
    const start = (x, y) => { cur = [`M${f(x)} ${f(y)}`]; out.push(cur); sx = x; sy = y; needM = false; };
    const N = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    while (true) {
      sep(); if (i >= d.length) break;
      if (/[a-zA-Z]/.test(d[i])) cmd = d[i++]; else if (!cmd) throw new Error('path starts without a command');
      const U = cmd.toUpperCase(), rel = cmd !== U && !(cmd === 'm' && !out.length);
      if (U === 'Z') { if (cur) cur.push('Z'); cx = sx; cy = sy; needM = true; cmd = ''; continue; }
      if (!(U in N)) throw new Error('unknown path command ' + cmd);
      if (U !== 'M' && (needM || !cur)) start(cx, cy);
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (U === 'M') { const x = num() + ox, y = num() + oy; start(x, y); cx = x; cy = y; cmd = cmd === 'm' ? 'l' : 'L'; continue; }
      if (U === 'H') { cx = num() + ox; cur.push(`H${f(cx)}`); continue; }
      if (U === 'V') { cy = num() + oy; cur.push(`V${f(cy)}`); continue; }
      if (U === 'A') { const rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(), x = num() + ox, y = num() + oy; cur.push(`A${f(rx)} ${f(ry)} ${f(rot)} ${la} ${sw} ${f(x)} ${f(y)}`); cx = x; cy = y; continue; }
      const p = []; for (let k = 0; k < N[U]; k += 2) p.push(num() + ox, num() + oy);
      cur.push(U + p.map(f).join(' ')); cx = p[p.length - 2]; cy = p[p.length - 1];
    }
    return out.map(c => c.join(''));
  }
  function splitPath(el) {
    let subs; try { subs = subpaths(el.getAttribute('d') || ''); } catch (e) { warn.push(`path could not be split (${e.message}); kept whole`); return [el]; }
    if (subs.length < 2) return [el];
    const tmp = subs.map(d => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); el.parentNode.insertBefore(p, el); const b = p.getBBox(); p.remove(); return { d, b }; });
    const inside = (a, b) => { const e = 0.01 * Math.max(b.width, b.height); return a.x >= b.x - e && a.y >= b.y - e && a.x + a.width <= b.x + b.width + e && a.y + a.height <= b.y + b.height + e; };
    const owner = tmp.map((s, k) => { let best = -1; tmp.forEach((o, j) => { if (j !== k && area(o.b) > area(s.b) && inside(s.b, o.b) && (best < 0 || area(o.b) < area(tmp[best].b))) best = j; }); return best; });
    const top = k => { let j = k; while (owner[j] >= 0) j = owner[j]; return j; };
    const groups = new Map(); tmp.forEach((s, k) => { const t = top(k); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(s.d); });
    const made = [...groups.values()].map((ds, n) => { const c = el.cloneNode(false); if (n) c.removeAttribute('id'); c.setAttribute('d', ds.join('')); el.parentNode.insertBefore(c, el); return c; });
    el.remove(); return made;
  }

  // ---- pieces ----
  let pieces = [];
  const inDefs = el => !!el.closest(HIDDEN);
  if (level === 'groups') {
    for (const el of [...root.children]) {
      if (el.matches(HIDDEN + ', style, title, desc, script')) continue;
      if (el.tagName === 'g') { el.classList.add('lp'); pieces.push({ g: el, from: '<g' + (el.id ? ' id="' + el.id + '"' : '') + '>', merged: [] }); }
      else if (el.matches(LEAF)) pieces.push({ g: wrap(el), from: '<' + el.tagName + '>', merged: [] });
    }
  } else {
    for (const el of [...root.querySelectorAll(LEAF)]) {
      if (inDefs(el)) continue;
      const parts = el.tagName === 'path' ? splitPath(el) : [el];
      if (el.tagName === 'text') warn.push('Live <text> in the logo is one piece: outline it in a vector app (Create Outlines) to split letters, or rebuild the wordmark as HTML text and use popWord.');
      parts.forEach(p => pieces.push({ g: wrap(p), from: '<' + p.tagName + '>' + (parts.length > 1 ? ' (split)' : ''), merged: [] }));
    }
  }
  pieces = pieces.filter(p => { const r = p.g.getBoundingClientRect(); if (area(r) < 1 && !p.g.querySelector('line')) { p.g.replaceWith(...p.g.childNodes); return false; } return true; });

  // ---- dots, marks and small inner shapes ride on the piece under / around them ----
  const rect = p => p.g.getBoundingClientRect();
  if (stack && level !== 'groups') {
    const byArea = [...pieces].sort((a, b) => area(rect(a)) - area(rect(b)));
    for (const a of byArea) {
      if (!pieces.includes(a)) continue;
      const ra = rect(a); let best = null, bestScore = -1;
      for (const b of pieces) {
        if (b === a || b.g.parentNode !== a.g.parentNode) continue;
        const rb = rect(b); if (area(ra) > 0.3 * area(rb)) continue;
        const ov = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); if (ov < 0.5 * ra.width) continue;
        const gap = Math.max(0, ra.top - rb.bottom, rb.top - ra.bottom); if (gap > 0.6 * rb.height) continue;
        const score = ov / ra.width - gap / rb.height; if (score > bestScore) { bestScore = score; best = b; }
      }
      if (best) { while (a.g.firstChild) best.g.appendChild(a.g.firstChild); a.g.remove(); best.merged.push(a.from, ...a.merged); pieces = pieces.filter(p => p !== a); }
    }
  }

  // ---- reading order: rows top to bottom, left to right in a row ----
  const R = pieces.map(p => ({ p, r: rect(p) }));
  const hs = R.map(o => o.r.height).sort((a, b) => a - b), mh = hs[hs.length >> 1] || 1;
  R.sort((a, b) => (a.r.top + a.r.height / 2) - (b.r.top + b.r.height / 2));
  const rows = []; for (const o of R) { const c = o.r.top + o.r.height / 2, row = rows[rows.length - 1]; if (row && c - row.c < 0.7 * mh) row.items.push(o); else rows.push({ c, items: [o] }); }
  let ordered = rows.flatMap(row => row.items.sort((a, b) => a.r.left - b.r.left));
  // --join 5+6,1+2: pieces the user wants to move as one (numbers from the first preview)
  for (const grp of join) {
    const list = grp.map(n => ordered[n - 1]).filter(Boolean), head = list[0]; if (!head) continue;
    for (const o of list.slice(1)) {
      if (o.p.g.parentNode !== head.p.g.parentNode) { warn.push(`could not join ${grp.join('+')}: those pieces sit in different groups (different transforms); join them in a vector app`); continue; }
      while (o.p.g.firstChild) head.p.g.appendChild(o.p.g.firstChild); o.p.g.remove(); head.p.merged.push(o.p.from, ...o.p.merged); o.gone = true;
    }
    head.r = head.p.g.getBoundingClientRect();
  }
  ordered = ordered.filter(o => !o.gone);
  const inv = root.getScreenCTM().inverse(), toVB = (x, y) => { const pt = root.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(inv); };
  const table = ordered.map((o, n) => {
    const g = o.p.g, id = 'part' + (n + 1);
    if (g.id && level === 'groups') g.setAttribute('data-name', g.id);
    g.id = id; g.setAttribute('data-order', n + 1);
    const a = toVB(o.r.left, o.r.top), b = toVB(o.r.right, o.r.bottom), leaf = g.querySelector(LEAF);
    const fill = leaf ? getComputedStyle(leaf).fill : '';
    return { id, from: o.p.from, merged: o.p.merged, box: [a.x, a.y, b.x - a.x, b.y - a.y].map(v => Math.round(v * 10) / 10), fill, screen: { l: o.r.left, t: o.r.top, w: o.r.width, h: o.r.height } };
  });
  const topGroups = designed.map(e => ({ name: e.getAttribute('data-name') || e.id, parts: e.classList.contains('lp') ? [e.id] : [...e.querySelectorAll('.lp')].map(g => g.id) }));
  root.id = 'logo'; root.style.width = ''; root.style.height = ''; root.removeAttribute('style');
  const svg = new XMLSerializer().serializeToString(root);

  // preview: numbered boxes over the pieces
  root.style.width = '1000px';
  const host = document.getElementById('host'), hr = host.getBoundingClientRect();
  const R2 = [...root.querySelectorAll('.lp')].map(g => ({ id: g.id, r: g.getBoundingClientRect() }));
  R2.forEach(({ id, r }, k) => { const d = document.createElement('div'); d.className = 'box'; Object.assign(d.style, { left: r.left - hr.left + 'px', top: r.top - hr.top + 'px', width: r.width + 'px', height: r.height + 'px', borderColor: `hsl(${k * 67 % 360} 80% 45%)` });
    d.innerHTML = `<b style="background:hsl(${k * 67 % 360} 80% 45%)">${id.replace('part', '')}</b>`; host.appendChild(d); });
  return { svg, table, topGroups, warn: [...new Set(warn)], count: table.length };
}

(async () => {
  const a = args(process.argv.slice(2));
  const file = a._[0];
  if (!file || !fs.existsSync(file)) { console.log('usage: node svg_pieces.js logo.svg [--out logo.pieces.svg] [--level letters|groups] [--no-stack] [--join 5+6,1+2]'); process.exit(2); }
  const out = a.out || file.replace(/\.svg$/i, '') + '.pieces.svg';
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.setContent(`<!doctype html><style>body{margin:0;background:#fff}#host{position:relative;display:inline-block;padding:24px;background:repeating-conic-gradient(#f2f2f2 0 25%,#fff 0 50%) 0 0/20px 20px}
      .box{position:absolute;border:2px dashed;box-sizing:border-box}.box b{position:absolute;left:-2px;top:-18px;color:#fff;font:700 12px/16px sans-serif;padding:0 5px;border-radius:3px}</style><div id="host"></div>`);
    const r = await page.evaluate(processSvg, { text: fs.readFileSync(file, 'utf8'), level: a.level === 'groups' ? 'groups' : 'letters', stack: !a['no-stack'], join: a.join ? String(a.join).split(',').map(g => g.split('+').map(Number)) : [] });
    if (r.error) { console.error(r.error); process.exit(3); }
    fs.writeFileSync(out, r.svg + '\n');
    const png = out.replace(/\.svg$/i, '') + '.png';
    await page.locator('#host').screenshot({ path: png });
    console.log(`${r.count} pieces · ${out} · preview ${png}`);
    r.table.forEach(t => console.log(`  ${t.id.padEnd(7)} ${t.from.padEnd(18)} box ${t.box.join(' ').padEnd(26)} ${t.fill}${t.merged.length ? '  + ' + t.merged.length + ' small piece' + (t.merged.length > 1 ? 's' : '') + ' riding on it' : ''}`));
    if (r.topGroups.length) console.log('top-level groups: ' + r.topGroups.map(g => `${g.name} = ${g.parts.join(', ') || '(none)'}`).join(' · '));
    r.warn.forEach(w => console.log('! ' + w));
    console.log('next: show the preview to the user, agree which pieces move together, paste the <svg> into the template\'s logo slot (it keeps id="logo").');
  } finally { await browser.close(); }
})();
