<!-- © 2026 QunX · qunx-motion 1.0.0-beta.1 · QX-MGH-7F3A -->
# Sound design (synthesized, plus the user's own sound files)

## Contents
- What went wrong first, and what fixed it (the tuning log)
- The engine in `assets/template.html`
- Sound palette: one timbre per kind of action
- Music moods: 10 moods and which 4 to offer per project
- Arrangement: the music follows the shots (energy, fills, peaks, ending)
- The user's song: cut the clip to its own beats (scripts/beats.js)
- Music bed: loop, breaths, fills, sub drops
- Using the user's sound files (SFX packs)
- Sync: sounds that land on the frame
- Checking the mix
- Feedback words → what to change

## What went wrong first, and what fixed it

This log comes from one clip tuned by ear over ~20 rounds (`assets/starters/04-real-ui-wallet.html`). Start from the end state, not the beginning.

| Round | What the user heard | Cause | Fix that stuck |
| --- | --- | --- | --- |
| 1 | "thin, too straight, not deep" | bare sine / noise beeps, dry, same level, nothing below 60 Hz | master bus (warm low shelf, tamed highs, glue compressor, small room reverb); sub layer under kick / impact; a music bed with chords |
| 2 | "every tick sounds the same" | one fixed pitch per sound | pitched sounds walk a pentatonic scale in the song's key; auto-rotation so the same note never repeats twice in a row; rising run for a loading bar |
| 3 | "too many shrill tones" | ticks / dings / digits at 1.5–4 kHz | everything tonal moved down an octave (A4–A6); bells instead of pure sines; soft counting blips instead of square-wave beeps; high shelf ‑1…‑4 dB |
| 4 | "the sharp swoosh at 6 s", "the 'ngeed' at 18 s and 21 s" | whooshes with a gliding tone inside, risers with a hissing rise into the hit | whooshes for text / cards are noise only (no pitched glide); keep risers only on 1–2 big cuts; everywhere else a soft whoosh |
| 5 | "typing should be creamy, soft", then "like the logo pop" | clicky keyboard samples | typing = a small soft pop (the logo's pop, lower and quieter), a slightly different note per letter |
| 6 | "typing comes before the letters" | (a) key time rounded half a step early, (b) a **different** sound (colour-pick clicks) played right before the typing, (c) latency compensation | key k at the frame letter k appears; make neighbouring actions sound clearly different; per-sound timing offset (below) |
| 7 | "separate mute for music and effects" | one sound switch | two groups (music, sfx), each with its own button and key |
| 8 | "a soft poke for picking colours, different from typing" | colour pick reused a click | poke = pitch falls, muffled, a bit longer; typing = pitch rises, short |
| 9 | "card appears: soft pop but heavier than the others" | same pop for everything | card pop = lower pop + sub body; letters pop = light and high; keep a size ladder |

Lessons that apply to every clip:
- **One timbre per kind of action** (appear, press, type, pick, lock, sweep). If two different actions sound alike and sit close in time, the user hears one as "early / late".
- **Size ladder**: small things (letters, ticks) → light, high, short; medium (buttons, swatches) → mid, soft; big (cards, logo lock, scene cuts) → low, with sub body.
- **Few pitched glides.** A falling or rising tone inside a whoosh reads as "ngeed". Noise-only whooshes for sweeps.
- **Breathe.** Drop the beat for half a beat before the biggest hits; end on the logo with the beat stopped and a chord ringing out.
- **The user's ear wins.** Tune by ear with them; keep every number (offsets, levels) in one place so they can edit it.

## The engine (`assets/template.html`, section 5)

- `makeBus(ctx)`: low shelf +2 dB @ 80 Hz → high shelf ‑1 dB @ 6 kHz → compressor (‑16 dB, 3.5:1, 5 ms / 200 ms) → master 0.8; a 2.2 s generated stereo reverb on a send; a shared noise buffer.
- Two groups, `music` and `sfx`, each with a dry and a wet (reverb) gain; `ON.music` / `ON.sfx` mute them with a 30 ms fade. Beat track, bass, pads and arps are `music`; everything else is `sfx`.
- `tone(type, f0, f1, t, d, v, {a, glide, lp, q, detune, send})`, `noise(t, d, v, f0, f1, q, {type, peak, send})`, `bell(t, f, d, v, send)` (soft FM bell), `samp(name, t, v, {rate, send, offset})` for sound files.
- `cue(t, name, arg)`; pitched cues without an `arg` take the next note from `AUTO[name]`.
- `renderAudio()` renders the same cues offline (for `render.js` and for checking the mix), ignoring the mute buttons.

## Less is more: quiet moments and one ping at a time

From a real test where the same bright "kring" played at the logo, the digits, the burst and the file drop:
- **Not every move needs a sound.** A text line sliding, a small UI piece settling, a camera drift can stay silent (the music carries them). Sound the moves that change the story: arrivals of heroes, clicks, hits, cuts that matter.
- **Bright pings never sit close together.** `ding`, `softding`, `shimmer`, `chime` and bell-like `tick`s: at most one within ~1.5 s. When two moves want one, pick the one that matters and give the other a non-bell sound (`thump`, `softpop`, `ink`, `burn`, `softwhoosh`) or nothing. The same goes for repeating one ping at every step of a list: use a soft `tick` or `key`, and save the bell for the end ("done").
- **No fizz before a hit.** A `shoosh` / `riser` in the second before a burst or a big cut reads as noise unless it is that hit's build-up; let the hit land from quiet (a `HUSH` window helps).
- `qa.js` flags bright pings closer than 1.5 s (medium) — fix it by choosing, not by lowering the volume.

## Sound palette

| Action | Name | Recipe (short) |
| --- | --- | --- |
| camera move, big fly-in | `whoosh` | band-passed noise 300→3800 Hz + low-passed body + a faint low sine |
| text / cards sweeping past | `shoosh` | airy noise only, 0.3–0.4 s, no pitch |
| gentle moves, boxes pulled up, fans | `softwhoosh` | quiet low-passed noise, slow attack |
| slide out | `swish` | noise 2000→450 Hz + low body |
| small thing appears (letters, chips) | `softpop` | sine glide up, low-passed, notes from the scale |
| big thing appears (card, box) | `cardpop` | lower pop + sub (f/2) + tiny thud |
| logo pieces, badges | `pop` | sine f → 2.2f + triangle an octave down |
| typing | `key` | the pop, smaller and lower; 6 notes rotating |
| picking a colour / option | `poke` | falling pitch, muffled (low-pass 700 Hz), 0.17 s |
| button press | `click` or a UI sample | short noise tap + low sine |
| lock / title lands | `impact` | sine 140→45 + noise + sub 58→34 |
| scene cut that matters | `boom` | sub sine 72→29 Hz 1.3 s + low noise tail |
| done / success | `softding` | FM bell, quiet, lots of room |
| counting | `digits` or a UI sample | soft triangle blips on the scale |
| before one big zoom | `riser` | use once or twice per clip at most |
| glitch transition | `zap` | stepped square blips on random pitches + high noise + a low saw |
| light leak, lens flare, confetti | `shimmer` | a spread of high bells + airy noise + a slow rising sine |
| spin blur | `swirl` | noise sweeping up then down + a falling sine |
| film burn | `burn` | low rumble + crackle ticks |
| ink / liquid wipe | `ink` | low wet noise + a falling sine + a small drip |
| 3D flip, page curl | `flip` | a short paper swipe + a tick |
| camera jolt, landing of a crash zoom, track-matte land | `thump` | a low sine 92→38 Hz + a muffled hit |

The `trans.*` transitions, `shake`, `crashZoom`, `particles` and `cursorClick` cue their own sounds; do not add a second sound for the same moment (qa.js reports doubled effects).

## Music moods

Ask on card 3 (SKILL.md step 1), once the kind of project is known. Offer **3 moods**, best fit first with "(Recommended)", each with a one-line feel in the user's language, and **"My own song"** as the 4th option (see *The user's song* below). Skip the question if the user already sent a song. All are synthesized by `addBed()` from the `MOODS` table in `assets/template.html` (tempo, one chord per bar, drum / bass / chord / lead styles); `CONFIG.bpm` left empty takes the mood's tempo, so pick the mood **before** timing the storyboard.

| Mood | Feel | BPM | Chords | Drums · bass · chords · lead |
| --- | --- | --- | --- | --- |
| `drive` | punchy modern promo (the default) | 120 | Am F C G | four-on-the-floor + clap · off-beat bass · saw pad · — |
| `hype` | big, loud, countdown energy | 128 | Fm D♭ A♭ E♭ | four-on-the-floor · rolling 8th/16th bass · saw pad · pluck arp |
| `anthem` | uplifting, wide, stadium | 100 | C G Am F | half-time snare · long bass · saw pad · chimes |
| `cinematic` | trailer, reveal, tension | 90 | Dm B♭ F C | low toms · sub · saw pad · chimes |
| `cafe` | warm, jazzy, table service | 92 | Dm7 G7 Cmaj7 Am7 (swung) | brushes + shaker · walking bass · electric piano · — |
| `sunny` | happy, fresh, summer | 112 | C F G C (swung) | kick + clap + shaker · bouncy bass · soft pad · ukulele strums |
| `cute` | bouncy, small, playful | 118 | F C Dm B♭ (swung) | light kick + rim + shaker · bouncy bass · soft pad · marimba |
| `lofi` | cosy, calm, slow | 80 | Fmaj7 Em7 Dm7 Cmaj7 (lazy swing) | lazy kick / soft snare · long bass · electric piano · — |
| `clean` | trustworthy, tidy, corporate | 108 | C Am F G | soft kick + snare · off-beat bass · soft pad · pluck arp |
| `luxe` | premium, sparse, expensive | 86 | Cm9 A♭maj7 Fm9 G7sus | sparse kick + rim · sub · soft pad · — |

Which moods to offer (first = recommended; show the first 3 next to "My own song", the 4th is the fallback when the user sends no song):

| Kind of project | Offer |
| --- | --- |
| concert / event tickets, festivals, launches | hype · anthem · cinematic · drive |
| restaurant, café, food ordering | cafe · sunny · lofi · drive |
| pets, cute animals, kids, toys | cute · sunny · lofi · cafe |
| fintech, banking, wallets, numbers | drive · clean · luxe · hype |
| shop, e-commerce, flash sale | drive · sunny · hype · luxe |
| booking: hotel, salon, clinic, classes | clean · lofi · sunny · luxe |
| back-office, dashboard, SaaS, B2B | clean · drive · lofi · luxe |
| beauty, fashion, premium brands | luxe · lofi · cafe · drive |
| games, tech, sport, fitness | hype · drive · cinematic · anthem |
| health, wellness, study, calm apps | lofi · clean · cafe · luxe |
| travel, outdoors, summer | sunny · anthem · lofi · drive |
| anything else | pick by energy (calm → lofi / clean / luxe; medium → drive / cafe / sunny; high → hype / anthem) and warmth (cute / sunny / cafe) |

- The user can hear any mood on their clip with `?mood=<name>` on the file's URL; offer that when they can't decide.
- A mood sets the bed, not the effects: keep the effects palette (one timbre per action) and the `HUSH` windows the same.
- New moods go in `MOODS` as one line; keep chords one per bar and roots in the 39–78 Hz range (`chordOf()` does this).

## Arrangement: the music follows the shots

A mood is only the sound; the arrangement makes it fit *this* clip. It is driven by the chapters, so plan it in the storyboard's **music** column and pass it to `chapter()`:

```js
chapter(t, 'Logo', {e:1});            // energy 0–3 for this shot
chapter(t, 'Main reveal', {e:3, peak:true});
chapter(t, 'Logo outro', {end:true});
```

| Energy | What plays |
| --- | --- |
| 0 | chords only (a quiet opening, a pause, a serious line) |
| 1 | + bass (intros, calm explanations) |
| 2 | + drums |
| 3 | + lead (arp / marimba / ukulele / chimes) and the busiest drum details |

What `addBed()` does with it, in every mood:
- **Builds in**: with no plan, the first shot is 1, the second 2, the rest 3, so the drums don't slam in on frame one.
- **Fills**: a short roll (snare, rim or toms, by mood) on the beat before any shot that lifts the energy or peaks.
- **Peak** (`peak:true`, 1–2 per clip): half a beat of silence, then kick + crash + sub on the cut, on the chosen mood's chord.
- **Chords change on the cut**: chords move every 4 beats *counted from each shot's start*, so a cut that isn't on a bar line still gets a new chord on the cut.
- **Ending** (`end:true`, or automatically the last chapter when it's called logo / outro / end): drums and bass stop, and the mood's home chord rings out in its own voice (electric piano for café / lo-fi, marimba roll for cute, ukulele strum for sunny, pluck arpeggio for hype / clean, chimes otherwise) with a soft sub.
- `HUSH` windows still work on top of this for extra breaths.

Rule of thumb for the column: open at 1, reach 2 by the second shot, save 3 for the feature shots, one `peak` on the main reveal, `end` on the logo. Calm moods (lofi, luxe, clean) can stay at 1–2 for longer.

## The user's song: cut the clip to its beats

When the user sends a song (mp3 / wav / m4a / a video's audio), the clip follows **that song's** beats instead of a synthesized bed.

1. **Read the song** (step 0 or as soon as it arrives), with the agreed length:
   ```bash
   node scripts/beats.js song.mp3 --length 20 --click
   ```
   It writes `song.beats.json` and prints: tempo (plus double / half-time alternatives), whether the tempo is steady, changes, or no steady pulse was found, the first beat and first bar line, **sections** with energy 0–3 and labels (intro, build, drop, break, outro), and up to 3 **windows** of the agreed length (where to start the song so the biggest drop lands mid-clip). `--click` writes `song.click.wav`: the song with a low click on every beat and a high click on every bar start.
2. **Pick the part of the song.** The user named one ("the chorus", "from 1:02") → the nearest bar line to it. Otherwise the first window. Say which part you picked and why in one line.
3. **Check by ear when the script is unsure** — it says `BEATS UNSURE`, `TEMPO CHANGES`, or a bar confidence below 0.3: send the click file and ask "do the clicks sit on the beat, and does the high click land on the 1?". Off by half → rerun with `--bpm <alternative>`; bars off → tell the user which beat you'll treat as the 1 and move `bars` by 1–3 beats. Steady songs with a clear drum pulse don't need this step.
4. **Set it in the clip** (only the beats and bars inside the clip ±1 s, rounded to ms, to keep the file small):
   ```js
   music: 'song.mp3', songStart: 42.51, beats: [42.51, 42.98, …], bars: [42.51, 44.39, …], songFade: 0.8,
   ```
   `B(n)` is now the time of beat *n* of the clip on the song's real beats (it follows drifting and changing tempos); `BAR(n)` is the start of bar *n*. The synthesized bed switches off by itself; effects stay.
5. **Storyboard on the song**: the **music** column names the song's section instead of an energy (intro / build / drop / break). Cuts on `BAR(n)` (or `B(n)` for fast parts), the main reveal / peak shot on the **drop**, calm or explaining shots in **breaks**, RGB kicks and punches on the printed **accents**, the logo on the last bar line. End the clip on a bar line; a song part that ends on a hit wants `songFade: 0.2`.
6. **Effects on top of a song**: keep the per-action sounds, but lighter: no `riser` or `boom` fighting the drop, no drums (they'd clash with the song's), whooshes quieter under vocals.
7. **Hand-off**: the song file must sit next to the clip (or embed it, `references/export.md` › One file with a song). Remind the user once: songs they don't own can be muted or claimed on TikTok / YouTube / IG; posting with the platform's own music library, or a licensed track, avoids that.

No ffmpeg and no Playwright on the machine: `beats.js` can't read the song. Ask for the BPM and the time of the first beat (seconds), set `CONFIG.bpm` and `songStart` to that beat, and cut on `B(n)` as usual.

## Music bed

- Loop one chord per bar in a minor key (e.g. Am F C G); off-beat saw bass through a 320 Hz low-pass (roots around 45–65 Hz); quiet detuned pads; an 8th-note arp only in busy middle sections.
- Kick with a sub tail, clap on 2 and 4, off-beat hats, 16th ghost hats where the picture is busy, open hat at bar ends.
- Snare fills (quiet → loud) into the 2–3 biggest cuts.
- `hush` windows: no drums for ~half a beat before the big hits, and from the logo to the end.
- Sub drops (`boom`) on 3–5 moments: opening, the main reveal, section changes, the logo.

## The user's sound files (SFX packs)

1. The user sends demo clips (often a video that shows each sound's name on screen). Extract frames (2–10 fps) to read the names, and the audio.
2. Find each sound by silence gaps (e.g. RMS > ‑42 dB, gaps ≥ 60 ms) and match it to the name shown at that time. Cut with a 4 ms fade-in and a short fade-out; keep only what the clip uses.
3. Check each one's brightness (spectral centroid) and what it really is: a "Fast Riser" can turn out to be a rise into a sub hit — find the hit time inside it and schedule `t - hit`.
4. Encode MP3 128 kb/s mono, embed as base64 JSON, decode once at start (`decodeAudioData` on an `OfflineAudioContext`; Chrome decodes MP3 gapless — verify the start time once). Wait for the decode before `CLIP.ready`.
5. Remind the user to check the licence of any sound they did not make, and to swap in the original files (not sounds cut from a compressed video) before publishing.

## Sync

- Schedule ahead: on each frame, schedule cues up to `now + latency + 40 ms` at `ac.currentTime + (c.t - now - latency)`, where `latency = outputLatency + baseLatency` (≤ 0.25 s). Reset the scheduled-until mark on play, seek and loop.
- The screen is late too (1–3 frames). If the user hears one kind of sound early, add a per-sound delay (`LATE.key = 0.05`) or a per-cue one (`cue(...).late`), not a global change.
- Typing driven by `proxy()` + `Math.round()` shows letter k at `(k - 0.5)` steps: put key sounds at `(k + 0.5) * dur / n`.
- Before changing timing: list every cue within ±0.5 s of the spot. The "early" sound is often a different sound.

## Checking the mix

- Render offline (`CLIP.renderAudio()` or `render.js`), then: integrated loudness ‑16…‑14 LUFS, true peak ≤ ‑1 dBFS; band balance (sub strongest, highs ‑10…‑20 dB relative); share above 1.5–2 kHz per complained-about segment; a spectrogram to spot long glides and hiss.
- Ask the user to listen: you cannot hear. Say which numbers you changed so they can tune further.

## Feedback words → what to change

| User says | Change |
| --- | --- |
| thin, flat, "not deep" (บาง, ไม่หนา, ไม่ลึก) | sub layers, bus low shelf, music bed, reverb send |
| too straight / monotonous (เส้นตรง) | chord changes, arp, fills, breaths, pitch rotation |
| shrill, piercing (แหลม) | move an octave down, bells not sines, noise-only whooshes, lower level |
| "ngeed", whine (งื้ด) | remove pitched glides and riser hiss there |
| soft, creamy, round (นุ่ม, ครีมมี่, ทุ้ม) | low-pass 700–1500 Hz, slower attack, lower pitch, more reverb |
| heavier (หนักกว่า) | lower pitch + sub body (f/2) + tiny thud |
| "pop", "poke", "ding", "shoosh" | use the matching palette entry |
| early / late | check nearby cues first, then per-sound offset |
