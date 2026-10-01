<!-- © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A -->
# Getting a video out

Screen recording is the default (nothing to install, feels "real"). `scripts/render.js` is optional, for users with Node + ffmpeg who want frame-exact files.

## Player features (both phone and desktop)
Play / Pause, scrub bar, chapter buttons, fps picker (120 / 60 / 30 / 24) + measured fps, Music / SFX on/off, **CC** subtitles on/off, **Safe zone** overlay (TikTok / IG Reels / YT Shorts / all), fullscreen, loop.
Keys: Space play/pause · ←/→ 1 s · Home restart · F fullscreen · M music · S effects · C subtitles · Z cycle safe zones.
URL options: `?aspect=9:16`, `?style=light`, `?safe=tiktok`, `?mood=cafe`, `?cc=clean`, `?alpha=1` (transparent background).

## Phone
- Open the file in Safari / Chrome, tap once so sound can start, tap Fullscreen.
- iPhone has no real fullscreen for pages: the player fills the page instead; landscape clips rotate themselves when the phone is upright; portrait clips (9:16, 3:4) don't rotate.
- Record: iPhone — Screen Recording in Control Center (long-press to turn the mic on if wanted); Android — Screen recorder in quick settings.
- Trim the start and end in Photos or CapCut.

## Desktop
- Chrome or Edge, keyboard shortcuts above.
- Record: Windows `Win + Alt + R` (Xbox Game Bar) or OBS; macOS `Cmd + Shift + 5`, record a selected area.
- OBS gives the best result: canvas = the clip's size (e.g. 1080×1920 for 9:16), FPS = the chosen fps, Window Capture of the browser, Desktop Audio on for the sound.
- In Premiere / After Effects / CapCut set the project fps to the recording's fps.

## Frame-exact export (optional): `scripts/render.js`
Steps the timeline frame by frame, screenshots the stage, renders the sound offline with the same synth, and muxes with ffmpeg. No dropped frames, perfect sync. Needs Playwright (`npm i playwright`) and ffmpeg.

```
node scripts/render.js clip.html --fps 60                   # clip.mp4 (H.264 + AAC) + clip.wav (+ clip.srt when there are captions)
node scripts/render.js clip.html --fps 30 --scale 0.5 --gif # quick half-size preview + clip.gif (640 px, 15 fps)
node scripts/render.js clip.html --alpha mov                # transparent ProRes 4444 .mov for After Effects / Premiere
node scripts/render.js clip.html --alpha webm               # transparent VP9 .webm for the web
node scripts/render.js clip.html --alpha png                # transparent PNG sequence folder
node scripts/render.js clip.html --from 4 --to 8            # only part of the clip
node scripts/render.js clip.html --aspect 9:16              # another aspect (template clips only)
```
- Speed: roughly 1 s of work per 1–2 s of 1080p video at 60 fps; use `--scale 0.5 --fps 30` for drafts.
- Transparent export turns every scene background transparent (`html.alpha`); pieces keep their own colours. Design alpha clips with pieces that read well on any background.
- The safe-zone overlay and the player controls never appear in the output.
- `--gif` is the file to post in a community or README.

## Subtitles (captions)
`caption(t, end, text, {pos})` lines are burned into the frame; the viewer hides / shows them with the **CC** button or `C` (the button only appears when the clip has subtitles), and `render.js` writes them to `<out>.srt` for platforms that take subtitle files.

**Looks** (`CONFIG.ccStyle`; preview another with `?cc=clean`):

| Style | Look | Good for |
| --- | --- | --- |
| `box` | white on a dark rounded box | presentations, busy backgrounds, 16:9 |
| `clean` | white bold text with a dark edge, no box | TikTok / Reels / Shorts, light or dark scenes |
| `bar` | background-colour text on the brand accent | brand-heavy clips, short lines |

**Position**: `CONFIG.ccPos` (`bottom` or `top`) for the whole clip, `{pos:'top'}` for one line. In 9:16 the bottom line sits at 20 % and the top one at 13 % of the height, clear of the TikTok / Reels / Shorts buttons; check with the safe-zone overlay.

**Subtitles that explain the motion** (the user picked "explain each shot" on card 3):
- One line per shot or per main action, in the user's language, saying what the viewer is watching and why it matters ("Tap + to start a new savings box"), never repeating the big on-screen word.
- Short: about 32 characters per line in 9:16, 42 in 16:9, 2 lines at most (count Thai by visible characters). Longer → split over two actions.
- Timing: on 0.05 s after the move starts, off 0.1–0.2 s before the cut; at least 1.2 s on screen and no faster than about 15 characters a second. With a song, switch lines on bar lines (`BAR(n)`).
- Never over the hero: if the shot's hero or copy sits in the bottom third, use `{pos:'top'}` for that line.
- Key lines only: the same rules, but only for shots that can't be understood muted (a number, a promise, the call to action).
- They go in the storyboard's **subtitle** column, so the user approves the wording before the build.

## One file with a song
To send the clip as one file, embed only the part of the song the clip uses: `ffmpeg -ss <songStart> -t <END + 1> -i song.mp3 -ac 2 -b:a 128k part.mp3`, put it in `CONFIG.music` as `'data:audio/mpeg;base64,…'`, set `songStart: 0` and subtract the old `songStart` from every `beats` / `bars` time. About 16 KB per second of song.

## A clip with the user's videos
Videos can't be embedded in the one HTML file (far too big): send the **folder** — `clip.html` + `clips/` (zip it). Keep them together; `render.js` and screen recording both work from the folder, and the export waits for every video frame (`references/footage.md`).
