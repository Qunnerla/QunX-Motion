<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Templates, logo kit and the universal structure

## Contents
- Pick a template from the project
- Picker labels (neutral words for the cards)
- How much of the template to use (exact / structure / feel)
- The 6 templates (shot structure · rules · signature gag)
- Logo kit (used by every template)
- Universal structure (fallback A)

## Pick a template from the project

Use this in workflow step 0 to order page 1 of the picker (slot 1 = recommended).

| Found in the project | Recommend | Next |
| --- | --- | --- |
| calendar, time slots, queue, rooms, check-in, booking | 3 Booking | 2, 1 |
| menu, cart, orders, tables, QR ordering, delivery fee | 4 Menu & order | 5, 2 |
| products, prices, discounts, customer-side stock, points, coupons | 5 Shop | 4, 1 |
| tables, reports, charts, shop-side stock, bills, tenants, members | 6 Back-office | 2, 1 |
| a standout number (revenue, users, %), a pricing page, a launch | 1 Data beat-cut | 2, 5 |
| a general utility app (notes, money, to-do) or nothing matches | 2 Feature tour | 1 + nearest |

| # | Template | For | Length (recommended) |
| --- | --- | --- | --- |
| 1 | Data beat-cut | launches, milestones, stats, promotions, announcements | 15–25 s (24) |
| 2 | Feature tour (camera glide) | general app / site intro, how-to, plans & pricing | 20–40 s (30) |
| 3 | Booking | salons, spas, clinics, hotels, pet hotels, courts, table booking | 15–30 s (20) |
| 4 | Menu & order & pay | restaurants, cafés, QR ordering, LINE OA shops, delivery | 15–30 s (20) |
| 5 | Shop / products | online shops, catalogues, flash sales, loyalty points | 15–30 s (20) |
| 6 | Back-office | POS, stock, dormitories, membership, school systems, dashboards | 20–40 s (30) |

## Picker labels

Card 1 (SKILL.md step 1) uses these words, translated into the user's language. They name *kinds of work*, never a product, brand or detail from another project, chat or memory ("Booking — queues, rooms, appointments", not "cat hotel booking"). Only the slot-1 reason mentions what was found in *this* project, e.g. `Booking (Recommended) — your site has a room calendar and time slots`.

| # | Label | Nothing given: kind of app |
| --- | --- | --- |
| 1 | Data beat-cut — numbers, launches, announcements | Launch / big numbers / promotion |
| 2 | Feature tour — app or website intro, how-to, pricing | General app or website |
| 3 | Booking — queues, rooms, appointments | Booking / appointments / rooms |
| 4 | Menu & order — menus, ordering, delivery | Food & drink ordering |
| 5 | Shop — products, prices, sales, points | Online shop / products |
| 6 | Back-office — stock, reports, members, bills | Back-office / management system |

Every template carries built-in rules (pacing / backgrounds / transitions / camera / type) that stand in for a reference. If the user has a reference, the reference wins.

## How much of the template to use

Asked on card 3 (SKILL.md step 1), once the template is picked (the same question works for a starter clip, "like 03 peak cut", and for the user's own reference clip). Recommended first:

| Option | Keeps | Picked fresh |
| --- | --- | --- |
| **Structure** (Recommended: every clip from the same template still looks different) | shot order, shot lengths, pacing and background rules | moves, transitions and text effects from the menus, a new signature gag |
| **Exact** | everything written for the template: shots, timing, transitions, text effects, signature gag | only brand, copy, data and colours |
| **Feel only** | mood, pace, energy curve, dark/light rhythm, colour logic | a new shot order (start from the universal structure), new moves and gag |

- Write the choice at the top of the storyboard ("Template 3 Booking · structure") and keep to it; swapping a move inside *Exact* is a question for the user, not a silent change.
- A reference clip is never copied past its moves and pacing, whatever the option: no logo, name, data or artwork from it.

## 1 · Data beat-cut
- **Shots:** opening number (recipe *number build + unit pun*) → pill frame + logo → 2–3 feature shots, one number or piece each (dashed gauge, bar race, search + highlight) → brand-name sweep → logo.
- **Rules:** beat-cut mode (`references/recipes.md`) at 120 BPM, shots of 2–8 beats, dark/light alternate every shot, transitions = smear + RGB split / flash / streaks, hero numbers ≥ `M*0.17`, one accent colour + a second (pink) only for hits on cuts. Set `window.USE_BEAT = true` for the synthesized drum, or cut on the user's song (`sound.md` › The user's song).
- **Signature gag:** digits drop in and assemble, then the zeros collapse into a unit word (MILLION / K / ×) at the same size on one line.
- Worked example: `assets/starters/04-real-ui-wallet.html` (16:9, 120 BPM, 26 s = 52 beats).

## 2 · Feature tour (camera glide)
- **Shots:** logo → overview of all pieces (middle one first) → one block per feature, 3–6 s (whip-pan in → main move → hold to read) → pull back, pieces swipe out → logo.
- **Rules:** continuous camera, few cuts, whip-pan `expo.inOut` 0.6 s, holds 1.5–2 s, one background for the whole clip with a soft glow in the piece's colour, copy beside the piece (landscape) or above/below (portrait).
- **Signature gag:** real UI pieces move through their real states (open/close, pull out, eye-reveal).

## 3 · Booking
- **Shots:** logo → month calendar pops cell by cell → cursor ring picks a day → time-slot chips line up, one gets picked (full slots greyed and struck) → a ticket slides out + "Confirmed" stamp slams → a notification drops from the top ("Tomorrow 10:00") → logo.
- **Rules:** mid pace, 2–4 s per shot, mostly light, dark for the ticket shot, the camera pushes into every picked cell, real data (service names, prices, room names, opening hours).
- **Signature gag:** stamp `scale 2 → 1` + rotate -8° + impact; the ticket has a perforated tear line.

## 4 · Menu & order & pay
- **Shots:** logo → menu cards in a grid (hero dish first) → tap + and the cart badge bumps (2–3 dishes) → cart slides up, total counts → PromptPay / QR + paid tick → status bar: received → cooking → ready → logo.
- **Rules:** quick-mid pace, warm backgrounds (cream / orange / brand), real food photos only if the user provides them — otherwise icons or colour shapes, never invented food images; prices in `tabular-nums`.
- **Signature gag:** the tapped dish flies to the cart on a curve (tween `x` and `y` with different eases).

## 5 · Shop / products
- **Shots:** logo → a row of product cards slides past → zoom on the hero product → full price counts up → strike → counts down to the sale price → "-30%" badge slams → add to cart → points coins bounce into a wallet / points counter → logo.
- **Rules:** fast, brand colour / white alternate, one contrast colour for sale badges across the whole clip, hold the final price 1.5 s.
- **Signature gag:** flash sale (count up → strike → count down) and a promo countdown.

## 6 · Back-office
- **Shots:** the problem (notebook / paper pile / messy numbers, desaturated) → hard cut to the dashboard (full colour) → KPI tiles count up → a chart draws → table rows tick one by one → 2–3 features (scan, low-stock alert, invoice) → before/after → logo.
- **Rules:** mid pace, grey problem shot then brand colours, pull dashboard pieces one tile at a time (never the whole page), real customer data replaced with samples.
- **Signature gag:** split-screen before/after, then the divider sweeps so "after" takes the whole frame.

## Logo kit (used by every template)

Every template opens and closes with it; a logo-only request uses only this (5–8 s). Splitting the logo into pieces (SVG or PNG/JPG) → `references/logo.md`.

| Move | How | Used as | Sound |
| --- | --- | --- | --- |
| Assemble | pieces fly in from different sides (rotate / scale), 0.15–0.2 s apart, `back.out(1.6–1.8)`, then the whole logo bumps 1.08 → 1 | intro / outro | pop per piece, impact when complete |
| Bounce in / out | in: `scale 0 → 1.12 → 1` `back.out(2.2)` · out: `scale 1 → 1.08 → 0` `back.in(2)` | intro / outro | pop, swish on exit |
| Shake / glitch | `.fx` on the logo, `x` jitters ±`M*0.01` 4–6 times in 0.3 s with `--r` RGB split, then settles | punchy intro | impact + fast ticks |
| Line draw | SVG `stroke-dasharray` = path length, tween `stroke-dashoffset` → 0, then fade the fill in | calm intro | long swish, ding on fill |
| Tuck + name + link | logo shrinks upward, brand name rises from a mask, link / handle follows, hold 1.5–2 s | outro | swish, ding |

The *pill frame* recipe (brand name sitting on the frame's top border) follows any intro.

## Universal structure (fallback A and anything off-template)

Portfolio / showreel with the user's videos: same structure, works in frames — parts and rules in `references/footage.md` › Showreel / portfolio structure.

| Part | What happens | Camera / transition |
| --- | --- | --- |
| Open (3–5 s) | logo kit → name → tagline | still, then zoom-through |
| Hook (1.5–2 s) | one standout line / number, or all pieces pop up (middle first) | pull back to show everything |
| Features × 3 (3–8 s each) | same move sequence for every piece + one unique gag each | whip-pan in, brake and hold to read |
| Result (2–3 s) | number / before-after / a review the user supplied | punch zoom |
| Call to action + logo (2–4 s) | pieces swipe out → logo kit outro + link | cut to logo, loop |

- **Portrait (9:16, 3:4):** stack pieces in a column and tilt the camera down instead of panning; copy in the top or bottom half, never left/right. The template switches with `VERT`.
- **Landscape (16:9):** zones — piece centre-left, big word + line on the right; or word on the left + control panel (input, colour swatches) on the right.
- **21:9:** lots of side room for copy; keep key items away from the top and bottom edges.
