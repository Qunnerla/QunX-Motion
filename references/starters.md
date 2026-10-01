<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Starter clips (`assets/starters/`) — the example gallery

Eight finished clips, numbered. Two jobs:
1. **Example gallery** — when the user has no reference and picks *Show me examples* (SKILL.md › Card 0), send them **one file at a time, 01 → 08**, each with its number, name and the one-liner below. The one they pick becomes their reference **and** template (card 1 is skipped; card 3 asks how much of it to use). *Exact* builds on that clip's own code.
2. **A pool of moves, pacing and code patterns** to borrow from in any clip.

Never reuse a clip's brand, logo, copy or numbers for another user's project: 02–06 carry MePocket (the author's own app), 01 carries placeholders (`[Brand]`), 08 carries the name Claude Opus 5.5 with a placeholder mark — always replaced by the user's.

## Gallery (send in this order)

| # | File | One-liner to send with it | Length · look | Built on |
| --- | --- | --- | --- | --- |
| 1 | `01-plans.html` | Plans & prices: logo lock-up, whip-pans card to card, prices count up, ticks pop | ~17 s · dark · 16:9 | the template (= `assets/template.html`) |
| 2 | `02-feature-promo.html` | Calm feature tour: headlines rise, counters, a circle wipe, a 3-step phone flow with captions | 27 s · dark · Thai | own light player, no sound |
| 3 | `03-peak-cut.html` | Punchy beat-cut promo: logo in pieces, a card stack swapping on the beat, a wall of 63 tiles, a 3D glass card | 36.5 s · dark · English | own light player, no sound |
| 4 | `04-real-ui-wallet.html` | Real app UI moved by its own code: carry-over cuts, a loading capsule, colour picker, gauge, full sound | 26 s · dark / light · 120 BPM | real app CSS in iframes, full sound engine |
| 5 | `05-plans-cards.html` | Plan by plan with the real plan card: tabs, a big price, limits, seven plans from Starter to Enterprise | 49 s · dark · Thai | own player with sound |
| 6 | `06-plans-toggle.html` | Plans on a switch: Individual ↔ Business toggle, plan names flipping through | 61 s · dark · Thai | own player with sound |
| 7 | `07-camera-lab.html` | Camera & transitions lab: a punchy hook, then zoom / spin / directional blur, glitch, light leak, ink, handheld walk / run, one-take camera | 31.5 s · 21:9 | the template + the built-in library |
| 8 | `08-ai-chat-showcase.html` | AI product showcase: a logo born in light, particle "5.5", a tilted-camera chat (drag a file in, type, pick effort), a working log with question cards, download → zoom blur → logo | 49 s · dark · 16:9 · 120 fps | the template + the built-in library |

Sending: one file per message (a file-sending tool when there is one, otherwise the path), e.g. "3 / 8 · Peak cut — punchy beat-cut promo … (opens in a browser, press Play)". Then the "Which one should we use?" card: numbers on two pages (1–3 + "See 4–8 →", then 4–7 + … like card 1; "Other" takes a number or "mix 3 and 7") + `None of these — use the templates`.

## Using a picked clip as the template

- Card 3's *template use* decides how:
  - **Exact** → copy the picked clip's file and keep its code: same shots, timing, moves, transitions and player. Change only the brand (logo / mark, names), copy, numbers and colours to the user's, and fit the length if the user asked for another one (ask first). For 01, 07, 08 run `check.js` / `qa.js` as usual; 02–06 have their own players (02 and 03 have no sound) — the scripts can't drive them, so walk the read-the-code checklist and say in one line which checks were skipped.
  - **Structure** → a fresh copy of `assets/template.html`, the picked clip's shot order and timing ported in, moves picked fresh.
  - **Feel only** → a fresh copy of the template, only its mood, pace and energy; new shots.
- Replace every brand element: logo / mark, name, model or plan names, copy, numbers, colours (from the user's brand).
- Mixing ("the camera of 7 with the chat of 8") is fine: write it at the top of the storyboard.

## Borrowing patterns (any clip)

- Offer one or two starters in the storyboard step when they fit ("pacing like 02, transitions like 04") — as options, not as the house style.
- The full stops after 03's headlines are that clip's own copy style: new clips follow core rule 7 (no full stop after a headline).
- Useful parts: the step bar + caption swap of 02, the card-stack swap of 03, the pose-keyframe driver and `heroCam()` of 04, the plan tabs of 05, the toggle of 06, every `trans.*` / camera move in 07, and in 08 the logo glow made of the logo itself, particles that land as the background dot grid, the dot-floor ripple, the linked working log + question cards and the click-centred zoom blur.
- The built-in library (`trans.*`, `rig()` + camera moves + handheld, effects) lives in the template, 01, 07 and 08; 02–06 were built without it.
- Read `transitions.md`, `text-fx.md`, `sound.md`, `camera.md` and `effects.md` for the choices behind them.
