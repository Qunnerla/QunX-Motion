<!-- © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A -->
# Real app UI as pieces (not screenshots, not whole screens)

Render the app's real code **one piece at a time** (a card, the wallet, a button, an input, a goal box). It matches the app to the pixel and can move through its real states. Never lift a whole screen (app header, page background, profile, tab bar): the clip turns into a screen recording. Only if the user asks.

## Ways to bring the UI in (pick per project)

| Way | Use when | Notes |
| --- | --- | --- |
| **Iframe with the app's own CSS + markup** (steps below) | web app you can run or read (HTML / JS / CSS) | pixel-exact, real states, CSS never leaks; heavier |
| **Rebuild the piece in the clip** from the app's tokens (colours, radius, fonts, spacing) | small pieces (a chip, a button, a toggle), React / Flutter / native apps, or the iframe is too heavy | lighter and easier to animate; say it is a rebuild |
| **SVG export** of a design (Figma, the app's icons) | illustration-like pieces, icons, charts | crisp at any zoom; animate paths and groups |
| **Rendered HTML from the framework** (SSR / `renderToString`, a Storybook story) | component libraries | then treat it like the iframe way |
| **User's screenshots / video** | nothing else exists | only as a guide or inside a device frame, and say it is a picture, not live UI |

Clip-only changes (a number moved lower, a smaller button, a custom colour) go into the clip's own override CSS inside the iframe — **never** into the user's app files — and are listed in the hand-off so the user can decide whether the app should change too.

## Steps (iframe way)

1. **Get the real folder** (index.html, JS, CSS). If the user's computer is linked, ask for access to that folder. Read only — never edit the real files, never touch secrets such as `.env`. Read a project status / changelog file first if there is one: it tells you what was renamed or dropped (stale data).
2. **Open the real app in a headless browser** (Playwright) at phone width, e.g. 430 px. If the app has a lock screen, set the unlock value through localStorage / an init script — only for the user's own app.
3. **Let the app build the markup:** call the app's own render functions (e.g. `walletHTML()`, `renderGoals()`) after fixing the data agreed in the data check, then keep: the HTML, the icon sprite those pieces use, and all of the real CSS. Store them as JSON in a `<script type="application/json">` inside the clip.
4. **One iframe per group of pieces:** real CSS + markup in `iframe.srcdoc`, so the app's CSS never collides with the clip's. Add inside the iframe:
   - `html,body{color-scheme:normal!important;background:transparent!important}` — without `color-scheme` a dark-theme app paints the iframe as an opaque box
   - `html{zoom:Z}` — enlarge inside the iframe (sharper than scaling the iframe from outside)
   - `*{transition:none!important;animation:none!important}` — the clip drives every move; also hide hint text or copy you don't want
5. **Move with the app's own math:** copy the app's constants and layout functions (e.g. `WALLET`, `walletGeom()`, `walletTf()`) into a `pose(state)` function that returns the numbers for every piece. List keyframes `[time, state, duration]` in the app's real order of moves (e.g. lift over the rim for 0.3 s, then drop into the slot). `apply(time)` finds the keyframe covering that time, blends from the previous state with an ease close to the app's transition (`cubic-bezier(.2,.9,.25,1)` ≈ `power3.out`) and writes styles into the iframe. Hook it to the clock: `window.onClipTime = apply` (the template calls it on every render, also while scrubbing and in `render.js`).
6. **Discrete changes** (open/closed classes, typed text, card colour) come from the current keyframe's state or from a `proxy()` value — never from a one-off callback, or scrubbing back won't undo them.
7. **The camera moves the box around the iframe**, not the inside. World coordinates from the app's CSS pixels: `worldX = box.left + x * Z`; then `camAt()` puts that point anywhere on screen.
8. **Build after everything is ready:** push `new Promise(r => iframe.addEventListener('load', r, {once:true}))` and the iframe's `contentDocument.fonts.ready` into `READY` in the template.
9. **Hidden pages (`display:none`) have no size:** show briefly, measure, hide again before computing camera or travel distances.
10. Use the app's real data (balances, names, %). If the test machine's data differs from the user's, or you converted values, tell the user.

## Details that bit us

- **Shadows cut into grey boxes:** keep `html{overflow:hidden}` but `body{overflow:visible}`, and give every piece padding ≥ its shadow blur + offset inside the iframe (a card with `0 10px 24px` needs ≥ 40 px). Never put `filter` on an iframe to dim it (it can paint a grey rectangle); scale or fade instead.
- **Moves that are not in the app:** extend the pose engine instead of hand-animating: per-key eases (`wkey(t, state, dur, 'back.out(1.6)')` for a pop), partial drags (`drag:{i:-150}` like a finger half-lifting a card), hand-off poses (`over:{i:{top, op, z}}`) so a big hero copy can turn into the real piece.
- **Things placed "in front of" a container** (a new card in front of a wallet) must sit below the container's top edge and above its z-index; to put it inside, lift it over the rim first, then drop it in (two keys), as the app does.
- **Custom colours:** port the app's own colour rule (e.g. `walletCardColors()` for a picked colour) so a colour picker in the clip gives the same card the app would.
- **Hero copies:** the same piece drawn large in its own iframe (zoom 8–10) for close-ups, positioned by one proxy that also moves the world camera; hide the hero and show the real piece on the same frame.

No headless browser available: copy markup from index.html and the output of the render functions by reading the code, put it in an iframe the same way, and tell the user which parts were assembled by hand.

## Skeleton

```js
const WZ = 1.8;                                            // zoom inside the iframe
const wf = document.querySelector('#wf');
wf.srcdoc = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>${APP.css}
html,body{color-scheme:normal!important;background:transparent!important;margin:0!important;overflow:hidden!important}
html{zoom:${WZ}} *,*::before,*::after{transition:none!important;animation:none!important}</style></head>
<body>${APP.sprite}<div class="wrap">${APP.markup}</div></body></html>`;
READY.push(new Promise(r => wf.addEventListener('load', r, {once:true})).then(() => wf.contentDocument.fonts.ready));

const KEYS = [];                                           // [time, state, duration]
const key = (t, S, dur = 0.55) => KEYS.push({t, S, dur, P:pose(S)});
const ease = gsap.parseEase('power3.out'), lerp = (a, b, p) => a + (b - a) * p;
window.onClipTime = time => {
  let i = 0; while (i + 1 < KEYS.length && KEYS[i + 1].t <= time) i++;
  const cur = KEYS[i], prev = KEYS[Math.max(0, i - 1)];
  const p = i === 0 ? 1 : ease(Math.min(1, Math.max(0, (time - cur.t) / cur.dur)));
  // write lerp(prev.P.x, cur.P.x, p) etc. into the iframe's elements; classes from cur.S; z-index from cur once p > 0
};
```
