// © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A
// shared helpers for check.js / render.js / brand.js
// needs Playwright:  npm i playwright   (or playwright-core + a Chromium; set CHROMIUM_PATH=/path/to/chrome)
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch (e) {}
  }
  console.error('Playwright not found. Install it next to this script:  npm i playwright   (then: npx playwright install chromium)');
  process.exit(2);
}

async function launch() {
  const { chromium } = loadPlaywright();
  const opts = { args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] };   // file access: render.js reads the user's song next to the clip
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  try { return await chromium.launch(opts); }
  catch (e) {
    // Playwright version and installed browser don't match: try any Chromium already on the machine
    const found = findChromium();
    if (!found || opts.executablePath) throw e;
    console.error(`Playwright's own Chromium is missing; using ${found}`);
    return chromium.launch({ ...opts, executablePath: found });
  }
}

function findChromium() {
  const os = require('os');
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  const exes = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium'];
  for (const r of roots) {
    let dirs = []; try { dirs = fs.readdirSync(r).filter(d => /^chromium-\d+$/.test(d)).sort().reverse(); } catch (e) { continue; }
    for (const d of dirs) for (const x of exes) { const p = path.join(r, d, x); if (fs.existsSync(p)) return p; }
  }
  return null;
}

// serve GSAP from node_modules when the CDN is unreachable (offline / sandbox); everything else goes through normally
async function routeGsap(page) {
  let local = null;
  try { local = require.resolve('gsap/dist/gsap.min.js'); } catch (e) {}
  await page.route(/gsap(\.min)?\.js/, async route => {
    if (local) return route.fulfill({ body: fs.readFileSync(local), contentType: 'application/javascript' });
    return route.continue();
  });
  await routeFonts(page);
}

// Google Fonts offline: if @fontsource/<family> is installed (npm i @fontsource/inter-tight @fontsource/noto-sans-thai),
// answer fonts.googleapis.com CSS requests with local @font-face rules; otherwise let the request through
async function routeFonts(page) {
  await page.route(/fonts\.googleapis\.com\/css2?/, async route => {
    const url = new URL(route.request().url()), css = [];
    for (const fam of url.searchParams.getAll('family')) {
      const [name, spec = ''] = fam.split(':'), slug = name.replace(/\+/g, ' ').toLowerCase().replace(/\s+/g, '-');
      let dir; try { dir = path.dirname(require.resolve(`@fontsource/${slug}/package.json`)); } catch (e) { continue; }
      const weights = (spec.match(/wght@([\d;.]+)/) || [, '400'])[1].split(';');
      for (const w of weights) {                       // fontsource ships <weight>.css with every subset + unicode-range
        const f = path.join(dir, `${w}.css`); if (!fs.existsSync(f)) continue;
        css.push(fs.readFileSync(f, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, (m, file) => `url(${pathToFileURL(path.join(dir, 'files', file)).href})`));
      }
    }
    if (!css.length) return route.continue().catch(() => route.abort());
    return route.fulfill({ body: css.join('\n'), contentType: 'text/css' });
  });
}

function args(argv, defaults = {}) {
  const out = { _: [], ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true; else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function clipUrl(file, query = {}) {
  const u = /^https?:/.test(file) ? new URL(file) : pathToFileURL(path.resolve(file));
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== false) u.searchParams.set(k, v === true ? '1' : String(v));
  return u.href;
}

async function openClip(browser, file, { width = 1400, height = 1000, scale = 1, query = {}, context = null } = {}) {
  const page = context ? await context.newPage() : await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });   // context: e.g. a phone (qa.js)
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });
  await routeGsap(page);
  await page.goto(clipUrl(file, query));
  if (!(await page.evaluate(() => !!window.gsap))) {
    throw new Error('GSAP did not load (CDN blocked or offline). Install it next to these scripts and retry:\n' +
      '  npm i gsap@3.12.5 @fontsource/<each Google font the clip uses>\n' +
      "(if Playwright is already on the machine, install only these — don't let npm pull a new Playwright)");
  }
  try { await page.waitForFunction(() => window.CLIP && window.CLIP.ready === true, null, { timeout: 30000 }); }
  catch (e) {
    const hasClip = await page.evaluate(() => !!window.CLIP);
    throw new Error((hasClip ? 'CLIP.ready never became true (fonts / iframes / build() did not finish).'
      : 'No window.CLIP: this file is not built on assets/template.html, so check.js cannot drive it.') +
      (errors.length ? '\nPage errors:\n  ' + errors.slice(0, 5).join('\n  ') : ''));
  }
  return { page, errors };
}

module.exports = { launch, openClip, args, clipUrl, routeGsap };
