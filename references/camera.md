<!-- © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A -->
# Camera language: shot sizes, angles, moves, handheld

A motion clip has a camera even when nothing is filmed. Pick a shot size, an angle and a move for **every** shot in the storyboard (the "Camera" column: `CU · low angle · dolly in · handheld walk`). The helpers live in template section 6b; the world camera `cam()` / `camAt()` from section 4 still works for one flat world.

## Contents
- The rig
- Shot sizes
- Angles
- Moves
- Handheld camera
- One-take camera path
- Grammar: how shots follow each other
- Styles borrowed from film and motion schools
- Performance

## The rig

```js
const S3 = mkScene('s3', '#faf7fc'), R3 = rig(S3);   // R3.hand › R3.tilt › R3.dolly, outside → inside
```
Content goes in `R3.dolly`. Each layer has one job and nothing else may tween it:
- `hand` — handheld shake only (`handheld`, `shake`).
- `tilt` — angle, roll, orbit, human whip-pan (`angle`, `roll`, `orbit`, `crane`, `handPan`).
- `dolly` — zoom and framing (`frameOn`, `crashZoom`, `snapZoom`, `camPath`, or plain tweens).

For parallax, put layers in `R.dolly` with `data-depth`: 0 = far background, 1 = the subject plane, 1.3–1.6 = foreground. `camMove` / `dolly` / `truck` / `pedestal` move every layer by its depth.

## Shot sizes

`SHOT` = how tall the subject is compared with the frame. `frameOn(world, subject, size, {at})` returns `{x, y, scale}` for the world, so tween the world to it:

```js
tl.to(R.dolly, {...frameOn(R.dolly, '#price', 'CU', {at:'right'}), duration:0.8, ease:'power3.inOut'}, t);
```

| Size | `SHOT` | Use it for |
| --- | --- | --- |
| EWS extreme wide | .14 | where are we: the whole UI, the whole city |
| WS wide | .34 | the product in its world, the list of features |
| FS full | .6 | one full object (the phone, the card) |
| MS medium | .62 | the object plus its label |
| MCU medium close | .8 | one card, one row |
| CU close-up | 1.02 | one number, one button, one word |
| ECU extreme close | 2.1 | a digit, an icon, a letter, a detail nobody noticed |

`at` places the subject on a third: `center · left · right · top · bottom · top-left · top-right · bottom-left · bottom-right` (or `[fx, fy]`). The rule of thirds belongs to calm shots; the big punch word stays centred.

## Angles

`angle(R.tilt, kind, at, dur)` or `gsap.set(R.tilt, ANGLE.low)` to start the shot in it.

| Angle | Feels | For |
| --- | --- | --- |
| `eye` | neutral, honest | explaining, UI |
| `low` | strong, heroic | the product reveal, a big number |
| `high` | small, overview | "too many tabs", the problem shot |
| `bird` | a map, a plan | layouts, dashboards, a board of cards |
| `worm` | towering | the launch, the logo slam |
| `dutch` / `dutchR` | tension, energy, chaos | the problem, the drop, a meme beat |

Moving from one angle to another is a move too: `low → eye` settles, `eye → dutch` adds tension.

## Moves

| Move | Call | Feels |
| --- | --- | --- |
| Dolly in / out | `dolly(root, at, dur, +0.25 / -0.25)` | in: focus, importance · out: reveal the context |
| Truck (slide sideways) | `truck(root, at, dur, dx)` | following, a row of features |
| Pedestal (up / down) | `pedestal(root, at, dur, dy)` | reading down a page |
| Crane | `crane(root, R.tilt, at, dur, dy)` | rising over a scene, the ending |
| Orbit | `orbit(R.tilt, at, dur, deg)` + `data-z` on children | 3D depth, a product turn |
| Roll | `roll(R.tilt, at, dur, deg)` | unease, playfulness |
| Dolly zoom (vertigo) | `dollyZoom(bg, at, dur, k)` | a realisation, "wait…" |
| Crash zoom | `crashZoom(R.dolly, at, {to, hand:R.hand})` | the punch, a meme hit (adds blur + a jolt) |
| Snap zoom | `snapZoom(el, at, 1.35)` | a quick look at a detail |
| Rack focus | `rackFocus(fromEl, toEl, at, dur)` | move the viewer's eye between two planes |
| Whip-pan | `handPan(R.tilt, at, dur, dx, dy)` (human) or a `expo.inOut` world tween (clean) | jumping to the next piece |
| Motion blur | `ghosts(el, from, to, {kind:'zoom' / 'spin' / 'dir', angle})` (angle in radians), tween `g.v` 0 → 1 → 0 | fast moves that should smear |

Every move needs a reason (a new piece to show, a feeling to change). A clip where every shot moves the same way at the same speed feels like a screensaver: mix holds, slow drifts and one or two violent moves.

**"Tilt the camera" means the camera**: tween the rig's `tilt` layer (`rotationX` / `rotationY`, no roll) so the angle turns *toward* what the shot looks at, changing as the subject changes, and give the frame something that tilts with it — a faint dot floor or grid on the `tilt` layer behind the content. A static skew of the objects alone reads as "the objects are crooked". Return to a straight angle at the moment of an action (sending, choosing), then keep zooming object to object.

## Handheld camera

`handheld(R.hand, from, to, {mode, amp})` — natural shake from a person holding the camera; it fades in and out over `ramp` (0.35 s).

| mode | What the person does | Feel |
| --- | --- | --- |
| `idle` | just holding it: slow breathing drift, tiny jitter | documentary, "real", vlog |
| `walk` | walking: step bob, sway, a little roll on each step | following, a tour |
| `run` | running to the subject: hard bob, big jitter | urgency, the chase before a reveal |

`amp`: 0.5 soft · 1 medium · 1.8 strong. Pair `run` with a `dolly` in to feel like running up to the subject.
- `shake(R.hand, at, {amp, dur})` — a jolt that dies out (a landing, an impact, a drop); adds a thump.
- `handPan(R.tilt, at, dur, dx, dy)` — a person swinging the camera to a new subject: speeds up, overshoots, settles; the shake follows the speed.
- Pure function of time (seeded noise): scrubbing and render give the same shake. Handheld on a clean, precise UI explainer is wrong — use it for vlog, documentary, UGC, meme and "real life" looks.

## One-take camera path

`camPath(world, at, dur, [[x, y, scale], …])` — the camera glides through several framed points without a cut (a smooth curve through the centres, zoom interpolated in log scale). Build one big world (2–3× the frame), place the stations, then fly. Great for "Plan → Build → Ship" stories. Add `handheld(R.hand, …, {mode:'walk', amp:0.5})` for a Steadicam feel.

## Grammar: how shots follow each other

- **Wide → medium → close**: show where we are before the detail. Reverse it (close → wide) for a reveal ("this number… is your whole month").
- **Motivated moves**: the camera moves because something moves or matters. A tap pulls the camera in; a list pulls it sideways.
- **Screen direction**: if things travel left → right, keep it that way across cuts (the 180° rule). Flip it only to say "going back" or "the other side".
- **Eyeline / arrow line**: what a character looks at, or an arrow points to, is where the next shot goes.
- **Hold after a big move** 0.4–0.8 s so the eye lands before the next thing starts.
- **Contrast of scale**: an ECU right after a WS feels like a punch. Two MS shots in a row feel like nothing happened.
- **One strong camera idea per shot**: a dolly and an angle change together is fine; a dolly, orbit, roll and shake together is noise.

## Styles borrowed from film and motion schools

| School | Camera | Pair with |
| --- | --- | --- |
| Apple / product film | slow dolly in, low angle, rack focus, no shake | clean looks, dissolve, shape mask |
| Kinetic typography | a near-still frame (slow push ≤ 3 %), snap zooms, whip-pans between words | carry-over cuts, text matte |
| Documentary / UGC | handheld idle + walk, zoom by hand (snap), off-centre framing | light leak, film grain, hard cuts |
| Anime / meme | crash zoom, dutch angle, speed lines, shake on hits | zoom blur, flash, glitch |
| Music video / hype | cut on beats, spin blur, dolly zoom, strobe flash | glitch, film burn, beat-cut |
| Wes Anderson / editorial | centred symmetric frames, truck and pedestal only, no zoom | panels, flip, page curl |
| Explainer | eye level, WS → CU with frameOn, one-take camPath | ink wipe, shape mask |

## Performance

- The rig layers are `will-change: transform`: moving them never repaints the content.
- `ghosts` makes live copies: keep n ≤ 6, not on huge worlds (a 3×2 world with ghosts crawls on phones).
- `rackFocus` and blurred layers: small elements only; blur on a full frame costs a lot.
- A camPath world bigger than 3×3 frames or a `patternBg` on it: test at 30 fps on the phone pass of `qa.js`.
