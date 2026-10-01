<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Text effects: pick a few, keep each role consistent

Choose **2–3 effects per clip**: one for headings, one for sub-lines / captions, optionally one for numbers. Keep the same effect for the same role through the clip; change it only for one special moment. Pick by style (below) and offer the choice in the storyboard when the user cares about type.

| Effect | Looks like | Build | Good for |
| --- | --- | --- | --- |
| Letter pop | letters bounce up one after another from where they sit (no mask) | `popWord(sel, at, avail)` — each letter `scale 0 → 1`, `yPercent 35 → 0`, alternating tilt ±12°, `back.out(3)`, stagger ≤ 0.035 | playful, product, pastel |
| Line pop | the whole line springs out from its start | `popLine(el, at, dur, '0% 60%')` — `scale .25 → 1`, rotate −5 → 0, `back.out(2.6)` | sub-lines under a popped heading |
| Mask rise | text rises out of a clipped line | `reveal(el, at)` — `yPercent 140 → 0` inside `overflow:hidden` (+ `autoAlpha` for Thai marks) | clean, corporate, light |
| Typewriter | characters appear with a caret | `proxy()` over `graphemes(text)` + caret blink; sound per letter | inputs, search, names |
| Scramble / decode | random glyphs settle into the word | proxy writes real letters up to `k`, random from a fixed table after `k` (decided at build time) | tech, dark |
| Focus in | text sharpens from a blur while shrinking slightly | `filter: blur(12px → 0)` + `scale 1.15 → 1` on the text only (small elements) | cinematic, reveals |
| Smear in | text flies in with a motion trail | `smearIn(el, at, fromX)` (`.fx --s`) | beat-cut, numbers |
| Glitch jam | RGB split in brand colours kicks on the beat | `.fxg` with `--ga / --gb` set to brand colours, `kickRGB()` | dark / neon, music |
| Stamp | word slams down from big | `scale 2 → 1` + rotate −8° → 0, `power4.in`, camera punch | badges, prices |
| Tracking in | letters close up from wide spacing | `letterSpacing .6em → normal` + fade | luxury, calm |
| Word swap | one word flips to the next in place | old `yPercent 0 → −100`, new `100 → 0` inside a mask | taglines, features list |
| Rolling digits | each digit column rolls to its value | columns of 0–9, `yPercent` per column, stagger | counters, prices |
| Highlighter | a marker bar sweeps behind a key word | `::before` `scaleX 0 → 1` from the left | quotes, reviews |
| Outline → fill | stroke text fills with colour | `-webkit-text-stroke` + a clipped fill copy `clip-path inset` tween | posters |

Exits mirror the entry, faster (0.2–0.25 s): pop out = `scale .5` + fade with `back.in(2)`; mask = rise out; typewriter = backspace.

Style fit: **dark** → smear, glitch jam, scramble · **light** → mask rise, line pop, word swap · **poster** → stamp, outline → fill, hard cuts · **pastel** → letter pop, focus in, highlighter.

Rules: in and out of the same text never overlap in time (shrink the entry to fit the gap); Thai text always through `graphemes()`; big words are measured after `document.fonts.ready`.

## Entrances
Text and UI never just appear or fade in: headlines pop letter by letter or word by word (`back.out`, small y + scale), chips and small UI pop with a stagger. UI that is already part of the scene (an input box waiting below a greeting) is **revealed by the camera** panning to it, not faded in.
