# AstraSight promo: full video prompt

This prompt is for a text-to-video AI (Veo, Sora, Kling, Runway). It describes the same 30-second video that `video/promo.html` renders, so an AI version stays consistent with ours. **Tempo: 120 BPM.** Every cut lands on a beat (0.5 s), so the song locks to the edit.

**How to use it:** these tools make clips of about 5–10 s, so generate **one shot at a time**. Paste the **Shared style** block at the start of every shot prompt, word for word, so the character and station look the same in every clip. Put the numbers, the HUD alarm, the captions and the title on top in your editor (CapCut, Premiere, DaVinci), because AI video garbles text. Don't generate the website: screen-record the real site, or use `video/build/site/` frames.

---

## Shared style (paste first in every shot)

```
Style: clean stylized 3D render, cinematic, high contrast, 16:9, subtle film grain, light letterbox bars.
Character: a sleek matte-white 3D stickman astronaut with smooth rounded limbs and a round head, no face,
wearing a clear bubble helmet with a small soft-cyan (#00f0ff) display glowing inside the visor.
Setting: a futuristic space-station corridor with an octagonal cross-section: grey-white wall panels
with thin dark gaps between them, darker metal rib frames every two metres, white ceiling light panels,
thin glowing cyan light strips along the upper corners, occasional magenta strips low on the walls,
dark lockers with tiny green and amber status LEDs. Short dark metal handrails line the walls; each
handrail has a glowing cyan sensor band in the middle and a soft cyan glow strip on the wall behind it.
At the far end of the corridor: a round airlock hatch in a bulkhead, with a glowing cyan ring and a ring
of small amber lights around it.
Microgravity: everything floats; no one walks; motion is smooth and weightless.
No text, no letters, no numbers anywhere in the frame.
```

---

## Shot 1: the push-off (0:00–0:04, 8 beats)

```
[Shared style] The camera is locked off on the right side of the corridor, near the entrance, at chest
height, with a very slight handheld drift. The stickman starts close to camera-left and floats diagonally
left and away from the camera, deeper into the corridor, heading toward the left wall. His body is angled
head-first and slightly upward like he is swimming through the air, chest turned toward the left wall,
legs trailing loosely. He pulls and pushes off the glowing handrails on the left wall hand over hand,
three times: each time his hand closes on a rail, that rail's cyan sensor band flashes bright white-cyan,
then he pushes off and glides to the next. The round hatch glows small at the far end.
```

## Shot 2: the hand close-up (0:04–0:07, on the drop)

```
[Shared style] Start wide on the handrail on the left wall, then an extremely fast push-in (hyper-zoom)
in a fraction of a second, ending on a close-up of the stickman's white hand gripping the rail, in slow
motion. A small square label plate on the wall beside the rail glows cyan. The rail's sensor band glows
brighter as the fingers close around it, and thin light pulses run along the rail toward the wall. His
forearm and the cyan glow of his helmet display are visible, soft and out of focus, at the edge of the frame.
Shallow depth of field, punchy contrast, a little camera shake on the impact.
```

**Add in the edit, one per beat, each with a 2-frame white flash and an RGB split** (big on the left for a moment, then docking into a column on the right):

| Time | Label | Value | Small line |
|------|-------|-------|------------|
| 4.5 s | RAIL 3B · NODE 2 | LINKED → HELMET | LOAD CELL · PPG · EDA · TEMP |
| 5.0 s | PUSH-OFF FORCE | 184 N | |
| 5.5 s | GRIP FORCE | 31 kgf | −6 % VS PRE-FLIGHT BASELINE |
| 6.0 s | HEART RATE · PPG | 96 bpm | |
| 6.5 s | SKIN CONDUCTANCE | 2.4 µS | STRESS TREND: NORMAL |

Keep a small **SIMULATED DATA** tag in the corner throughout this shot. Add a cyan/pink targeting reticle locked onto the hand.
*Why these values:* a handrail can measure grip force (load cell), pulse (PPG, one hand), skin conductance (EDA, stress), and skin temperature, always against the astronaut's own pre-flight baseline. Don't show weight: in microgravity nothing has weight.

## Shot 3: the back shot (0:07–0:11)

```
[Shared style] A stationary camera slightly behind and to the right of the stickman, just over his
shoulder; the camera never moves. He glides away down the long corridor toward the round hatch at the
end and gets smaller and smaller. As he arrives, the amber lights around the hatch blink, the hatch's
centre hub turns a quarter turn, and the round door slides sideways into the wall. The lights turn green.
Behind it, a short tunnel leads to a large round observation window looking out on deep black space,
full of stars, with the glowing blue edge of a planet curving across the bottom of the window. He comes
to a stop in front of the window and floats upright and still, arms drifting out at chest height in a
relaxed microgravity posture, silhouetted against space. Far away in space, in the right half of the
window, one tiny cyan point of light glows and pulses gently.
```

**In the edit:** at 10.5 s, a small rotating cyan/pink reticle locks onto the distant light. In the top-left corner, type out: `NODE 2 · ARTEMIS-HAB 04` / `MET 003:14:22:41` / `HANDRAILS LIVE · HELMET ONLINE`.

## Shot 4: solar flare emergency (0:11–0:14, 3 s)

```
[Shared style] Same camera position as the back shot, now pushing in slowly toward the stickman. The tiny
light far out in space suddenly flares into a blinding white-orange burst with a long horizontal lens
streak; warm light floods through the observation window and backlights him. A shockwave of light jolts
the camera. The station goes to red alert: the cyan light strips turn red and every corridor light
pulses red in a fast rhythm, three pulses and a pause, three pulses and a pause. The stickman flinches,
arms jerking up and out, chest heaving with fast heavy breaths, and he whips his head left, then right,
then up toward the flare, looking around in panic.
```

**In the edit:**
- A red **visor-HUD alarm** sits on the left side of the frame, with red corner brackets at the frame edges. It contains:
  - `⚠ ASTRA · CRITICAL · RADIATION`
  - big **SOLAR FLARE**
  - `PROTON FLUX RISING`
  - **SHELTER IN 02:40**, counting down one second at a time (02:40, 02:39, 02:38)
  - an amber progress bar
  - *Reach the storm shelter before this reaches zero.*
- The panel border, the brackets and a red edge vignette blink with each beep.
- The countdown and wording match the real site (`report.html`, "Solar radiation spike").
- Keep the reticle on the flare.

## Shot 5: the warp (0:14–0:16)

```
[Shared style] From the push-in, the camera accelerates forward, rushes past the stickman's shoulder,
through the open hatch and the window, and flies out into space toward the blazing flare. The stars
stretch into long radial streaks of light, the field of view widens, and the flare grows until it
fills the whole frame and blooms into pure white.
```

**In the edit:** fade to full white between 14.9 and 15.5 s, then at 16.0 s **hard cut to black and total silence** for exactly 1 second.

## Shots 6–14: the real website (0:17–0:28)

Not AI-generated: screen-record the AstraSight site at 1920×1080, then add fast zoom punches on each cut (on the beat), with a short white flash and RGB split, plus a caption box (small pink label in a pixel font over a bold white line).

| Time | Page and action | Zoom on | Caption (label / line) |
|------|-----------------|---------|------------------------|
| 17.0–18.0 | `interface.html` turns on like an old CRT (a horizontal cyan line opens into the picture) | full HUD | |
| 18.0–19.5 | Heart-rate slider pushed to 128 → ASTRA's popup "Heart rate too high · Step 1 of 3: Stop exercise or heavy work and rest for five minutes" | the popup | INTERFACE · VISOR HUD / ASTRA flags a reading the moment it drifts |
| 19.5–20.5 | Vitals panel: "1 reading needs attention", Cardiac Rhythm past 110 bpm | summary + heart card | (same) |
| 20.5–22.0 | Type "ASTRA, status report" → ASTRA answers | command box and reply | ASK ASTRA / Speak or type: "status report" (caption at the top) |
| 22.0–23.0 | `report.html?view=eva`, CABIN EXIT, then **Solar radiation spike** → the **SOLAR FLARE 02:38** shelter countdown | the countdown | REPORT · EVA HUD / Solar flare: ASTRA starts the storm-shelter countdown (top) |
| 23.0–24.0 | ASTRA // CRITICAL: "Solar flux spike! Return-to-shelter priority… You have 2 minutes 40 seconds to reach the storm shelter." | ASTRA's bubble | (same) |
| 24.0–25.0 | `report.html?view=suits`: break EMU-1's primary O₂ sensor (Impossible reading) → **NO-GO** | EMU-1 card | SUIT CHECK / A failed life-support sensor means NO-GO |
| 25.0–26.0 | Eng. ASTRA: "Swap to EMU-4, which passes its life-support checks" | ASTRA's bubble | (same) |
| 26.0–28.0 | `report.html?view=medical&role=cmo`: whole-crew body map and Dr. ASTRA's crew-wide patterns | the patterns panel | MEDICAL BAY · CMO / Crew-wide patterns go to the flight surgeon |

## Shot 15: title card (0:28–0:30, 2 s, static)

No animation: everything is on screen from the first frame, on the final bass hit with a short white flash.
Dark navy background (#040912) with a faint cyan grid fading out toward the edges:

- small pink pixel-font line: **NASA SPACE APPS CHALLENGE 2026**
- the AstraSight helmet logo + **AstraSight** (large, bold, white)
- **Your health, in your line of sight.** (cyan)
- *Health monitoring for astronauts · smart helmet, smart handrails and ASTRA, the on-board assistant*
- bottom, small amber: **CONCEPT PROTOTYPE · SIMULATED DATA · NOT A MEDICAL DEVICE**

---

## Music: 120 BPM phonk

Our render includes an original beat (`video/make_music.py`): an 808 cowbell melody in F minor with a 3-3-2 rhythm, a distorted 808 bass, a kick, a clap and hi-hats. If you use another song, pick one at **120 BPM** (or 60 or 240).

| Time | Music |
|------|-------|
| 0–4 s | Intro: filtered cowbell melody and hats, opening up |
| **4.0 s** | **The drop**: full beat |
| 11–14 s | Breakdown under the alarm: a low 808 drone and a heartbeat kick, beat ducked |
| 14–16 s | Accelerating snare roll and riser into the warp |
| **16–17 s** | **Silence** |
| **17.0 s** | Full beat back in for the website |
| **28.0 s** | Final 808 and cowbell hit on the title card |

## Sound effects

| Time | Sound |
|------|-------|
| 0–16 s | Low station hum and air handling |
| each grab in shot 1 | Soft clack plus a short rising sensor chirp, then a whoosh panned left |
| 3.1–4.0 s | Riser |
| 4.0 s | Bass drop: sub boom plus impact, with a fast zoom whoosh |
| 4.5, 5.0, 5.5, 6.0, 6.5 s | Strobe hits: camera-shutter click, digital blip, small thump, one per readout |
| 7.0 s | Big whoosh on the cut |
| ~9.9 s | Hatch: metal clunk, then pneumatic hiss and servo whine |
| 10.5 s | Soft shimmering tone as the reticle locks onto the light |
| **11.0 s** | **Flare**: deep whump and crackle |
| **11.0–14.0 s** | **Alarm**: beep-beep-beep, pause, three times (on the 16th notes) |
| **11.0–14.4 s** | **Heavy breathing** through the helmet mic: fast inhale/exhale, one breath every 0.75 s |
| 14.0–16.0 s | Warp riser |
| 16.0–17.0 s | Total silence |
| 17.0 s | UI power-up beep |
| each website cut | Punch hit, with a soft data texture under the section |
| 18.05 / 22.05 / 24.05 s | Alert chime / critical alarm (solar) / NO-GO alarm |
| 20.6–21.4 s | Keyboard typing, then a confirm blip |
| 28.0 s | Final bass hit with a shimmer tail |
