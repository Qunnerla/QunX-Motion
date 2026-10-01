<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Shot recipes, beat-cut mode, camera, easing, sound

## Contents
- Shot recipes (users can ask for them by name)
- Beat-cut mode
- Camera words → GSAP
- Easing words
- Sound
- Beauty and pacing rules

Transitions have their own menu (`transitions.md`), text effects too (`text-fx.md`), sound too (`sound.md`). All helpers named here (`reveal`, `popLine`, `popWord`, `smearIn`, `kickRGB`, `punch`, `press`, `proxy`, `graphemes`, `cam`, `camAt`, `scene`, `B`, `cue`, `caption`) are in `assets/template.html`.

## Shot recipes

| Recipe | Move | Time / ease | Sound |
| --- | --- | --- | --- |
| Logo assemble | logo pieces fly in from different sides (rotate / scale) one by one 0.2 s apart, then the whole logo bumps 1.08 → 1 | 0.7 s per piece `back.out(1.6)` | whoosh per piece, pop on lock, impact when complete |
| Mask reveal | wrap in `overflow:hidden`, `yPercent 140 → 0` + `autoAlpha` (Thai marks above the line leave dots at 100–110) | 0.6–0.7 s `expo.out` | swish |
| Count-up | `proxy()` a number and write it formatted, `tabular-nums`, bump 1.1 → 1 at the end | 0.8 s `power2.out` | digits then ding |
| Tick list | ticks pop `scale 0 → 1` one by one, 0.15 s apart | 0.4 s `back.out(2.2)` | tick each |
| Lower third | colour bar `scaleX 0 → 1` from the left, text rises from a mask, hold 2–3 s, retract the same way | bar 0.5 s `expo.out` | swish |
| Bar chart | bars `scaleY 0 → 1` (origin bottom) 0.08 s apart, numbers count along | 0.7 s `power3.out` | pop per bar, digits |
| Whip-pan to a piece | camera to the piece centre, zoom ≤ 1.3 | 0.6 s `expo.inOut` | whoosh |
| Zoom-through | scale the whole scene ~4–6× while fading out; only on sparse scenes | 0.5–0.7 s `power4.in` | riser 0.2 s before |
| Swipe out | pull back to see everything, pieces swipe up out of frame, middle first | 0.5 s `power3.in`, stagger 0.07 | swish |
| Button press | `press()` — squash to .9 and spring back | 0.08 + 0.3 s `back.out(3)` | click |
| Smear + RGB split | class `.fx`, tween `--s` (trail) and `--r` (red/cyan split) from high to 0 with `x`; never `filter: blur` | 0.5–0.9 s `expo.out` | whoosh |
| RGB kick on the beat | `kickRGB(el, B(n))` on accented beats | 0.3 s | (drum) |
| Colour-bar wipe | 5–6 horizontal bars `scaleX 0 → 1` from the left one after another, then shrink out to the right; cut while fully covered (call 0.35 s before the cut) | 0.22 + 0.24 s | whoosh |
| Dashed gauge | SVG, 48 ticks on a 270° arc, colour them one by one up to the %, number counts in the middle, whole ring rotates slowly; last lit tick in the second accent | 0.055 s per tick | tick every 3, ding |
| Solid arc gauge | 270° arc drawn as ~140 short pieces so the colour ramps along it (dark → brand colour at 100 %), round caps at start and head, money counts with the arc | 1–1.5 s `power1.inOut` | rising ticks on the scale |
| Tilted-plane ride | gauge / chart on a plane `perspective() rotateX(55–62°) rotateZ(−30°)`; one proxy lights it, counts the numbers, projects the head point to screen and moves the camera to follow it (numbers half in frame), then untilts to face the camera, centred, at the end | whole shot `none` | soft whoosh |
| Check morph | “100 %” squashes to a sliver while a ✓ path draws in its place with a small spin | 0.2 + 0.3 s | one success sound only |
| Bar race + 3D tilt | bars `scaleX 0 → %` on beats, the board `rotationX 28 → 0` + `transformPerspective` | 0.7 s `expo.out` | swish, pop |
| Search + highlight | search bar with a counter (1/6 → 3/6), a text card floats up, a highlighter `::before` `scaleX 0 → 1` over the key word | 0.35 s | click, swish |
| Halftone dots | SVG dot grid, dot size grows toward a corner, pop `scale 0 → 1` from that corner | stagger 0.004 s | — |
| Wireframe globe | SVG circle + ellipse meridians/parallels, "rotate" by tweening meridian `attr:{rx}` (never negative) | whole shot `none` | — |
| Brand-name sweep | text wider than the frame runs right → left with `--s` held, colour switch midway | 2 s `none` | whoosh |
| Number build + unit pun | first digits appear (`฿1`) → camera zooms to the last digit (≤ 1.9×) → `,000` groups drop in one by one, camera pans along → pull back to the full number → zeros fall away (random spin + fade) → the first digits slide over **at the same size** and the unit word (MILLION / K / ×) slams in beside them, **one line, same size** (never put the unit under the number: it reads as a different rank) → zoom through the O | a beat per step, fall 0.4 s `power3.in` stagger 0.03 | whoosh, impact on drops, ding when complete |
| Pill frame | rounded frame as an SVG path that **loads** from beside the label clockwise (gradient stroke + bright head), with a gap where the brand label sits (no background box); big word / number inside, ≤ 80 % of the frame width; one-word tagline under it | draw 1 s `power2.inOut` | riser, soft type sounds |
| Streaks | 4–14 coloured bars run across the cut; optional heavy horizontal box blur (`transitions.md`) | 0.45–0.6 s, stagger 0.03 | whoosh |
| Flash hand-off | full-frame radial layer in pink / brand colour `autoAlpha 0 → 1` before the cut, fades after it; never scale this layer (square edges show) | in 0.2 `power2.out`, out 0.35 | whoosh |
| Typing | `proxy()` from 0 to the number of characters, write `graphemes(text).slice(0, round(v))`, blinking caret; Thai must be split with `Intl.Segmenter` (the `graphemes` helper) | 0.05–0.1 s per character `none` | `key` per letter at `(k + 0.5) · dur / n` |
| Colour swatch pick | a ring hops swatch to swatch (`x +=` spacing, `back.out(1.6)`), the picked swatch bumps 1.15, the card colour changes on the same frame as the hop (real colours from the app code) | 0.2 s apart | poke each |
| Custom colour | a dashed “+” after the preset swatches opens a hue-ring picker; the knob sweeps the ring, the card follows live (the app's own colour rule), overshoots and settles; the new swatch takes a seat before the “+” | 0.9 s drag `power2.inOut` + `back.out` settle | poke, soft ticks while dragging |
| Fan / fold | 2 items fan out behind the hero from a hinge inside its edge (slightly smaller, so no edge shows past the hero), then fold shut before the next cut | 0.45 s `back.out(1.6)` / 0.24 s `power2.in` | soft whoosh, poke on close |
| + button → new item | round button pops in next to the heading → squashes on press → shrinks away → the new card pops in where it will be used (e.g. in front of the wallet) | 0.55 s `back.out(1.6)` | softpop, click, cardpop |
| Stamp | badge `scale 2 → 1` + rotate -8° onto a ticket / card, camera punch | 0.25 s `power4.in` | impact |

## Beat-cut mode

Use it for template 1, or when the user sends a fast number-promo reference.
- Every cut lands on a beat: `B(n)` converts beats to seconds (`CONFIG.bpm`, 120 if unknown). Shots last 2–8 beats; things enter on beats; RGB / scale hits on accented beats.
- One scene at a time with `scene(id, in, out)`; hidden scenes save phone memory.
- Change scenes with a colour-bar wipe, streaks, a flash or a hard cut on the beat; alternate dark / light every 1–2 scenes.
- No song: `window.USE_BEAT = true` adds a synthesized drum (kick every beat, hat on the off-beat, clap on 2 and 4).
- With the user's song: run `scripts/beats.js` and set `music`, `songStart`, `beats`, `bars` (`sound.md` › The user's song). `B(n)` then lands on the song's real beats and `BAR(n)` on its bar lines; the song becomes the master clock (the player pulls the timeline back when it drifts > 0.08 s) and the synthesized drum stays off.

```css
#wipe{position:absolute;inset:0;z-index:20;pointer-events:none;display:flex;flex-direction:column}
#wipe i{flex:1;transform:scaleX(0);transform-origin:0 50%}
```
```js
function wipe(at){                                                   // call 0.35 s before the cut
  tl.fromTo('#wipe i', {scaleX:0, transformOrigin:'0% 50%'}, {scaleX:1, duration:0.22, ease:'power3.in', stagger:0.025}, at);
  tl.set('#wipe i', {transformOrigin:'100% 50%'}, at + 0.36);
  tl.to('#wipe i', {scaleX:0, duration:0.24, ease:'power3.out', stagger:0.025}, at + 0.36);
  cue(at, 'whoosh', 0.45);
}
```

## Camera words → GSAP
- **Camera** = a `.world` box around the scene; move / zoom the box, never the pieces one by one. `cam(cx, cy, s)` puts a world point at the frame centre; `camAt(cx, cy, s, sx, sy)` puts it at any screen point.
- **Pan:** tween the world's `x`/`y`, `power3.inOut`, 0.8–1.2 s.
- **Whip-pan:** `expo.inOut`, 0.5–0.7 s + whoosh.
- **Pull back / slow push:** tween `scale`; slow push = `sine.inOut` over the whole shot, ≤ 5 %.
- **Punch zoom:** wrap the world once more and scale 1 → 1.14 in 0.22 s and back (or `punch()`).
- **Tilt:** tween the world's `y` down a long list (the main move in portrait clips).
- **Cut:** `tl.set(scene, {autoAlpha:0})` at that moment.
- **Stagger:** 0.05–0.2 s.
- **Overshoot:** long labels bounce only 2–5 %, grow from the left edge (`transformOrigin:'0% 50%'`).
- Round camera timings to half seconds (or beats): easier to read and to change.
- **Full camera language** (shot sizes, angles, dolly / truck / crane / orbit, dolly zoom, crash zoom, rack focus, handheld idle / walk / run, one-take path): `camera.md`.

## Easing words (use what the user says)

| User says | ease |
| --- | --- |
| soft / smooth | `power3.out` |
| snap and brake / fast and hard | `expo.out` (in), `expo.inOut` (camera) |
| slight bounce | `back.out(1.3)` |
| bouncy / pop | `back.out(1.7)` – `back.out(2.2)` |
| rubbery / elastic | `elastic.out(1, 0.5)` |
| slow push / float | `sine.inOut` |
| sucked in | `power4.in` |

## Sound
One timbre per kind of action, a music bed, sync and tuning: see `sound.md`. Sound plays only while playing forward, never while scrubbing, and only after the first tap / Play (`ensureAudio()`); `render.js` renders the same cues offline.

## Beauty and pacing
- **Colour:** background + text + one accent (+ one secondary) from the brand, via `CONFIG.brand` (`references/styles.md` › Brand colours).
- **Consistency:** same corner radius, shadow, spacing and icon size everywhere.
- **Background:** never flat-dead: faint gradient, faint dots or big slow shapes (no blur).
- **Pacing:** short copy holds ≥ 1.5 s; at most 2 groups moving at once; fast in, soft out; fast parts alternate with still parts.
- **Zones:** decide zones before placing (e.g. left = pieces, right = copy, top = controls); zones never overlap.
- **Subtitles:** `caption(t, end, text)` for lines the viewer must read; many people watch muted. They are burned in (toggle CC) and exported as `.srt`. Writing subtitles that explain the motion: `export.md` › Subtitles.
