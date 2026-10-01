# QunX Motion
**Official Repository / Canonical Source**

Original Creator: **QunX** · Current Release: **1.0.0 Beta** · License: **QunX Motion License** (`QUNX-MOTION-LICENSE`)

This repository is the canonical source for QunX Motion. Copies found elsewhere may be older or changed; the version and license terms here are the current ones. Download the skill from [Releases](https://github.com/Qunnerla/QunX-Motion/releases).

---

## QunX Motion (qunx-motion) · Claude skill · 1.0.0-beta

**Promo clips for your app, built from your real code — as one HTML file that plays like a video.**
Thai-first, works in any language. Nothing to install to use a clip: open it, press Play, screen-record.

![MePocket Motion — made with this skill](examples/mepocket-motion.gif)

*An early clip made with this skill — the wallet, cards and goal box are the app's real UI pieces, moved by the app's own layout code.*

## What it does

- **Say "make me a short motion graphic"** — the skill first asks for your project files (or a link), reads them, then asks in short clickable cards, recommended option first: one of **6 templates** (data beat-cut, feature tour, booking, menu & order, shop, back-office) on its own card → length, aspect, look and **frame rate + device** → how to use the template, music, subtitles.
- **Your brand, any look** — the look (dark, light, poster, pastel) sets shapes and motion feel; the colours and font come from your project: your website, your app's code (CSS variables, tailwind, theme files) or your SVG logo. You see a colour strip with contrast checked before anything is built.
- **Your own videos in the clip** — showreels and portfolios: `scripts/clips.js` lists a whole folder of videos with contact sheets in seconds (never opening the files in full), cuts only the seconds you pick, and the clip plays them inside frames in step with the timeline — scrubbing, looping and MP4 export land on the exact frame.
- **Real UI, not screenshots** — it pulls cards, buttons and panels from your app's code, one piece at a time, and animates them through their real states.
- **Cut to your own song** — send an mp3 and `scripts/beats.js` finds the tempo, every beat, the bar lines and the drop; cuts land on the song's real beats (even when the tempo changes), the big reveal lands on the drop, and it picks which part of the song to use for your length. A click file lets you check the beats by ear.
- **Subtitles that explain the motion** — one line per shot for people watching muted, in three looks (box, clean, brand bar), top or bottom, clear of the TikTok / Reels buttons; exported as .srt too.
- **Use a template your way** — exactly as it is, only its structure, or only its feel.
- **Your logo, letter by letter** — an SVG logo is split into pieces for the logo intro (even a wordmark drawn as one shape; Thai marks stay on their letter), with a numbered preview to agree the grouping.
- **A real player** — scrub bar, chapters, 120/60/30/24 fps, subtitles on/off (CC), **TikTok / Reels / Shorts safe-zone overlay**, fullscreen, keyboard shortcuts, separate Music / SFX buttons.
- **Sound that isn't beeps** — a synthesized music bed (chords, bass, drums, breaths before big hits) and one sound per kind of action, all tuned to one key; or your own sound files embedded in the clip.
- **Four starter clips** — plans, a calm feature promo, a beat-cut peak promo and a real-UI wallet clip, to borrow moves and pacing from.
- **Menus, not one look** — transitions (carry-over, morph, whip-pan, streaks, iris…) and text effects (letter pop, typewriter, stamp…) chosen per project.
- **No reference? See examples** — answer *Show me examples* and the skill sends its 8 finished clips one by one; pick one and it becomes your template. Sound stays clean: not every move gets a sound, and bright pings never pile up.
- **Transitions editors use** — zoom (radial) blur, spin blur, directional / fast box blur, glitch, light leak, lens flare, film burn, ink wipe, shape mask, 3D flip, panels, track matte (a scene inside a word), page curl — with real motion blur and a sound for each.
- **Camera language** — shot sizes from extreme wide to extreme close-up, low / high / bird / worm / dutch angles, dolly, truck, crane, orbit, dolly zoom, crash zoom, rack focus, a one-take camera path, and a **handheld camera** that moves like a person holding it (just holding, walking, running in to the subject, a jolt on hits, a human whip-pan).
- **Motion that feels alive** — anticipation, squash & stretch, arcs, follow-through, idle life (breathe, blink, sway), cut-out puppets, particles (confetti, sparkles, dust, debris, embers), liquid blobs, text on a path, 3D text, glow, moving light and shadows, colour grades, phone / tablet / laptop mockups with a cursor or a finger tapping.
- **Music moods** — 10 synthesized moods (hype for concerts, café for restaurants, cute for pets, lo-fi, luxe…); it offers the 3 that fit your project plus "my own song", recommended first, and arranges the music to your shots (soft intro, fills, a peak on the big reveal, an ending chord on the logo).
- **Checks its own work** — `scripts/check.js` shoots every chapter, compares forward vs reverse scrubbing, catches errors and autoplay. Before starting it quietly checks what the machine has (Playwright, ffmpeg, internet) and picks a path that works, without asking you to install anything.
- **Hunts its own bugs after sending** — you get the clip right away; then `scripts/qa.js` checks a frame every 0.25 s in every aspect (text cut off or on top of text, subtitles over the main text, TikTok / Reels zones, contrast, flicker, jumps, still spells), the timeline, the sound (clipping, silence, doubled effects, cuts off the beat) and the player on desktop and a phone — and reports each bug with its time and a boxed picture, fixes it and sends the fixed clip.
- **Optional frame-exact export** — `scripts/render.js` → MP4 with sound, transparent ProRes 4444 / WebM / PNG sequence for After Effects & Premiere, GIF, SRT.
- **Honest fallbacks** — apps without a template get a universal structure; things it can't do (lip-sync, filming or generating video, real 3D) are said plainly with the nearest alternative.

## Install

**Claude (claude.ai / desktop):** upload this folder as a zip in your skill settings.
**Claude Code:** copy the folder to `~/.claude/skills/qunx-motion/`.

Scripts are optional helpers Claude runs when it can:
```bash
npm install                      # gsap + fonts, so checks also work offline
# only if Playwright is not on the machine yet:
npm i playwright && npx playwright install chromium
# render.js needs ffmpeg on PATH (beats.js uses it too, or falls back to Chromium); vectorize.py needs: pip install vtracer pillow numpy
```

## Use

```
ทำ Motion Graphic ให้หน่อย สั้นๆ            ← attach or link your project folder
Make a 20 s promo for my booking site, 9:16 for TikTok
Make my logo assemble, transparent video for After Effects
```

| Script | What |
| --- | --- |
| `node scripts/check.js clip.html --aspect 9:16` | contact sheet + reverse-scrub test + error / autoplay check |
| `node scripts/render.js clip.html --fps 60` | frame-exact MP4 with sound (+ .srt) |
| `node scripts/render.js clip.html --alpha mov` | transparent ProRes 4444 |
| `node scripts/render.js clip.html --fps 30 --scale 0.5 --gif` | quick preview + GIF |
| `node scripts/qa.js clip.html --aspect 16:9,9:16 --length 20` | deep bug check after sending → `qa-out/report.md` + pictures (same as `check.js --deep`) |
| `node scripts/brand.js https://your-site.com --code ./app --logo logo.svg` | brand colours + font from your site, code and logo, fitted to each look, contrast checked → `brand.json` + colour strip |
| `node scripts/clips.js ./videos` then `node scripts/clips.js cut work.mov --from 12 --to 15 --name work-01` | list videos + contact sheets without opening them in full; cut the part to use → `clips/work-01.mp4` + `.webm` |
| `node scripts/beats.js song.mp3 --length 20 --click` | tempo, beats, bars, sections, drop, best part for 20 s → `song.beats.json` + click check |
| `node scripts/svg_pieces.js logo.svg` | SVG logo → one piece per letter / shape (holes kept, marks on their letter) + numbered preview |
| `python3 scripts/vectorize.py logo.png 3 logo.svg` | PNG/JPG logo → SVG pieces |

## Folder

```
SKILL.md              workflow, core rules, question flow, fallbacks (read first by Claude)
references/           templates · styles · recipes · transitions · camera · effects · text-fx · sound · starters · real-ui · footage · gotchas · export · logo
assets/template.html  the player + helpers every clip starts from
scripts/              check.js · qa.js · clips.js · render.js · brand.js · beats.js · svg_pieces.js · vectorize.py
evals/evals.json      test prompts and expected behaviour
assets/starters/      8 finished clips (01–08): the example gallery + moves to borrow
examples/             demo GIF
```

## Notes
- Clips load GSAP and Google Fonts from CDNs: the first open needs internet.
- Safe-zone sizes are approximate and platforms change their UI — check before posting.
- A song you don't own the rights to can be muted or claimed on TikTok / YouTube / IG; use the platform's music library or a licensed track when posting.
- Only use `brand.js` and logo vectorizing on your own brand or a client's you work for.

## Third-party
The skill links to these; they are not part of it and keep their own licenses:
- [GSAP](https://gsap.com) 3.12.5 (loaded from cdnjs) — free, including commercial use, under the GSAP Standard License by Webflow. Do not remove GSAP's own notices.
- Google Fonts: Inter Tight, Noto Sans Thai, IBM Plex Sans Thai / Mono, Anuphan (SIL Open Font License).
- Tools you install yourself: Playwright, ffmpeg, vtracer, Pillow, numpy.

## Credit & license
Created & directed by **QunX** · built with Claude · social: Qunnerla

QunX Motion License (QUNX-MOTION-LICENSE) © 2026 QunX · Public Version 1.0.0-beta · BETA · Canonical Source: https://github.com/Qunnerla/QunX-Motion. Free to make clips (personal or client work, the clips are yours); free to modify, fork, translate and share with the credit, `LICENSE` and canonical source kept; not for sale, nor any derivative of it. The current terms are the ones published at the canonical source. See `LICENSE`.

---

## ภาษาไทย

**สกิลทำคลิปโปรโมตแอปจากโค้ดจริง เป็นไฟล์ HTML ไฟล์เดียวที่เล่นเหมือนวิดีโอ** ไม่ต้องติดตั้งอะไร เปิดไฟล์ กด Play แล้วอัดจอได้เลย

- **คลิปตัวอย่าง 4 แบบ** แพลน/ราคา, โปรโมตฟีเจอร์แบบเรียบ, โปรโมตตัดตามบีต, และคลิปใช้ UI จริง เอาไว้ยืมท่าและจังหวะ
- **เสียงไม่ใช่แค่บี๊บ** มีดนตรีรองสังเคราะห์ (คอร์ด เบส กลอง เงียบก่อนจังหวะใหญ่) เสียงแยกตามประเภทการกระทำ หรือฝังไฟล์เสียงของเราเองลงในคลิป ปุ่มปิดเพลงกับเอฟเฟกต์แยกกัน
- **พิมพ์แค่ "ทำ Motion Graphic ให้หน่อย สั้นๆ"** สกิลจะถามไฟล์โปรเจกต์ก่อน อ่านโปรเจกต์ แล้วถามเป็นการ์ดสั้นๆ แบบคลิกเลือก (ตัวที่แนะนำอยู่ช่องแรก): เลือก 1 ใน **6 แบบ** (ตัวเลขตัดตามบีต, โชว์ฟีเจอร์, จองคิว, เมนู + สั่ง, ร้านค้า, ระบบหลังบ้าน) → ความยาว อัตราส่วน หน้าตา และ **เฟรมเรต + อุปกรณ์** → ใช้เทมเพลตแบบไหน เพลง ซับ
- **สีแบรนด์ของเรา กับหน้าตาแบบไหนก็ได้** หน้าตา (มืด, สว่าง, โปสเตอร์, พาสเทล) กำหนดทรงและจังหวะการขยับ ส่วนสีกับฟอนต์ดึงจากโปรเจกต์ของเรา ทั้งเว็บ โค้ดแอป (ตัวแปร CSS, tailwind, ไฟล์ theme) หรือโลโก้ SVG มีแถบสีให้ดูก่อน พร้อมเช็กว่าตัวหนังสืออ่านออก
- **ใส่วิดีโอผลงานของเราในคลิปได้** ทำ showreel/พอร์ต: `clips.js` ดูทั้งแฟ้มวิดีโอพร้อมภาพตัวอย่างในไม่กี่วินาที (ไม่เปิดไฟล์ทั้งไฟล์) ตัดเฉพาะช่วงที่เลือก แล้ววิดีโอเล่นในกรอบตามเวลาคลิป ลากแถบ/วนลูป/ส่งออก MP4 ตรงเฟรม
- **ตรวจบั๊กเองหลังส่งงาน** ส่งคลิปให้ดูก่อน แล้ว `qa.js` ตรวจละเอียดต่อทันที ทั้งภาพทุก 0.25 วิ ทุกอัตราส่วน, timeline, เสียง และตัวเล่นทั้งบนคอมกับมือถือ รายงานบั๊กพร้อมเวลาในคลิปและภาพ แก้แล้วส่งตัวแก้ให้
- **ใช้ UI จริง ไม่ใช่ภาพแคปจอ** ดึงการ์ด ปุ่ม แผง มาจากโค้ดแอปทีละชิ้น แล้วขยับตามการทำงานจริงของแอป
- **ตัดตามเพลงของเราเอง** ส่งไฟล์เพลงมา `beats.js` จะหาจังหวะ ทุกบีต ต้นห้อง และจุดดรอปให้ คัตลงบีตจริงของเพลง (เพลงเปลี่ยนจังหวะกลางเพลงก็ตามได้) ช็อตเด็ดลงตรงดรอป และเลือกท่อนเพลงให้พอดีความยาวคลิป มีไฟล์เสียงคลิกไว้ฟังเช็กว่าตรงบีตไหม
- **ซับอธิบายโมชัน** ช็อตละบรรทัด สำหรับคนดูแบบปิดเสียง มี 3 หน้าตา (กล่องดำ, ตัวขาวขอบดำ, แถบสีแบรนด์) วางบนหรือล่างได้ ไม่ทับปุ่ม TikTok / Reels และได้ไฟล์ .srt ด้วย
- **ใช้เทมเพลตได้ 3 แบบ** ใช้ตรงเป๊ะ, ใช้แค่โครง หรือเอาแค่ฟีล
- **โลโก้แยกทีละตัวอักษร** ไฟล์ SVG ถูกแยกเป็นชิ้นให้ขยับตอนเปิด/ปิดคลิป (แม้ตัวหนังสือจะเป็นเส้นเดียวกันทั้งคำ สระ/วรรณยุกต์ไทยติดไปกับตัวอักษร) มีภาพตัวอย่างใส่เลขไว้ตกลงกันว่าชิ้นไหนขยับด้วยกัน
- **ตัวเล่นครบ** แถบเวลา บท เฟรม 120/60/30/24 ปุ่มเปิด/ปิดซับ (CC) **เส้นเขตปลอดภัย TikTok / Reels / Shorts** เต็มจอ คีย์ลัด เสียงเอฟเฟกต์สร้างจากโค้ด
- **มู้ดเพลง 10 แบบ** สังเคราะห์จากโค้ด (มันส์แบบคอนเสิร์ต, คาเฟ่ร้านอาหาร, น่ารักแบบสัตว์เลี้ยง, lo-fi, หรูหรา…) สกิลจะเสนอ 3 แบบที่เข้ากับงาน + ตัวเลือก "ใช้เพลงของฉัน" ตัวแนะนำอยู่ช่องแรก และเรียบเรียงเพลงตามช็อตของคลิป (เปิดเบา กลองส่ง พีคตรงช็อตเด็ด คอร์ดปิดตอนโลโก้)
- **ไม่มีเรฟ? ดูตัวอย่างได้** ตอบ "ดูตัวอย่าง" สกิลจะส่งคลิปตัวอย่าง 8 อันให้ดูทีละไฟล์ ชอบอันไหนเลือกเป็นเทมเพลตได้เลย · เสียงไม่รก ไม่ใช่ทุกท่าต้องมีเสียง และเสียงกริ้งไม่ซ้อนกัน
- **ทรานซิชันแบบที่คนตัดต่อใช้กัน** zoom blur (เรเดียลเบลอ), spin blur, fast box blur ทิศไหนก็ได้, กลิตช์, light leak (วาปแสง), เลนส์แฟลร์, film burn, หมึกไหล, มาสก์รูปทรง, พลิกการ์ด 3D, แผงแบ่งจอ, ฉากในตัวหนังสือ (track matte), พับมุมกระดาษ มีโมชันเบลอจริงและเสียงของแต่ละแบบ
- **ภาษากล้อง** ขนาดช็อตตั้งแต่ไกลสุดถึงโคลสอัพสุด, มุมต่ำ/สูง/นก/หนอน/เอียง, dolly, truck, crane, orbit, dolly zoom, crash zoom, rack focus, กล้องลากยาวไม่ตัด และ **กล้องถือมือ** สั่นแบบธรรมชาติ (ถือเฉยๆ, เดิน, วิ่งเข้าไปซูม, กระแทก, สะบัดกล้องแบบคน)
- **ขยับแบบมีชีวิต** ย่อตัวก่อนกระโดด, บีบ-ยืด, เคลื่อนเป็นโค้ง, ส่วนห้อยแกว่งตาม, หายใจ/กะพริบตา, หุ่นตัดกระดาษ, อนุภาค (คอนเฟตติ ประกาย ฝุ่น เศษ), ก้อนเหลว, ตัวหนังสือวิ่งตามเส้น, ตัวหนังสือ 3D, เรืองแสง, แสงเงาเคลื่อน, เกรดสี, มือถือ/แท็บเล็ต/แล็ปท็อป พร้อมเคอร์เซอร์หรือนิ้วแตะ
- **เช็กงานตัวเอง** `check.js` แคปทุกบท เทียบภาพตอนลากไปข้างหน้ากับลากย้อน และหา error ก่อนเริ่มจะเช็กเครื่องเองเงียบๆ ว่ามีอะไรบ้าง แล้วเลือกทางที่ใช้ได้ ไม่ต้องให้เราติดตั้งอะไรเพิ่ม
- **ส่งออกแบบเฟรมเป๊ะ (ถ้าต้องการ)** `render.js` ได้ MP4 พร้อมเสียง, วิดีโอพื้นใสสำหรับ After Effects / Premiere, GIF, ไฟล์ซับ .srt
- **บอกตรงๆ เมื่อทำไม่ได้** เช่นตัวละครขยับปาก ถ่ายหรือสร้างวิดีโอใหม่ 3D สมจริง แล้วเสนอทางที่ใกล้ที่สุดให้

ติดตั้ง: อัปโหลดโฟลเดอร์นี้เป็น zip ในหน้าตั้งค่าสกิลของ Claude หรือคัดลอกไปไว้ที่ `~/.claude/skills/` ถ้าใช้ Claude Code

เครดิต: คิดและกำกับโดย **QunX** · สร้างด้วย Claude · ไลเซนส์ QunX Motion License (ใช้ทำคลิปได้ฟรี แก้/fork/แปลได้ แจกต่อได้ต้องคงเครดิต ไฟล์ LICENSE และ Canonical Source ห้ามขายตัวสกิลหรือสกิลที่ดัดแปลง) ดู `LICENSE`
