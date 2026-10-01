#!/usr/bin/env node
// © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
// Brand colours + fonts for a clip, from (in this order) a website, the app's code, an SVG logo.
// usage: node brand.js [https://site | page.html] [--code <project folder>] [--logo logo.svg]
//                      [--look pastel] [--out brand.json] [--swatch brand-swatch] [--shot site.png]
//   --code   scans CSS variables (light + dark mode), tailwind / theme / token files, colour and font usage — no browser needed
//   --logo   colours used in an SVG logo (fills, strokes, gradient stops)
//   --look   dark | light | poster | pastel: the look picked on card 2 (the strip shows only that one); default: all four
// output: brand.json › looks.<look> = {bg, fg, muted, accent, accent2, card, cardfg, line, font} → CONFIG.brand in the clip
//         brand.json › contrast (WCAG ratios, what was adjusted and why), sources (where each colour came from)
//         <swatch>.svg always, <swatch>.png when Playwright is on the machine — show it to the user before the storyboard
// Only run it on the user's own project or a client's they work for.
const fs = require('fs');
const path = require('path');
const { args, clipUrl } = require('./_browser');

/* ---------- colour maths ---------- */
const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const hex = p => '#' + p.map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('');
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = h => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = rgbOf(h); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sat = h => { const p = rgbOf(h), mx = Math.max(...p), mn = Math.min(...p); return mx ? (mx - mn) / mx : 0; };
const hue = h => { const [r, g, b] = rgbOf(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const otherHue = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d) > 35 && sat(a) > 0.25; };   // a second accent must be another colour, not a shade
const mix = (a, b, k) => { const p = rgbOf(a), q = rgbOf(b); return hex(p.map((v, i) => v * (1 - k) + q[i] * k)); };
function hsl2hex(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return hex([0, 8, 4].map(n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
const NAMED = { white: '#ffffff', black: '#000000' };
// any CSS colour literal (or a bare "H S% L%" / "R G B" token as used by shadcn / tailwind variables) -> #rrggbb, or null
function parseColor(v) {
  if (!v) return null; v = String(v).trim().toLowerCase().replace(/!important/, '').trim();
  if (NAMED[v]) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3,8})\b/);
  if (m) { const h = m[1]; if (h.length === 4 || h.length === 8) { const al = parseInt(h.length === 4 ? h[3] + h[3] : h.slice(6), 16) / 255; if (al < 0.5) return null; }
    return [3, 4, 6, 8].includes(h.length) ? hex(rgbOf(h)) : null; }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (m) { if (m[4] && parseFloat(m[4]) / (m[4].endsWith('%') ? 100 : 1) < 0.5) return null; return hex([m[1], m[2], m[3]].map(Number)); }
  m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (m) { if (m[4] && parseFloat(m[4]) / (m[4].endsWith('%') ? 100 : 1) < 0.5) return null; return hsl2hex(+m[1], +m[2], +m[3]); }
  m = v.match(/^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/); if (m) return hsl2hex(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/); if (m) return hex([m[1], m[2], m[3]].map(Number));
  return null;
}
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

/* ---------- roles from names ---------- */
const ROLE_RULES = [                                   // first match wins; names are CSS variables, tailwind keys, theme keys
  ['skip', /([\w]-foreground|-fg$|^on-|-on-|shadow|overlay|backdrop|ring|focus|scrollbar|selection|placeholder|disabled|error|danger|destructive|success|warning|info)/],
  ['line', /(border|line|divider|stroke|outline|hairline|separator)/],
  ['card', /(card|panel|popover|surface-?2|elevated|sheet|tile)/],
  ['muted', /(muted|subtle|faint|secondary-text|text-2|gray|grey|neutral-[4-6])/],
  ['bg', /(^|[-_.])(bg|background|surface|base|page|paper|canvas|body-bg|app-bg)([-_.]|$)/],
  ['fg', /(^|[-_.])(fg|text|ink|body|content|copy|heading|title|foreground)([-_.]|$)/],
  ['accent2', /(secondary|accent-?2|second|alt|highlight|pink|tertiary)/],
  ['accent', /(primary|brand|accent|main|theme|key|cta|tint|logo)/]
];
const roleOf = name => { const n = String(name).toLowerCase(); for (const [r, re] of ROLE_RULES) if (re.test(n)) return r === 'skip' ? null : r; return null; };
const FG_OVERRIDE = /(primary|brand|accent)-?(foreground|fg|text|contrast)|on-(primary|brand|accent)/i;   // text on the accent (buttons)

/* ---------- source 2: the app's code ---------- */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 'vendor', '.cache', '.vercel', '.svelte-kit', '.nuxt', 'clips', 'qa-out', 'check-out', '__pycache__', '.venv', 'venv']);
const CODE_EXT = /\.(css|scss|sass|less|styl|html?|vue|svelte|astro|jsx?|tsx?|mjs|cjs|json)$/i;
const THEMEISH = /(tailwind\.config|theme|tokens?|colou?rs?|palette|variables|brand|design)/i;
function walk(dir, out = [], depth = 0) {
  if (depth > 8 || out.length > 4000) return out;
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p, out, depth + 1); }
    else if (CODE_EXT.test(e.name) && !/\.min\.(js|css)$/.test(e.name) && !/lock\.json$|package\.json$/.test(e.name)) {
      let st; try { st = fs.statSync(p); } catch (x) { continue; }
      if (st.size < 1.5e6) out.push(p);
    }
  }
  return out;
}
function scanCode(root) {
  const files = walk(root), light = {}, dark = {}, keyed = [], usage = { bg: {}, fg: {}, any: {} }, fonts = {}, gfonts = new Set(), onAccent = {};
  const bump = (o, k, w = 1) => { if (k) o[k] = (o[k] || 0) + w; };
  for (const f of files) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const rel = path.relative(root, f), isStyle = /\.(css|scss|sass|less|styl|html?|vue|svelte|astro)$/i.test(f), themeish = THEMEISH.test(path.basename(f));
    // CSS custom properties, split into light (default) and dark blocks
    for (const m of txt.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().split('\n').pop(), body = m[2], isDark = /dark|night|prefers-color-scheme:\s*dark/i.test(sel) || /prefers-color-scheme:\s*dark/i.test(txt.slice(Math.max(0, m.index - 200), m.index));
      for (const v of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) {
        const c = parseColor(v[2]); if (!c) continue;
        const tgt = isDark ? dark : light; if (!tgt[v[1]]) tgt[v[1]] = { c, file: rel };
        if (FG_OVERRIDE.test(v[1]) && !isDark) onAccent[c] = (onAccent[c] || 0) + 1;
      }
      if (isStyle) for (const d of body.matchAll(/(^|[;\s])(background(?:-color)?|color|fill|border(?:-color)?)\s*:\s*([^;]+)/g)) {
        const cs = (d[3].match(COLOR_RE) || []).map(parseColor).filter(Boolean);
        for (const c of cs) { bump(usage.any, c); if (/^background/.test(d[2])) bump(usage.bg, c); if (d[2] === 'color') bump(usage.fg, c); }
      }
    }
    // tailwind / theme / token objects:  primary: '#..' · brand: { 500: '#..', DEFAULT: '#..' }
    if (themeish || /tailwind|theme\s*[:=]|colors\s*:/.test(txt)) {
      for (const b of txt.matchAll(/["']?([\w-]+)["']?\s*:\s*\{([^{}]{0,600})\}/g))
        for (const kv of b[2].matchAll(/["']?([\w-]+)["']?\s*:\s*["']([^"']+)["']/g)) { const c = parseColor(kv[2]); if (c) keyed.push({ name: kv[1] === 'DEFAULT' ? b[1] : `${b[1]}-${kv[1]}`, c, file: rel, shade: /^\d+$/.test(kv[1]) ? +kv[1] : (kv[1] === 'DEFAULT' ? 500 : null) }); }
      for (const kv of txt.matchAll(/["']?([A-Za-z][\w-]*)["']?\s*:\s*["'](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))["']/g)) { const c = parseColor(kv[2]); if (c && !keyed.some(k => k.c === c && k.file === rel)) keyed.push({ name: kv[1], c, file: rel }); }
    }
    // fonts
    for (const m of txt.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) { const fam = m[1].split(',')[0].replace(/["']/g, '').trim(); if (fam && !/^(var\(|inherit|initial|system-ui|sans-serif|serif|monospace|-apple-system)/i.test(fam)) bump(fonts, fam); }
    for (const m of txt.matchAll(/fonts\.googleapis\.com\/css2?\?[^"')\s]+/g)) { gfonts.add('https://' + m[0].replace(/&amp;/g, '&')); for (const f of m[0].matchAll(/family=([^:&]+)/g)) bump(fonts, decodeURIComponent(f[1]).replace(/\+/g, ' '), 3); }
    for (const m of txt.matchAll(/@fontsource(?:-variable)?\/([\w-]+)/g)) bump(fonts, m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 3);
    for (const m of txt.matchAll(/from\s+["']next\/font\/google["']/g)) { const imp = txt.slice(Math.max(0, m.index - 200), m.index).match(/\{([^}]*)\}\s*$/); if (imp) imp[1].split(',').map(s => s.trim().replace(/_/g, ' ')).filter(Boolean).forEach(f => bump(fonts, f, 3)); }
    for (const m of txt.matchAll(/fontFamily\s*:\s*\{([^}]*)\}/g)) for (const f of m[1].matchAll(/\[\s*["']([^"']+)["']/g)) bump(fonts, f[1], 3);
  }
  // roles: named variables first (light mode), then tailwind/theme keys, then usage
  const cand = [];
  for (const [n, v] of Object.entries(light)) { const r = roleOf(n); if (r) cand.push({ role: r, c: v.c, from: `--${n} (${v.file})`, w: 3 }); }
  for (const k of keyed) { const r = roleOf(k.name); if (r) cand.push({ role: r, c: k.c, from: `${k.name} (${k.file})`, w: k.shade == null ? 2 : (k.shade >= 400 && k.shade <= 600 ? 2.5 : 1) }); }
  const darkBg = Object.entries(dark).filter(([n]) => roleOf(n) === 'bg').map(([n, v]) => ({ c: v.c, from: `--${n} dark (${v.file})` }))[0];
  const darkFg = Object.entries(dark).filter(([n]) => roleOf(n) === 'fg').map(([n, v]) => ({ c: v.c, from: `--${n} dark (${v.file})` }))[0];
  const sorted = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return { files: files.length, cand, darkBg, darkFg, usage: { bg: sorted(usage.bg).slice(0, 8), fg: sorted(usage.fg).slice(0, 8), any: sorted(usage.any).slice(0, 12) },
    onAccent: sorted(onAccent)[0] || null, fonts: sorted(fonts).slice(0, 6), googleFonts: [...gfonts].slice(0, 4), variables: { light: Object.keys(light).length, dark: Object.keys(dark).length } };
}

/* ---------- source 3: an SVG logo ---------- */
function scanLogo(file) {
  const txt = fs.readFileSync(file, 'utf8'), n = {};
  for (const m of txt.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?([^"';)\s]+\)?)/g)) { const c = parseColor(m[1]); if (c) n[c] = (n[c] || 0) + 1; }
  const all = Object.entries(n).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return { colors: all, saturated: all.filter(c => sat(c) > 0.3 && lum(c) > 0.03 && lum(c) < 0.85), dark: all.filter(c => lum(c) < 0.05) };
}

/* ---------- source 1: a website (needs Playwright) ---------- */
async function scanSite(target, shot) {
  const { launch } = require('./_browser');
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let res = null, err = null;
  try { res = await page.goto(/^https?:/.test(target) ? target : clipUrl(target), { waitUntil: 'networkidle', timeout: 45000 }); }
  catch (e) { err = e; }
  const bad = page.url().startsWith('chrome-error') || (res && res.status() >= 400) || (err && !/Timeout/.test(err.name + err.message));
  if (bad) { await browser.close(); const e = new Error(`Could not open ${target}: ${res ? 'HTTP ' + res.status() : (err ? err.message.split('\n')[0] : 'error page')}.`); e.code = 3; throw e; }
  await page.waitForTimeout(800);
  if (shot) await page.screenshot({ path: shot === true ? 'brand.png' : shot });
  const data = await page.evaluate(() => {
    const toRGB = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length >= 3 && (p[3] === undefined || p[3] > 0.5) ? p.slice(0, 3) : null; };
    const hex = p => '#' + p.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
    const vw = innerWidth, vh = innerHeight * 3, bg = {}, text = {}, accent = {}, fonts = {};
    const add = (o, k, w) => { if (k) o[k] = (o[k] || 0) + w; };
    for (const el of document.querySelectorAll('body, body *')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.top > vh) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const area = Math.min(r.width, vw) * Math.min(r.height, vh) / (vw * vh);
      const b = toRGB(cs.backgroundColor); if (b) add(bg, hex(b), area);
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const t = toRGB(cs.color); if (t) add(text, hex(t), el.textContent.trim().length * parseFloat(cs.fontSize));
        add(fonts, cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), el.textContent.length * (/^H[1-3]$/.test(el.tagName) || +cs.fontWeight >= 700 ? 2 : 1));
      }
      if (el.matches('a, button, [role=button], [class*=btn], [class*=button], [class*=badge], [class*=chip]')) { const c = toRGB(cs.backgroundColor) || toRGB(cs.color); if (c && sat(c) > 0.25) add(accent, hex(c), 1 + area * 50); }
    }
    const vars = {};
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules || []) if (r.selectorText === ':root' && r.style) for (const p of r.style) if (p.startsWith('--')) vars[p.slice(2)] = r.style.getPropertyValue(p).trim(); }
    const sort = o => Object.entries(o).sort((x, y) => y[1] - x[1]).map(e => e[0]);
    const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
    const logos = [...document.querySelectorAll('img, svg')].filter(e => /logo|brand/i.test([e.id, e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className, e.getAttribute('alt'), e.getAttribute('src'), e.closest('a') && e.closest('a').getAttribute('href') === '/' ? 'home' : ''].join(' '))).slice(0, 5)
      .map(e => e.tagName === 'IMG' ? { type: 'img', src: abs(e.currentSrc || e.src) } : { type: 'inline-svg', svg: e.outerHTML.slice(0, 20000) });
    return { url: location.href, title: document.title, bg: sort(bg).slice(0, 6), text: sort(text).slice(0, 6), accents: sort(accent).slice(0, 6), fonts: sort(fonts).slice(0, 6), vars,
      googleFonts: [...document.querySelectorAll('link[href*="fonts.googleapis.com/css"]')].map(l => l.href), logos,
      icons: [...document.querySelectorAll('link[rel*=icon], meta[property="og:image"]')].map(e => abs(e.href || e.content)) };
  });
  await browser.close();
  return data;
}

/* ---------- pick the brand's colours from all sources ---------- */
function pickBrand(site, code, logo) {
  const src = {}, got = {};
  const take = (role, c, from) => { if (c && !got[role]) { got[role] = c; src[role] = from; } };
  // 1. website: what is actually on screen
  if (site) {
    const vc = []; for (const [n, v] of Object.entries(site.vars || {})) { const c = parseColor(v), r = roleOf(n); if (c && r) vc.push({ role: r, c, from: `website --${n}` }); }
    take('bg', site.bg[0], 'website (largest background)');
    take('fg', site.text.find(t => contrast(t, got.bg || '#ffffff') > 4) || site.text[0], 'website (most text)');
    take('accent', site.accents[0] || (vc.find(v => v.role === 'accent') || {}).c, site.accents[0] ? 'website (buttons / links)' : 'website CSS variable');
    take('accent2', site.accents.find(a => got.accent && otherHue(a, got.accent)) || (vc.find(v => v.role === 'accent2') || {}).c, 'website (second button colour)');
    for (const v of vc) take(v.role, v.c, v.from);
    if (site.fonts[0]) take('font', site.fonts.filter(f => !/^(Times|Arial|Helvetica|system-ui|sans-serif|-apple-system)/i.test(f))[0], 'website');
  }
  // 2. code: named variables and theme keys, best weight first; then plain usage
  if (code) {
    const byRole = {}; for (const c of code.cand) (byRole[c.role] = byRole[c.role] || []).push(c);
    for (const r in byRole) {
      const tally = {}; byRole[r].forEach(c => { tally[c.c] = tally[c.c] || { w: 0, from: c.from }; tally[c.c].w += c.w; });
      const best = Object.entries(tally).sort((a, b) => b[1].w - a[1].w);
      let pick = best[0];
      if (r === 'accent' || r === 'accent2') { pick = best.find(([c]) => sat(c) > 0.25 && lum(c) > 0.02); if (!pick) continue; }   // an accent must have colour
      take(r, pick[0], 'code ' + pick[1].from);
    }
    if (got.accent && got.accent2 && !otherHue(got.accent2, got.accent) && src.accent2.startsWith('code')) { delete got.accent2; delete src.accent2; }
    const alt = (byRole.accent || []).concat(byRole.accent2 || []).filter(c => c.w >= 2).find(c => got.accent && otherHue(c.c, got.accent));
    if (alt) take('accent2', alt.c, 'code ' + alt.from + ' (second accent)');
    const u = code.usage;
    take('bg', u.bg.find(c => lum(c) > 0.8 || lum(c) < 0.03), 'code (most used background)');
    take('fg', u.fg.find(c => got.bg ? contrast(c, got.bg) > 4.5 : true), 'code (most used text colour)');
    const sats = u.any.filter(c => sat(c) > 0.3 && lum(c) > 0.03 && lum(c) < 0.85);
    take('accent', sats[0], 'code (most used strong colour)');
    take('accent2', sats.find(c => got.accent && otherHue(c, got.accent)), 'code (second strong colour)');
    if (code.darkBg) take('darkBg', code.darkBg.c, 'code ' + code.darkBg.from);
    if (code.darkFg) take('darkFg', code.darkFg.c, 'code ' + code.darkFg.from);
    if (code.onAccent) take('onAccent', code.onAccent, 'code (text on the primary colour)');
    if (code.fonts[0]) take('font', code.fonts[0], 'code');
  }
  // 3. logo colours
  if (logo) {
    take('accent', logo.saturated[0], 'logo');
    take('accent2', logo.saturated.find(c => got.accent && otherHue(c, got.accent)), 'logo (second colour)');
    take('fg', logo.dark[0], 'logo (dark colour)');
  }
  return { got, src };
}

/* ---------- fit the brand to each look, then make every pair readable ---------- */
const PRESET = {
  dark: { bg: '#0b0b0c', fg: '#f2f5f2', accent: '#58f38e', accent2: '#ff3d7f' },
  light: { bg: '#f4f5f2', fg: '#111214', accent: '#1f5eff', accent2: '#ff4d2e' },
  poster: { bg: '#ff4d2e', fg: '#111214', accent: '#fff2d6', accent2: '#1f3cff' },
  pastel: { bg: '#fdf1f5', fg: '#2b2233', accent: '#7c5cff', accent2: '#ff8fb1' }
};
// move `c` toward black or white (whichever raises contrast with `on`) until it reaches `min`
function fixContrast(c, on, min) {
  if (contrast(c, on) >= min) return { c, changed: false };
  const to = lum(on) > 0.35 ? '#000000' : '#ffffff';
  for (let k = 0.05; k <= 1.001; k += 0.05) { const t = mix(c, to, k); if (contrast(t, on) >= min) return { c: t, changed: true }; }
  return { c: to, changed: true };
}
function fitLooks(got, font) {
  const A = got.accent, A2 = got.accent2, lightish = [got.bg, got.fg].filter(Boolean).find(c => lum(c) > 0.75), darkish = [got.fg, got.darkBg, got.bg].filter(Boolean).find(c => lum(c) < 0.05);
  const looks = {}, notes = [];
  const base = {
    dark: { bg: got.darkBg || (got.bg && lum(got.bg) < 0.03 ? got.bg : (A ? mix(A, '#08090a', 0.93) : PRESET.dark.bg)), fg: got.darkFg || (lightish && lum(lightish) > 0.8 ? lightish : PRESET.dark.fg) },
    light: { bg: got.bg && lum(got.bg) > 0.75 ? got.bg : (A ? mix(A, '#f6f6f4', 0.95) : PRESET.light.bg), fg: darkish || (got.fg && lum(got.fg) < 0.1 ? got.fg : PRESET.light.fg) },
    pastel: { bg: A ? mix(A, '#ffffff', 0.9) : PRESET.pastel.bg, fg: darkish ? mix(darkish, A || darkish, 0.12) : PRESET.pastel.fg },
    poster: { bg: A || PRESET.poster.bg, fg: null }
  };
  base.poster.fg = contrast(base.poster.bg, '#111214') >= contrast(base.poster.bg, '#fbf7ef') ? (darkish || '#111214') : (lightish || '#fbf7ef');
  for (const look of ['dark', 'light', 'poster', 'pastel']) {
    const L = { ...base[look] }, log = [];
    if (look === 'poster') { L.accent = A2 && contrast(A2, L.bg) >= 3 ? A2 : (lum(L.bg) > 0.35 ? '#111214' : '#fff2d6'); L.accent2 = A2 && L.accent !== A2 ? A2 : (lum(L.fg) < 0.1 ? '#fbf7ef' : '#111214'); }
    else { L.accent = A || PRESET[look].accent; L.accent2 = A2 || PRESET[look].accent2; }
    // readable: text 4.5, accent (big numbers, ticks) 3, accent2 (hits, badges) 2 — adjusted colours are reported
    for (const [k, min] of [['fg', 4.5], ['accent', 3], ['accent2', 2]]) { const r = fixContrast(L[k], L.bg, min); if (r.changed) log.push(`${k} ${L[k]} → ${r.c} (was ${contrast(L[k], L.bg).toFixed(2)}:1 on ${L.bg}, needs ${min}:1)`); L[k] = r.c; }
    L.muted = mix(L.fg, L.bg, 0.42);
    if (contrast(L.muted, L.bg) < 3) L.muted = fixContrast(L.muted, L.bg, 3).c;
    if (look === 'dark') { L.card = mix(L.bg, L.fg, 0.07); L.line = mix(L.bg, L.fg, 0.16); L.cardfg = L.fg; }
    else if (look === 'poster') { L.card = lum(L.fg) < 0.1 ? L.fg : '#111214'; L.cardfg = lum(L.card) < 0.1 ? (lightish || '#fbf7ef') : '#111214'; L.line = L.card; }
    else { L.card = '#ffffff'; L.line = mix(L.bg, L.fg, 0.12); L.cardfg = L.fg; }
    const acOnCard = fixContrast(L.accent, L.card, 3); if (acOnCard.changed && look !== 'poster') { log.push(`accent on cards ${L.accent} → ${acOnCard.c}`); L.accent = acOnCard.c; }
    if (look === 'poster') { const r = fixContrast(L.accent, L.card, 3); if (r.changed) L.accent = contrast(L.cardfg, L.card) >= 3 ? L.cardfg : r.c; }
    L.font = font;
    looks[look] = L;
    const pairs = { 'fg on bg': contrast(L.fg, L.bg), 'accent on bg': contrast(L.accent, L.bg), 'accent2 on bg': contrast(L.accent2, L.bg), 'muted on bg': contrast(L.muted, L.bg), 'card text on card': contrast(L.cardfg, L.card), 'accent on card': contrast(L.accent, L.card), 'bg on accent (ticks, buttons)': contrast(L.bg, L.accent) };
    notes.push({ look, ratios: Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, +v.toFixed(2)])), adjusted: log });
  }
  return { looks, notes };
}

/* ---------- colour strip (SVG always, PNG with Playwright) ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function swatchSVG(looks, only, family, title) {
  const names = only ? [only] : Object.keys(looks), rowH = 190, W = 1200, H = 70 + names.length * (rowH + 16);
  const fam = esc(family || 'Inter Tight') + ", 'Noto Sans Thai', system-ui, sans-serif";
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${fam}">
<rect width="${W}" height="${H}" fill="#f7f7f5"/><text x="24" y="44" font-size="26" font-weight="800" fill="#111">${esc(title)}</text>`;
  names.forEach((n, i) => {
    const L = looks[n], y = 70 + i * (rowH + 16), chip = (x, k, lab) => {
      const r = k === 'card' ? contrast(L.cardfg, L.card) : contrast(L[k], L.bg), edge = lum(L.bg) > 0.4 ? '#00000033' : '#ffffff55';
      return `<rect x="${x}" y="${y + 118}" width="112" height="56" rx="10" fill="${L[k]}" stroke="${edge}"/><text x="${x}" y="${y + 110}" font-size="13" fill="${L.muted}">${lab}</text>` +
        `<text x="${x + 8}" y="${y + 141}" font-size="13" font-weight="700" fill="${contrast(L[k], '#000') > 7 ? '#000' : '#fff'}">${L[k]}</text>` +
        `<text x="${x + 8}" y="${y + 161}" font-size="12" fill="${contrast(L[k], '#000') > 7 ? '#000' : '#fff'}">${k === 'bg' ? '' : (k === 'card' ? 'text ' : '') + r.toFixed(1) + ':1'}</text>`;
    };
    s += `<g><rect x="24" y="${y}" width="${W - 48}" height="${rowH}" rx="18" fill="${L.bg}" stroke="#0001"/>
<text x="48" y="${y + 54}" font-size="40" font-weight="900" fill="${L.fg}">${esc(n[0].toUpperCase() + n.slice(1))} <tspan fill="${L.accent}">฿1,290</tspan></text>
<text x="48" y="${y + 84}" font-size="18" fill="${L.muted}">${esc((family || 'default font') + ' · text / muted / accent')}</text>
<rect x="${W - 380}" y="${y + 22}" width="150" height="50" rx="25" fill="${L.accent}"/><text x="${W - 305}" y="${y + 54}" font-size="18" font-weight="800" text-anchor="middle" fill="${L.bg}">Book now</text>
<rect x="${W - 216}" y="${y + 16}" width="168" height="84" rx="14" fill="${L.card}" stroke="${L.line}" stroke-width="2"/><text x="${W - 200}" y="${y + 50}" font-size="17" font-weight="700" fill="${L.cardfg}">Card text</text><text x="${W - 200}" y="${y + 82}" font-size="22" font-weight="900" fill="${L.accent}">฿799</text>
<circle cx="${W - 404}" cy="${y + 47}" r="12" fill="${L.accent2}"/>
${chip(48, 'bg', 'background')}${chip(172, 'fg', 'text')}${chip(296, 'muted', 'muted')}${chip(420, 'accent', 'accent')}${chip(544, 'accent2', 'accent 2')}${chip(668, 'card', 'card')}</g>`;
  });
  return s + '</svg>';
}
async function swatchPNG(svg, png, googleFonts) {
  let pw = null; for (const n of ['playwright', 'playwright-core']) { try { pw = require(n); break; } catch (e) {} }
  if (!pw) return false;
  const { launch, routeGsap } = require('./_browser');
  const browser = await launch(); const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
  await routeGsap(page);                                    // also serves Google Fonts from @fontsource when offline
  await page.setContent(`<html><head>${(googleFonts || []).map(h => `<link rel="stylesheet" href="${esc(h)}">`).join('')}</head><body style="margin:0">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready).catch(() => {}); await page.waitForTimeout(300);
  await page.locator('svg').screenshot({ path: png }); await browser.close(); return true;
}

(async () => {
  const a = args(process.argv.slice(2), { out: 'brand.json' });
  const target = a._[0];
  if (!target && !a.code && !a.logo) { console.log('usage: node brand.js [url | page.html] [--code <folder>] [--logo logo.svg] [--look pastel] [--out brand.json] [--swatch brand-swatch]'); process.exit(2); }
  let site = null, code = null, logo = null; const warn = [];
  if (target) {
    try { site = await scanSite(target, a.shot); }
    catch (e) {
      if (e.code !== 3) throw e;
      console.error(e.message);
      if (!a.code && !a.logo) { console.error('Nothing written. Ask the user for brand colours + a logo file, the app\'s code folder (--code), or a saved .html of the page.'); process.exit(3); }
      warn.push(e.message + ' Used the other sources.');
    }
  }
  if (a.code && a.code !== true) { if (!fs.existsSync(a.code)) { console.error(`--code: ${a.code} not found`); process.exit(2); } code = scanCode(a.code); if (!code.cand.length && !code.usage.any.length) warn.push(`No colours found in the code under ${a.code}.`); }
  if (a.logo && a.logo !== true) { if (/\.svg$/i.test(a.logo)) logo = scanLogo(a.logo); else warn.push('--logo takes an SVG; for PNG/JPG run vectorize.py first (references/logo.md).'); }
  const { got, src } = pickBrand(site, code, logo);
  const found = ['bg', 'fg', 'accent', 'accent2'].filter(k => got[k]);
  if (!got.accent) warn.push('No brand accent found: the looks keep their preset accent. Ask the user for the brand colour.');
  const family = got.font || null;
  const fontStack = [family, 'Noto Sans Thai', 'system-ui', 'sans-serif'].filter(Boolean).filter((v, i, s) => s.indexOf(v) === i).map(f => /\s/.test(f) ? `'${f}'` : f).join(',');
  const { looks, notes } = fitLooks(got, fontStack);
  const googleFonts = [...(site ? site.googleFonts : []), ...(code ? code.googleFonts : [])].filter((v, i, s) => s.indexOf(v) === i);
  if (family && !googleFonts.length && !/^(Inter Tight|Noto Sans Thai)$/i.test(family)) warn.push(`Font "${family}": add its Google Fonts link (or @font-face) to the clip, or it falls back.`);
  const look = typeof a.look === 'string' && looks[a.look] ? a.look : null;
  const out = {
    brand: { ...Object.fromEntries(['bg', 'fg', 'accent', 'accent2', 'darkBg', 'darkFg', 'onAccent'].filter(k => got[k]).map(k => [k, got[k]])), font: family },
    sources: src, looks, contrast: notes, style: looks[look || 'dark'],             // `style` kept for older clips
    fonts: { family, stack: fontStack, found: [...new Set([...(site ? site.fonts : []), ...(code ? code.fonts : [])])].slice(0, 6) }, googleFonts,
    site: site ? { url: site.url, title: site.title, logos: site.logos, icons: site.icons, palette: { backgrounds: site.bg, text: site.text, accents: site.accents } } : null,
    code: code ? { files: code.files, variables: code.variables, usage: code.usage } : null,
    logo: logo ? { colors: logo.colors.slice(0, 8) } : null, warnings: warn
  };
  fs.writeFileSync(a.out, JSON.stringify(out, null, 2));
  const sw = (a.swatch && a.swatch !== true ? a.swatch : a.out.replace(/\.json$/i, '') + '-swatch').replace(/\.(svg|png)$/i, '');
  const svg = swatchSVG(looks, look, family, `Brand colours${look ? ' · ' + look : ''} — ${found.length ? 'from ' + [...new Set(Object.values(src).map(s => s.split(' ')[0]))].join(' + ') : 'none found (presets)'}`);
  fs.writeFileSync(sw + '.svg', svg);
  let png = false; try { png = await swatchPNG(svg, sw + '.png', googleFonts); } catch (e) { warn.push('PNG strip skipped: ' + e.message.split('\n')[0]); }
  console.log(`brand ${found.length ? 'found: ' + found.map(k => `${k} ${got[k]}`).join('  ') : 'NOT found (looks use preset colours)'}${family ? '  font ' + family : ''}`);
  for (const k of Object.keys(src)) console.log(`  ${k.padEnd(8)} ← ${src[k]}`);
  for (const n of notes) if (!look || n.look === look) console.log(`  ${n.look.padEnd(6)} fg ${n.ratios['fg on bg']}:1 · accent ${n.ratios['accent on bg']}:1${n.adjusted.length ? '  adjusted: ' + n.adjusted.join('; ') : ''}`);
  warn.forEach(w => console.log('  ! ' + w));
  console.log(`  saved ${a.out} · strip ${sw}.svg${png ? ' + .png' : ''}`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
