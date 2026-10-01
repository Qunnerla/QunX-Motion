<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Logo → pieces the logo kit can move

## SVG logo (best)
1. Confirm it is the user's own logo or a client's they work for.
2. Run `node scripts/svg_pieces.js logo.svg` (needs Playwright). It writes `logo.pieces.svg`, a preview `logo.pieces.png` with numbered boxes, and a table. What it does:
   - a wordmark drawn as **one path** is split into one piece per letter; holes (o, a, e, Q…) stay with their letter, so nothing renders wrong;
   - dots and marks ride on the letter under them (i, j, Thai vowels and tone marks such as ที่); `--no-stack` keeps them separate (e.g. for a dot that should drop in last);
   - every piece is wrapped **in place** in `<g class="lp" id="partN" data-order="N">`, numbered in reading order, so gradients, clip paths and parent transforms keep working; the template flies them in in that order;
   - `--level groups` gives one piece per top-level group the designer made (icon, wordmark…) instead of per letter;
   - warns about gradients / clips that point to missing `<defs>` (they render black) and about live `<text>` (one piece; ask for outlined text).
3. **Look at the preview** (Read the PNG) and show it to the user when the grouping matters: "7 pieces: the icon, then one per letter; แ came out as two shapes, I'll move them together". Re-run with `--join 5+6` (numbers from the preview; several: `--join 5+6,1+2`) for shapes that should move as one.
4. Paste the `<svg id="logo">` into the template's logo slot in place of the placeholder. The template sizes it from its viewBox (square icons and wide wordmarks both fit) and keeps the reading order.
5. No Playwright: read the SVG yourself, give each letter / shape its own `<g class="lp">` in place (never move elements out of their transformed parent groups), keep `<defs>`.

## PNG / JPG logo → SVG pieces

1. Ask how many colours the logo has (not counting the background) and confirm it is the user's own logo or a client's they work for. Never do this with another brand's logo the user has no rights to.
2. Run `python3 scripts/vectorize.py logo.png <colours> logo.svg` (`pip install vtracer pillow numpy`). Every separate piece becomes `<g id="partN" class="lp">` — GSAP moves the `<g>`, the path inside keeps its own position.
3. Show the result to the user (render it or place it in an HTML page) and group pieces sensibly: icon / each letter / decorations. Small pieces that belong together get one wrapping `<g>`.
4. Put the SVG in the template's logo slot (`#logo`, pieces keep `class="lp"`) and use the logo kit.
5. If code can't run, ask for an SVG or for the user to convert it in a vector app. Never redraw the real logo yourself.

Tell the user:
- Flat-colour logos work best; gradients, shadows or photos come out poorly — ask for the flat version.
- The image should be at least 512 px; small or blurry images give wobbly edges.
- Text inside the logo: if the edges come out soft, retype it with the closest font instead.
