<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Transitions: a menu, not one house style

Every shot hands over to the next (core rule 4), but **how** changes from clip to clip. Pick per clip from this menu by the template, the style and what the two shots share. In one clip: 3–5 different kinds, none used more than twice in a row, and the strongest one saved for the main reveal. Offer 2 options in the storyboard where a cut can go either way.

## Contents
- Choosing
- The menu
- Library transitions `trans.*`: zoom / spin / directional blur, glitch, light leak, flare, film burn, ink, shape mask, flip, panels, track matte, page curl
- Carry-over (match) cuts: how to line them up
- Dissolves without a grey haze
- Directional box blur (streaks)

## Choosing

| The two shots share… | Best kinds |
| --- | --- |
| the same word / number / object | **carry-over**, morph |
| a shape or colour | match cut on shape, colour wipe, iris |
| nothing | whip-pan, smear, zoom-through, streaks, flash, glitch cut, push |
| light ↔ dark change | dissolve done right (below), wipe, flash |
| a UI flow (tap → next screen) | push / slide, card expand, zoom into the tapped piece |

| energy change (calm → loud) | zoom blur, crash zoom, glitch, film burn |
| a warm / emotional turn | light leak, flare, dissolve done right |
| a word that names the next shot | track matte (`textMatte`) |
| paper, docs, "turn the page" | page curl, flip |

Style fit: **dark / neon** → streaks, glitch, smear, RGB kick, zoom / spin blur · **light / clean** → carry-over, push, iris, dissolve, shape mask, page curl · **poster** → hard cuts on the beat, colour-bar wipe, stamp · **pastel** → soft zoom, dissolve, fan / fold, ink wipe, light leak · **film / editorial** → film burn, light leak, flare, track matte.

## The menu

| Kind | What happens | How |
| --- | --- | --- |
| Carry-over (match) | an element stays **in the same place and size** while everything around it changes; the new shot's camera starts framed exactly like the old one, then moves | measure both boxes, set the new camera so they coincide (below) |
| Hero zoom-out | the carried element turns into a value inside real UI (a number becomes the card's balance), the camera pulls out to show where it lives | one proxy drives both the world camera and the hero piece |
| Morph | one shape turns into another in place (100 % → ✓, a word → an icon) | squash the old (`scaleX → .08`, fade) while the new draws in (`stroke-dashoffset`, `back.out`) |
| Zoom-through | scale the scene 4–6× through a letter or hole and fade | sparse scenes only; `power4.in` |
| Whip-pan | camera flies to the next piece | `expo.inOut` 0.5–0.7 s + whoosh |
| Smear | pieces leave in one direction with a motion trail (`.fx --s`) | same direction for exit and entry |
| Streaks + box blur | coloured lines run across the cut, heavily blurred sideways (AE "Fast Box Blur", horizontal) | SVG `feGaussianBlur stdDeviation="X 0"` ramped up then down |
| Colour-bar wipe | 5–6 bars cover, the cut happens under them, bars leave | `wipe(at)` in `recipes.md` |
| Iris / circle | a circle grows from the piece that was tapped | `clip-path: circle()` tween |
| Flash | brand-coloured radial flash covers the cut | `autoAlpha` only, never scale |
| Glitch cut | 2–3 frames of RGB split + slice offset, then the new shot | `kickRGB` + `x` jitter decided at build time |
| Push / slide | the new shot pushes the old one out | both move together, same ease |
| Fan / fold | stacked items fan open behind the hero, then fold shut before the next cut | hinge (transform-origin) inside the hero's edge; nothing may stick out past the hero's edges |
| Dissolve | the new shot melts in | only the "without grey haze" way below |
| Hard cut on the beat | nothing but the beat | poster / beat-cut clips |

## Library transitions `trans.*`

Built into the template (section 6b). Each one is a pure function of clip time (scrubbing, reverse, render all match), plays its own sound, and tells `qa.js` its window so blur and overlap inside it are not reported as bugs.

```js
const S2 = mkScene(...), R2 = rig(S2);          // build BOTH scenes first — a transition needs its two ends
const T = trans.zoomBlur(S1, S2, 4.2, {dur:0.7});  // returns the cut time: start the next shot's moves from it
chapter(T, 'Feature');
```
`A` / `B` are full-frame `.scene` elements (absolute, `inset:0`). Put the scene's content in a `rig()` (camera.md) so the blur copies the content, not the background colour. Only `flare` may take `null, null` (then it is an accent inside one shot).

| Call | Looks like | Options (defaults) | Sound |
| --- | --- | --- | --- |
| `trans.zoomBlur(A, B, at)` | radial blur: A rushes into the lens, B comes out of it, speed lines | `dur .7`, `scale`, `amt`, `lines:true`, `lineColor` | whoosh |
| `trans.spinBlur(A, B, at)` | A spins away blurred, B spins in the other way | `dur .7`, `deg` | swirl |
| `trans.dirBlur(A, B, at)` | directional / fast box blur whip at any angle | `dur .55`, `angle` (deg, 0 = to the left) | whoosh |
| `trans.glitch(A, B, at)` | slices tear in steps, RGB split, colour blocks | `dur .45`, `amp`, `colors` | zap |
| `trans.lightLeak(A, B, at)` | warm light washes over; cut under the brightest frame | `dur 1`, `colors`, `fromRight` | shimmer |
| `trans.flare(A, B, at)` | lens-flare streak + ghosts cross the frame | `dur .8`, `color`; `null, null` = accent only | shimmer |
| `trans.filmBurn(A, B, at)` | hot orange burn from an edge + grain | `dur 1` | burn |
| `trans.inkWipe(A, B, at)` | B spreads out of a point with a wet edge | `dur .9`, `from:[x,y]` (0–1), `seed` | ink |
| `trans.shapeMask(A, B, at)` | B grows out of a shape | `dur .7`, `shape: circle · diamond · star · hex · square`, `from`, `spin` | pop / whoosh |
| `trans.flip(A, B, at)` | 3D card flip | `dur .8`, `axis:'y'` or `'x'` | flip |
| `trans.panels(A, B, at)` | B arrives in bands from alternating sides | `dur .7`, `n 4` | whooshes |
| `trans.textMatte(A, B, at)` | B shows inside a big word that swells until it fills the frame (track matte) | `dur .9`, `text`, `size .5`, `focus:[x,y]` (a point inside a letter) | riser → thump |
| `trans.pageCurl(A, B, at)` | A's corner folds over and peels away | `dur 1` | flip + swish |

Overlays for any cut or hit: `speedLines(at, dur, {cx, cy, color})`, `flash(at, dur, color)`, `grain(from, to, opacity)`, `rgbSplit(el, from, to, px)` (effects.md). Camera-made transitions: `crashZoom`, `handPan` (a human whip-pan), `snapZoom` (camera.md).

Rules:
- 3–5 kinds per clip; the loudest (glitch, film burn, zoom blur) once, on the main reveal or the drop.
- Match the look: glitch / zoom blur on dark or neon; light leak, ink, shape mask, page curl on light or pastel; film burn, flare on film / editorial.
- Durations: blur kinds 0.45–0.7 s, light kinds 0.8–1.1 s. Longer ones feel slow in a 15 s clip.
- Blur is expensive: keep other heavy effects (particles, big blurred layers) out of the 0.6 s around a blur transition. On old phones pick 30 fps (card 2).
- `qa.js` ignores overlap, empty frames, flicker and jumps inside `TRANS` windows — but a transition longer than 1.2 s is still judged like a shot.

**Light ↔ dark**: going from a white scene to a dark one (or back) is a fade of the real background colours (plus text colour), ~0.5 s — a hard cut there reads as a mistake. `trans.zoomBlur(A, B, t, {at:[x, y]})` zooms into a point such as a button just clicked ("sucked in"): keep the camera still during it.

## Carry-over cuts: how to line them up

1. Give both copies the same font, weight, letter-spacing and numeric style (`tabular-nums` on both), and the same gaps between words.
2. Measure the anchor on both sides with layout values (`offsetLeft/Top` chains; not `getBoundingClientRect` while tweens have set transforms). For text inside an iframe, take one character's box with a `Range` and convert with the element's known width.
3. Old shot on screen: point `A` at scale `s₁`. New shot: the same point `B` in its own layout at scale 1. Start the new layer at `scale = s₁·size₁/size₂`, `x = A.x − scale·B.x`, `y = A.y − scale·B.y` (transform-origin 0 0), then tween to identity.
4. For a value that ends up inside real UI: draw that UI piece large (its own iframe at high zoom), align the digit heights (`fontSize · capHeight`), cross-fade in 0.12 s, then pull out with one proxy that moves the world camera and the piece together (log-interpolate the scale).

## Dissolves without a grey haze

A light shot fading over a dark one (or the other way) turns the whole frame grey. Instead:
1. The incoming hero appears **opaque on top of** the old background (it is crisp from the first frame).
2. The old shot's decoration melts out with blur + fade (`filter: blur(0 → 14px)` + `autoAlpha`), 0.35 s.
3. Only the leftover background changes colour (`#f4f5f2 → #0b0b0c`), 0.5 s.
Never keep a paper-coloured box behind a label during a dissolve: cut a gap in the frame line instead.

## Directional box blur

```html
<svg width="0" height="0" style="position:absolute"><filter id="hbox-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur id="hbb" stdDeviation="0 0"/></filter></svg>
```
```js
// streak layer (full frame, never scaled): 10–14 bars in brand / app colours, moved with x; blur peaks mid-cut
proxy(at, dur, 0, 1, u => { const b = u < .45 ? u / .45 : 1 - (u - .45) / .55; hbb.setAttribute('stdDeviation', `${b * 90} ${b * 2}`); }, 'none');
```
