<!-- © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A -->
# Looks and brand colours

## Contents
- Look vs brand colours
- The 4 looks
- Pick a look from the project
- Brand colours: website → code → logo → preset
- Show the colours first
- Typography · Safe edges

## Look vs brand colours

A clip's style has two separate parts:

| Part | Decides | Comes from | In the clip |
| --- | --- | --- | --- |
| **Look** | shapes (corner radius), type weight and tracking, motion feel (eases for pops, entrances, camera moves, exits), background rhythm, which transitions and text effects fit | the look picked on card 2 (SKILL.md step 1) | `CONFIG.style = 'pastel'` → `LOOK` |
| **Brand colours + font** | background, text, accent, accent 2, card, lines, font | **the project, whenever it has them** (website, app code, logo) | `CONFIG.brand = {…}` from `brand.json › looks.<look>` |

The 6 templates decide **what happens**; the look decides **how it moves and feels**; the brand decides **its colours**. Any template × any look × any brand (e.g. Booking × Pastel × the app's orange). Only when no brand colours can be found does a look use its own preset colours. `?style=light` previews another look on a finished clip; `?brand=off` shows the look's own colours.

## The 4 looks

| Look | Shapes + type | Motion feel (`LOOK.*`) | Preset colours (bg / fg / accent / accent2) — only without a brand | Good for |
| --- | --- | --- | --- | --- |
| `dark` — cinematic | radius 6 %, 900, tight tracking | pop `back.out(1.6)`, enter `back.out(1.3)`, move `expo.inOut`, out `power3.in`; smear + RGB split, flashes, fast cuts | #0b0b0c / #f2f5f2 / #58f38e / #ff3d7f | launches, fintech, tech, data promos, portfolios / showreels |
| `light` — editorial | radius 5 %, 800, generous spacing | pop `back.out(1.3)`, enter `power3.out`, move `power3.inOut`, out `power2.in`; clean masks, highlight bars, calm pans | #f4f5f2 / #111214 / #1f5eff / #ff4d2e | SaaS, services, clinics, B2B, back-office |
| `poster` — colour block | square corners, 900, huge words | pop `back.out(1.2)`, enter `power4.out`, move `power4.inOut`, out `power4.in`; hard cuts on the beat, colour-bar wipes, stamps | #ff4d2e / #111214 / #fff2d6 / #1f3cff (cards dark with light text) | food, events, sales, youth brands |
| `pastel` — playful | radius 12 %, 800, rounded shapes | pop `back.out(2.4)`, enter `back.out(2)`, move `sine.inOut`, out `back.in(1.6)`; pops, wobble, bouncy stamps | #fdf1f5 / #2b2233 / #7c5cff / #ff8fb1 | pets, kids, cafés, beauty, lifestyle, booking for small shops |

Use `LOOK.pop / LOOK.enter / LOOK.move / LOOK.out` in shot code instead of writing eases by hand, so the look carries through every shot. Rules for every look: 1 background + 1 text colour + 1 accent (+ 1 secondary). The accent is only for what the viewer must look at (prices, buttons, ticks). Change a theme by changing the real colours of the background and every piece — never a colour overlay on top.

## Pick a look from the project

Rank the looks in step 0 (after reading the project) so card 2's slot 1 is the best fit, with a one-line reason about *this* project.

| The project is… | Slot 1 (Recommended) | Next |
| --- | --- | --- |
| pets, kids, cafés, bakeries, beauty, a small shop's booking | pastel | light, poster |
| SaaS, clinics, services, B2B, back-office, dashboards | light | dark, pastel |
| fintech, tech, launches, games, data, portfolio / showreel | dark | poster, light |
| food, events, concerts, sales, youth brands | poster | dark, pastel |
| its own site is clearly dark or clearly light | the look with the same background (dark / light) | the others |

If the brand's own background clashes with the look (a dark-mode app picked as pastel), `brand.js` refits the brand colours to the look (next section) — never force a look's background onto real UI pieces that would then disappear.

## Brand colours: website → code → logo → preset

```
node scripts/brand.js https://the-users-site.com --code <project folder> --logo logo.svg --out brand.json
```
Give it whatever the project has; each source fills what the earlier one didn't find, in this order:
1. **Website** (needs Playwright) — what is actually on screen: largest backgrounds, most-used text colour, button / link / badge colours, CSS variables, fonts, logo candidates.
2. **App code** (`--code`, no browser needed) — CSS variables (`--primary`, `--background`, … light and `.dark` / `prefers-color-scheme` values, HSL tokens like `262 83% 58%` included), tailwind `colors` / `fontFamily`, theme / token / palette files, `next/font` and `@fontsource` imports, Google Fonts links, then plain colour usage. Skips `node_modules`, `dist`, `build`, `.git` and big files. `--primary-foreground`-style names are read as "text on the accent", not as the text colour.
3. **SVG logo** (`--logo`) — fills, strokes and gradient stops: the main saturated colour becomes the accent, a second different hue accent 2, a near-black the text colour.
4. **Nothing found** → the look's preset colours; say so on the strip and ask for the brand colour.

It writes `brand.json`:
- `looks.dark / light / poster / pastel` — the brand fitted to each look, ready for `CONFIG.brand` (copy the one picked on card 2): `{bg, fg, muted, accent, accent2, card, cardfg, line, font}`. Dark = the brand's dark-mode background or a near-black tinted with the accent; light = the brand's light background; pastel = a pale tint of the accent; poster = the accent as the background.
- `contrast` — WCAG ratios for every pair and what was **adjusted** (text ≥ 4.5 : 1, accent ≥ 3 : 1 on the background and on cards, accent 2 ≥ 2 : 1). An adjusted colour is moved toward black or white only as far as needed.
- `sources` — where each colour came from (file + variable), `brand` — the raw colours, `fonts`, `googleFonts` (copy the links into the clip), `site.logos` / `icons`, `warnings`.
- `style` — kept for older clips (`CONFIG.style = {…}` still works).
- a **colour strip**: `brand-swatch.svg` always, `brand-swatch.png` when Playwright is there; `--look pastel` shows only that look.

Only for the user's own project or a client's they have rights to. A website that can't be opened stops the script (exit 3) unless `--code` / `--logo` were given too; then it carries on with those and says so.

## Show the colours first

Once, after card 2 and before the storyboard (it can share the message with card 3), show the strip for the chosen look — the PNG, or the SVG, or a small table of hex values if neither can be shown — and ask one question: `Use these (Recommended)` · `Use the original colours` (only when something was adjusted) · `I'll send the right colours`. Point out in one line anything that was adjusted ("the orange was darkened a little so prices stay readable on cream") and anything that looks like a promo colour rather than the brand (sites often have a sale red). The font: say which one and whether the clip can load it (a Google Fonts link or `@fontsource`); otherwise the fallback.

Then set `CONFIG.style = '<look>'` and `CONFIG.brand = <brand.json › looks.<look>>`, add the font link to the clip's `<head>`, and don't change colours again without asking. An inline SVG logo can go straight into the logo kit; an image logo goes through `references/logo.md`.

## Edge light
Orange (brand) light at the frame's edges is a **soft glow at one or two corners or edges that changes with the shot** (top-left in one scene, bottom-right in the next), sized from `M` so it is equally soft on every side — never a line or a full border around the frame. Bright scenes stay clean white; the glow belongs mostly to dark scenes and stays thin.

## Typography
- One family for the clip (+ the Thai/fallback family): headings 800–900, body 500–600.
- Thai: Noto Sans Thai (in the template), IBM Plex Sans Thai or Prompt. Number- or English-heavy clips (templates 1, 5): `'Inter Tight','Noto Sans Thai'`.
- Sizes from the short side `M`: headings ≥ `M*0.09`, body ≥ `M*0.035`.
- Measure big text after `document.fonts.ready` and shrink it to fit the frame.

## Safe edges
- Keep key items at least `M*0.11` from the frame edge; more at top and bottom for vertical video.
- Vertical clips for social: preview the platform UI with the player's **Safe zone** menu (or `?safe=tiktok|reels|shorts|all`, key Z). Approximate zones for 1080×1920: TikTok top 108 / bottom 320 / left 60 / right 120 px, Reels top 210 / bottom 310 / right 84, Shorts top 120 / bottom 300 / right 96; "all" uses the largest of each. Platforms change their UI — tell the user to double-check before posting. The overlay never appears in `render.js` output.
