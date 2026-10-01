<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Gotchas (every one of these happened in a real clip)

```js
// ❌ long blur on a big piece or the whole frame → phones freeze / the page reloads
tl.to('#scene', {filter:'blur(20px)'})
// ✅ fade or move instead (and fake motion blur with .fx --s); short (≤ 0.6 s) blur on small pieces or a sparse streak layer is fine on desktop
tl.to('#scene', {autoAlpha:0, scale:1.05})

// ❌ animating left / top / width → jank
tl.to('.card', {left:300, width:600})
// ✅ transforms only
tl.to('.card', {x:300, scaleX:1.2})

// ❌ immediateRender:false → scrubbing back before this tween doesn't restore the value (GSAP 3.12.5)
tl.fromTo('#tk', {scale:0}, {scale:1, immediateRender:false})
// ✅ keep fromTo's default
tl.fromTo('#tk', {scale:0}, {scale:1})

// ❌ a second fromTo on the same property of the same element → its 'from' leaks back over earlier time when scrubbing
tl.fromTo('#logo', {scale:0.6}, {scale:1}, 15)
// ✅ second and later moves: to, or to + keyframes
tl.to('#logo', {keyframes:[{scale:0.6, duration:0.01}, {scale:1, duration:0.6}]}, 15)

// ❌ binding the loop (onComplete) before tl.time(END) → the clip plays by itself on open
tl.eventCallback('onComplete', loop); tl.time(END, false); tl.time(0, false)
// ✅ prime every tween first, then bind
tl.time(END, false); tl.time(0, false); tl.eventCallback('onComplete', loop)

// ❌ fixed coordinates → overflow when the aspect changes
el.style.left = '1500px'
// ✅ from the frame size
el.style.left = px(W * 0.78)

// ❌ returning the timeline from Playwright's evaluate → the test hangs (it tries to serialize GSAP)
await page.evaluate(t => tl.time(t), t)
// ✅ braces, return nothing
await page.evaluate(t => { tl.time(t) }, t)
```

- Never clone dozens of heavy pieces; never zoom a big layer more than 2× (phones run out of memory and reload). Hide what the shot doesn't use (`autoAlpha:0`).
- Big text must not overflow: measure after `document.fonts.ready`, shrink to fit. Numbers inside a frame ≤ 80 % of its width.
- No CSS `transform` on elements GSAP moves with `x` / `xPercent`: GSAP reads the CSS value as the start and the piece gets stuck mid-frame. Put start values in `fromTo`.
- Full-frame layers (flash, gradient) never tween `scale` — the square edges show. Only `autoAlpha`.
- Overlays (flashes, speed lines, gradient bars) must fade completely after the move; two stacked gradients both fade, or a grey band stays.
- Two tweens on the same property of the same element must not overlap in time (e.g. a 0.38 s press, then a shrink-away that starts before the press ends). Leave a gap.
- Text / class / colour changes go through `proxy()` (tween a number, draw in `onUpdate`), so they are right when scrubbing both ways.
- Randomness (e.g. spin of falling digits) is decided once while building the timeline, never per frame — otherwise forward and reverse frames differ.
- Mask reveals: `autoAlpha` together with `yPercent`, or Thai vowel / tone marks leave dots.
- Thai typing: split with `graphemes()` (Intl.Segmenter) — slicing a string cuts marks off their consonants.
- Iframes with real app CSS: `color-scheme:normal` inside, or dark themes paint an opaque box.
- Changing the theme or background: change the real colours of the background and every piece; never a colour overlay.
- Overview shots: hide other groups' pieces so they don't peek in at the edges.
- `gsap.ticker.fps` is only set by the player's fps picker.
- Google Fonts need the network. In a sandbox the check sheet shows fallback fonts; tell the user the real clip will look slightly different, and re-measure text after `document.fonts.ready`.
- Function-based random values in a tween (`rotation:() => random()`) differ on every page load: renders and checks disagree. Use index-based values (`rotation:i => (i * 53 % 80) - 40`).
- A value read by a tween before the code that sets it (e.g. a glow colour picked later in the build): use a function value (`'--gc':() => GLOW.x`), GSAP reads it when the tween first plays.
- Headless screenshots right after a visibility change can show the previous frame: wait ≥ 300 ms before each shot in check scripts.
- Lengthening a clip cut to the user's song: the extra time comes from more of the song (move `songStart` earlier by whole bars, or end later on a bar line) and `beats` / `bars` must cover the new range; re-run `beats.js --length <new>` if the drop should stay mid-clip. Never stretch `B(n)` away from the song's beats.
- Lengthening a finished clip: shift every `B(n)` after the insertion point (regex over `B(number)`), then every beat number that is not inside `B()` (caption lists, colour lists, loops, hush windows, sub drops), then re-run `check.js`.
- A camera tween (`#world x / y / scale`) and a punch on the same element must not overlap; neither may a heading's entry and exit (shorten the entry to fit the gap).
- **Transitions, camera, effects (sections 6b / 6c):**
  - Build every scene before the timeline: a `trans.*` call needs both ends, `rig()` moves the scene's children into its layers, and `ghosts` copies are made after the build (so they see every tween).
  - Each rig layer has one owner: `hand` = handheld / shake, `tilt` = angle / roll / orbit / handPan, `dolly` = zoom and framing. A normal tween on `R.hand` is overwritten every frame by the handheld driver.
  - Per-frame work goes in `HOOKS.push(now => …)` and must depend only on `now` (and seeded `hash01` / `vnoise` / `fbm`), never on the last frame or `Math.random`.
  - `tl.to(...)` returns the timeline, not the tween: to keep a tween for later (`tl.remove`), make it with `gsap.to(...)` and `tl.add(tween, at)`.
  - Two scale tweens on one element that overlap (a chained `jump` landing while the next take-off starts) make it snap when the first one ends: `jump` squeezes the last landing; for your own tweens, end one before the next starts.
  - `secondary` / `puppet` write the CSS `translate` / `rotate` / `scale` properties, not `transform`: don't set those by hand on the same element.
  - Blur costs: keep particles, big blurred layers and `rgbSplit` out of the 0.6 s around a blur transition; never ghost a huge world.
  - `rgbSplit` is skipped on Safari (SVG filters on HTML are slow there); do not rely on it to carry meaning.
- `check.js` fails with "reverse mismatch": look for a second `fromTo` on the same property, `immediateRender:false`, a one-off callback that changes text/classes, or per-frame randomness.
- **Phones (real iPhone test, page reloaded at 5.5 s):** a big layer (wider than the frame) with a CSS `mask-image` inside a 3D-tilted camera runs a phone out of memory and the page reloads, while desktop plays fine. On `LITE` don't put `mask-image` on anything that big or on a 3D layer: draw the fade into the canvas (`globalCompositeOperation = 'destination-in'` + a radial gradient) or use a smaller element. Desktop can keep the mask. Clip-specific canvases size themselves with `LITE ? 0.35 : 0.5` like the particles.
- **From a real test:**
  - Tweening `boxShadow` between two strings written differently (order of colour / offsets) scrubs back wrong: put the glow on its own layer and tween its `autoAlpha`.
  - Rows that can wrap (chips, tags, long labels): measure `offsetHeight` after the build and place what comes next under the real height — a fixed gap let a card sit on the second row.
  - A hover highlight that must follow the pointer: `tl.set` it at the moment the pointer arrives (same time as the `cursorTo` end), never tween it ahead of the pointer.
  - `trans.zoomBlur` into a point: pass `{at:[x, y]}` (0–1 of the frame) and keep the camera still during it — moving the dolly at the same time makes the blur copies slide off the subject.
  - The pointer clicks on empty space in a row (right side), never on top of the words it is choosing.
