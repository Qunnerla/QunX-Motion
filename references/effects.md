<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Effects: motion principles, particles, shapes, type, light, devices

Template section 6c. Everything here is drawn from the clip time (seeded, no `Math.random`), so scrubbing backwards, `check.js` and `render.js` all see the same frame. Use a few per clip, the ones that serve the story — never all of them.

## Contents
- The principles of motion
- Particles
- Shapes and backgrounds
- Type effects
- Light and colour
- Devices, cursor, taps
- Characters: cut-out puppets (and what is not possible)
- Cost on phones

## The principles of motion

The 12 principles of animation, the ones that apply to motion graphics. Core rule 12 in SKILL.md: every hero element uses at least anticipation or overshoot, soft things squash, travelling things arc.

| Principle | Call | Use on |
| --- | --- | --- |
| Anticipation | `anticipate(el, at, {dir:'up' / 'down' / 'left' / 'right', amt, dur})` — a small move back just **before** the main move starting at `at` | buttons, characters, anything about to leap |
| Squash & stretch | `squash(el, at, {amt, origin})` on landing | balls, blobs, pills, soft logos — **not** text blocks or UI cards |
| Jump (all together) | `jump(el, at, {h, dx, dur, amt})`: squash → stretch → arc → squash on landing → settle; chained jumps start where the last one landed | mascots, icons, a ball that bounces through a sentence |
| Arcs | `arcMove(el, at, dur, [x0, y0], [x1, y1], {bend, rotate, ease})` | anything travelling across the frame (straight lines look mechanical) |
| Follow-through | `followThrough(parts, at, {deg, origin})`: loose parts keep going, then swing back | flags, hair, cables, tags, labels hanging off a card |
| Secondary action | `secondary(el, from, to, {kind, amt, hz})`, kind `bob · float · sway · breathe · blink` | idle life on a mascot or icon while the main thing happens elsewhere |
| Slow in / out | the look's eases (`LOOK.enter`, `LOOK.move`) | everything — linear only for loops and camera paths |
| Overshoot | `back.out`, `elastic.out` | pops and landings; long labels 2–5 % only |
| Staging | camera.md (shot sizes, one strong idea per shot) | every shot |
| Timing | holds after big moves 0.4–0.8 s; pops 0.2–0.35 s | every shot |

`secondary` and `puppet` use the CSS `translate / rotate / scale` properties, which add on top of GSAP's transform, so they never fight a tween on the same element.

## Particles

`particles(parent, at, {kind, x, y, n, dur, speed, spread, colors, res, z, seed})` — a canvas layer drawn from the clip time. `x, y` are 0–1 of the frame. `colors` may use `var(--accent)`.

| kind | Looks like | Default sound |
| --- | --- | --- |
| `burst` | dots fly out of a point, shrink | pop |
| `confetti` | paper strips shoot up, flutter, fall | shimmer |
| `sparkle` | little 4-point stars twinkle | softding |
| `dust` | slow floating specks over the whole shot (atmosphere) | — |
| `debris` | shards fly and fall hard (a thing breaks) | impact |
| `rise` | embers / bubbles float up | — |

Use one burst on the main hit, confetti only at the payoff (a win, a launch, the CTA). `res` 0.5 (default) is half resolution — enough, and cheap.

## Shapes and backgrounds

- `blob(parent, {x, y, r, color, wobble, speed, seed})` — a liquid shape that keeps morphing. Returns `b`: tween `b.r` (size 0 → 1) and `b.wobble` (0 calm … 0.3 wild). For "fluid" brands, backgrounds, a morphing CTA.
- `patternBg(parent, {kind, color, size, speed:[vx, vy]})` — a drifting pattern: `dots · grid · stripes · diagonal · checker`. Subtle (alpha .06–.12) behind type; it makes a flat colour feel alive.
- Shape morphs (a circle into a square, an icon into another) are still plain tweens: `borderRadius`, `clip-path` polygons with the same number of points, SVG path `d` with the same commands.

## Type effects

Also see `text-fx.md` (split, scramble, typewriter, count-up).
- `textOnPath(parent, text, d, {size, weight, color, track, start})` — text rides along an SVG path `d` (in frame px). Returns `{svg, run(at, dur, fromPct, toPct, ease)}`. For waves, circles around a logo, a line that follows a road.
- `extrude(el, {depth, color, dx, k})` — thick 3D letters from stacked shadows; turn the element with `rotationX / rotationY` to show the depth.
- `glow(el, at, {color, size, dur, hold})` — neon / halo glow that blooms in (and fades after `hold`).
- Track matte (a scene inside a word): `trans.textMatte` in transitions.md.

## Light and colour

- `lightShadow(els, from, to, light, {k, alpha})` — every element casts a soft shadow away from `light` `{x, y}` (frame px). Tween `light` and the shadows swing like the sun moving.
- `vignette(from, to, {amt, inner})` — darker edges pull the eye to the centre. 0.3–0.5.
- `grade(kind, from, to, {amt})` — a colour grade over the whole frame with blend layers (cheap, no filters): `warm · cool · tealorange · film · mono · punch`. One grade per clip or per act; it glues a clip together.
- `rgbSplit(el, from, to, px)` — chromatic aberration on an element for a short hit (skipped on Safari, where SVG filters on HTML are slow).
- `grain(from, to, opacity)` — film grain (transitions.md overlays).
- Keep text readable: `qa.js` measures the letters as they are drawn after the grade and glow, and flags text that fades into its background.

- **A logo's glow is the logo**: blurred copies of the mark's own shape (an SVG `feGaussianBlur` group behind it, opacity tweened), never a separate round disc — a disc floats off the logo and looks like a blob in dark frames. Keep it faint in dark shots, bright only for a flash.
- **Particles and background are one system**: when particles burst, let them land as the background's dot grid (same canvas) instead of fading on a separate layer that floats over it. An acknowledgement (a file dropped, a task done) can ripple a ring of light through those background dots from behind the object.

## Devices, cursor, taps

- `device(parent, 'phone' | 'tablet' | 'laptop', {x, y, w, color, screen})` → `{el, screen}`. Build the UI inside `screen` (or put a real-UI iframe in it, `real-ui.md`).
- `cursor(parent, {x, y, size, finger, show})` → `c`. `finger:true` is a touch dot for phone UIs.
- `cursorTo(c, at, dur, x, y, {bend, ease})` — moves on a slight arc (x, y 0–1 of the frame); chained moves start from the last target. Use `boxIn(button, root)` to aim at a real element.
- `cursorClick(c, at, {color})` — press + ring + click sound. Also press the button itself (`scale .92 → 1`) at the same moment.

## Characters: cut-out puppets (and what is not possible)

`puppet(parts, from, to, {amt, hz})` swings each part on its pivot (`data-pivot="50% 100%"`, `data-swing="2"` for a stronger part): ears, tail, arms, antennae. Add `secondary(body, …, {kind:'breathe'})` and `{kind:'blink'}` on the eyes, and `jump` / `arcMove` for travel. That is the character level this skill can do well: a mascot or icon with life.

Not possible here: frame-by-frame character animation, rigged walk cycles with bending limbs, lip-sync to a voice, 3D models. Say so on card 1 and offer the cut-out puppet (or the user's own video with `footage()`).

## Cost on phones

| Effect | Cost | Keep it |
| --- | --- | --- |
| principles, secondary, puppet, cursor, device | tiny | anywhere |
| grade, vignette, patternBg | small | whole clip is fine |
| particles | medium | ≤ 2 at once, `res` 0.5 |
| blob | medium (clip-path each frame) | ≤ 2 blobs |
| glow, lightShadow | medium (filters) | a few elements |
| rgbSplit, blur, ghosts | high | short hits only, not together with a blur transition |

If the phone pass of `qa.js` reports under 30 fps, remove the high-cost effects first, then offer 30 fps.
