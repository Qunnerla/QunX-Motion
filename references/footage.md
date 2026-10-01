<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# The user's own videos in a clip (footage)

For portfolios, showreels, app demos with screen recordings, product videos: the user's video plays **inside a frame** of the motion graphic, on the clip's timeline.

## Contents
- Never open a whole video file
- Look: `scripts/clips.js <folder>`
- Cut: `scripts/clips.js cut`
- Put it in the clip: `footage()`
- Showreel / portfolio structure
- Hand-off, check and render

## Never open a whole video file
Reading, decoding or uploading a whole video (a 2 GB showreel, a folder of renders) stalls the chat for minutes. Never `Read` a video, never convert or scan it in full, never embed it as a data URI. Only:
- `ffprobe` (header only: length, size, frame rate, codec) — `scripts/clips.js` does this for every video in a folder in seconds;
- a few frames with a **fast seek** (`ffmpeg -ss <t> -i file -frames:v 1`) — the contact sheets;
- cutting **only the seconds that will be used**.
No ffmpeg on the machine → ask the user to trim the parts to use (2–4 s each) and send those, or to name the times; don't try to read the files another way.

## Look: `node scripts/clips.js <folder or files…>`
Writes `clips-out/`: `index.json` (every video: length, size, resolution, fps, codec, sound, phone rotation) + one contact sheet per video (`NN-name.jpg`, 6 frames with their times) + `all.jpg` (one row per video, row n = video n). Look at `all.jpg` yourself, then ask the user which works / which moments to use (a card with the best 3–4 + "Other", or plain text for a long list). Suggest moments from the sheets: the most readable, most colourful or most moving part, 2–4 s each.

## Cut: `node scripts/clips.js cut`
```
node scripts/clips.js cut work.mov --from 12.5 --to 15.5 --name work-01            # one
node scripts/clips.js cut --plan plan.json                                         # many: [{src, from, to, name}]
```
Output in `clips/` next to the clip: `<name>.mp4` (H.264 — Safari, iPhone, Chrome) **and** `<name>.webm` (VP9 — Chromium, which `check.js` / `qa.js` / `render.js` use: it has no H.264), no sound, a keyframe every ¼ s (scrubbing lands fast), faststart, `clips/clips.json` with each clip's length, size and **fps**.
- `--height 720` (default, the short side) · `1080` only when the video fills the whole frame · `540` for many small frames.
- `--fps`: never more than the source (a 25 fps film stays 25). `--crop 9:16 | 1:1 | 16:9` for a frame of that shape.
- Keep each cut to what is shown (+0.5 s); a clip over ~15 MB is flagged as heavy for phones.

## Put it in the clip: `footage()`
```js
footage('#frame3', 'clips/work-03', t, dur, {fps:30, from:0, rate:1, fit:'cover', show:[t - 0.6, t + dur + 0.6]});
```
- `'clips/work-03'` without an extension = both files (mp4 first, webm second): every browser picks the one it plays.
- Plays muted during `[t, t + dur]` in step with the timeline: play / pause / drag the bar / chapter buttons / loop all land on the right frame; the music and SFX stay the clip's own (the video's sound is not used).
- `show:[a, b]` — when the frame is visible longer than the video plays (a whip-pan in, the camera leaving): the first frame waits before `t`, the last frame stays after `t + dur`. Default = `[t, t + dur]`, which leaves an **empty frame** during camera moves — `qa.js` flags that as a jump.
- `fps` from `clips.json`: scrubbing and export land in the middle of a video frame, the same frame both ways.
- `rate` 0.5–2 for slow / fast motion (`dur × rate` must fit inside the cut; `qa.js` flags a video that runs out and freezes).
- `fit:'cover'` fills the frame (crop), `'contain'` shows it whole.
- **At most 2–3 videos playing at once** (phones); many frames on screen → only the hero plays, the others show a still (`show` without playing: give them a 0.01 s `dur`).
- The frame is an ordinary element (rounded card, device mockup, tilted panel): move, scale and mask the frame, never the `<video>` itself. Transitions and text effects work as usual around it.
- Real app screen recordings are footage too, but UI **pieces** rebuilt from code still come first (`references/real-ui.md`); footage is for what can't be rebuilt (animation, film, 3D, games, live demos).

## Showreel / portfolio structure
Use the universal structure (`references/templates.md`) with these parts:

| Part | What happens |
| --- | --- |
| Open (2–3 s) | name / logo kit + role line ("2D animation · 2026") |
| Works × 4–8 (2–3 s each) | one video per frame; the camera glides or whip-pans frame to frame; title + year / client under the frame; cut on the beat when there is music |
| Burst (optional, 2 s) | a grid of 4–6 small frames, only the middle one playing, zoom into it |
| Close (2–3 s) | logo + contact / link |

Ask on card 3: how many works and which ones (from `all.jpg`), and whether to cut on the music's beat.

## Hand-off, check and render
- The clip is now a **folder**: `clip.html` + `clips/`. Send both (zip the folder). Opening `clip.html` straight from the folder works; don't move `clip.html` away from `clips/`.
- `check.js`, `qa.js` and `render.js` wait for each visible video to show its exact frame (`CLIP.settle()`), so sheets, checks and MP4 exports are frame-exact. `qa.js` also checks: every video loads, lands on the right frame when scrubbed, hides after its window, runs out or not, how many play at once, drift while really playing (desktop and phone), missing .mp4 / .webm, heavy files.
