# AstraSight promo: full video prompt

This prompt is for a text-to-video AI (Veo, Sora, Kling, Runway). It describes the same 30-second video that `video/promo.html` renders, so an AI version stays consistent with ours.

**How to use it:** these tools make clips of about 5–10 s, so generate **one shot at a time**. Paste the **Shared style** block at the start of every shot prompt, word for word, so the character and station look the same in every clip. Put the numbers, captions, and title on top in your editor (CapCut, Premiere, DaVinci), because AI video garbles text. Don't generate the website: screen-record the real site, or use `video/build/site/` frames.

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

## Shot 1: the push-off (0:00–0:04, about 4 s)

```
[Shared style] The camera is locked off on the right side of the corridor, near the entrance, at chest
height, with a very slight handheld drift. The stickman starts close to camera-left and floats diagonally
left and away from the camera, deeper into the corridor, heading toward the left wall. His body is angled
head-first and slightly upward like he is swimming through the air, chest turned toward the left wall,
legs trailing loosely. He pulls and pushes off the glowing handrails on the left wall hand over hand,
three times: each time his hand closes on a rail, that rail's cyan sensor band flashes bright white-cyan,
then he pushes off and glides to the next. The round hatch glows small at the far end.
```

## Shot 2: the hand close-up (0:04–0:07, about 3 s)

```
[Shared style] Start wide on the handrail on the left wall, then an extremely fast push-in (hyper-zoom)
in a fraction of a second, ending on a close-up of the stickman's white hand gripping the rail, in slow
motion. A small square label plate on the wall beside the rail glows cyan. The rail's sensor band glows
brighter as the fingers close around it, and thin light pulses run along the rail toward the wall. His
forearm and the cyan glow of his helmet display are visible, soft and out of focus, at the edge of the frame.
Shallow depth of field, punchy contrast, a little camera shake on the impact.
```

**Add in the edit, one per beat, each with a 2-frame white flash and an RGB split** (big in the center for a moment, then docking into a column on the right):

| Time | Label | Value | Small line |
|------|-------|-------|------------|
| 4.48 s | RAIL 3B · NODE 2 | LINKED → HELMET | LOAD CELL · PPG · EDA · TEMP |
| 4.98 s | PUSH-OFF FORCE | 184 N | |
| 5.48 s | GRIP FORCE | 31 kgf | −6 % VS PRE-FLIGHT BASELINE |
| 5.98 s | HEART RATE · PPG | 96 bpm | |
| 6.48 s | SKIN CONDUCTANCE | 2.4 µS | STRESS TREND: NORMAL |

Keep a small **SIMULATED DATA** tag in the corner throughout this shot. Add a cyan/pink targeting reticle locked onto the hand.
*Why these values:* a handrail can measure grip force (load cell), pulse (PPG, one hand), skin conductance (EDA, stress), and skin temperature, always against the astronaut's own pre-flight baseline. Don't show weight: in microgravity nothing has weight.

## Shot 3: the back shot (0:07–0:12, about 5 s)

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

**In the edit:** at 11.05 s, a small rotating cyan/pink reticle locks onto the distant light. In the top-left corner, type out: `NODE 2 · ARTEMIS-HAB 04` / `MET 003:14:22:41` / `HANDRAILS LIVE · HELMET ONLINE`.

## Shot 4: the warp (0:12–0:14, about 2 s)

```
[Shared style] From the back shot, the camera accelerates forward, rushes past the stickman's shoulder,
through the open hatch and the window, and flies out into space toward the tiny cyan light. The stars
stretch into long radial streaks of light, the field of view widens, and the cyan light grows until it
fills the whole frame and blooms into pure white.
```

**In the edit:** fade to full white between 12.9 and 13.5 s, then at 14.0 s **hard cut to black and total silence** for exactly 1 second.

## Shots 5–9: the real website (0:15–0:26, about 11 s)

Not AI-generated: screen-record the AstraSight site at 1920×1080, then add fast zoom punches with a short white flash and RGB split on each cut, plus a caption box (small pink label in a pixel font over a bold white line).

| Time | Page and action | Zoom on | Caption (label / line) |
|------|-----------------|---------|------------------------|
| 15.0–16.15 | `interface.html` turns on like an old CRT (a horizontal cyan line opens into the picture) | full HUD | |
| 16.15–17.45 | Heart-rate slider pushed to 128 → ASTRA's popup "Heart rate too high · Step 1 of 3: Stop exercise or heavy work and rest for five minutes" | the popup | INTERFACE · VISOR HUD / ASTRA flags a reading the moment it drifts |
| 17.45–18.35 | Vitals panel: "1 reading needs attention", Cardiac Rhythm climbing past 110 bpm | summary + heart card | (same) |
| 18.35–20.05 | Type "ASTRA, status report" → ASTRA answers | command box and reply | ASK ASTRA / Speak or type: "status report" (caption at the top) |
| 20.05–22.15 | `report.html?view=eva`: click **Heavy exertion** → heart rate 148, core temp 37.9, metabolic load 412 W, ASTRA caution | scenario row, then the vitals row | REPORT · EVA HUD / Heavy exertion: heart rate, heat and CO₂ climb |
| 22.15–24.35 | `report.html?view=suits`: break EMU-1's primary O₂ sensor (Impossible reading) → **NO-GO**; Eng. ASTRA: "Swap to EMU-4, which passes its life-support checks" | EMU-1 card, then ASTRA's bubble | SUIT CHECK / A failed life-support sensor means NO-GO |
| 24.35–26.0 | `report.html?view=medical&role=cmo`: whole-crew body map and Dr. ASTRA's crew-wide patterns | the patterns panel | MEDICAL BAY · CMO / Crew-wide patterns go to the flight surgeon |

## Shot 10: title card (0:26–0:30)

Dark navy background (#040912) with a faint cyan grid fading out toward the edges. On a clean bass hit with a white flash:

- small pink pixel-font line: **NASA SPACE APPS CHALLENGE 2026**
- the AstraSight helmet logo + **AstraSight** (large, bold, white)
- **Your health, in your line of sight.** (cyan)
- *Health monitoring for astronauts · smart helmet, smart handrails and ASTRA, the on-board assistant*
- bottom, small amber: **CONCEPT PROTOTYPE · SIMULATED DATA · NOT A MEDICAL DEVICE**

Fade to black over the last half second.

---

## Sound plan (no music in the prompt; add your song in the edit)

| Time | Sound |
|------|-------|
| 0–14 s | Low station hum and air handling, quieter in the back shot |
| each grab in shot 1 | Soft clack plus a short rising sensor chirp, then a whoosh panned left |
| 3.1–4.0 s | Riser |
| **4.0 s** | **Bass drop**: sub boom plus impact, with a fast zoom whoosh. Put the song's drop here. |
| 4.48, 4.98, 5.48, 5.98, 6.48 s | Strobe hits: camera-shutter click, digital blip, small thump, one per readout |
| 7.0 s | Big whoosh on the cut |
| ~9.6 s | Hatch: metal clunk, then pneumatic hiss and servo whine |
| 11.05 s | Soft shimmering tone as the reticle locks onto the light |
| 12.0–14.0 s | Warp riser: noise and a rising tone that widen and build |
| **14.0–15.0 s** | **Total silence** (mute the song too) |
| 15.0 s | UI power-up beep |
| each website cut | Punch hit, with a soft data texture under the section |
| 16.2 s / 22.2 s | Alert chime / NO-GO alarm |
| 18.4–19.3 s | Keyboard typing, then a confirm blip |
| **26.0 s** | **Final bass hit** with a shimmer tail on the title card |

Suggested song: a fast cyberpunk-phonk track. If it's a commercial track, check the license before posting the video publicly.
