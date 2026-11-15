# Promo video (30 s, 120 BPM)

A 30-second promo built from code, with an original phonk-style beat. Every cut sits on a 120 BPM grid (a beat every 0.5 s), so any 120 BPM song also fits.

| Time | Shot |
|------|------|
| 0–4 s | Side shot, camera on the right: a white 3D stickman wearing AstraSight glasses pushes off the smart handrails and drifts diagonally left, away from the camera |
| 4–7 s | Bass drop and hyper-zoom on his hand at rail **3B**, with car-edit strobe readouts on the beat: rail linked to the lens, push-off force, grip force against his pre-flight baseline, heart rate (PPG), skin conductance (EDA) |
| 7–11 s | Locked-off back shot: he floats to the hatch, it opens on an observation window, and a reticle locks onto a small light far out in space |
| 11–14 s | **Solar flare:** the light flares white-orange and the station goes to red alert. The lens HUD shows "SOLAR FLARE · SHELTER IN 02:40" counting down, the alarm beeps (beep-beep-beep for 3 s), he breathes hard and looks around, and the camera pushes in |
| 14–16 s | Warp zoom into the flare, white flash |
| 16–17 s | Black, total silence |
| 17–28 s | The real website, recorded with Playwright: a HUD heart-rate alert, "status report" typed to ASTRA, the real solar-flare shelter countdown and ASTRA's critical alert on the EVA HUD, Suit check NO-GO, the Medical bay (CMO) |
| 28–30 s | Static title card with the "Concept prototype · Simulated data · Not a medical device" line |

The handrail readouts follow [docs/research/smart-handrails.md](../docs/research/smart-handrails.md). The 02:40 shelter countdown matches what `report.html` shows in its "Solar radiation spike" scenario. All numbers are simulated.

## Build it

From the repo root, with the site served as static files (no `/api`, so no ElevenLabs credits are used):

```sh
pip install playwright imageio-ffmpeg && playwright install chromium
python -m http.server 8765 --bind 127.0.0.1      # in another terminal
python video/capture_site.py                      # records the website shots → video/build/site/
python video/render.py --stills 0                 # writes build/cues.json (the sound cues)
python video/make_audio.py                        # sound effects → build/promo-sfx.wav
python video/make_music.py                        # beat → build/promo-music.wav, mix → build/promo-mix.wav
python video/render.py                            # → build/promo.mp4, promo-nomusic.mp4, promo-silent.mp4
```

`python video/render.py --stills 2 4.6 12.6` saves single frames to `video/build/stills/` for checking. To preview in the browser, open `http://127.0.0.1:8765/video/promo.html?play` and click (it plays the effects track). Add `?t=12.6` to jump to one frame.

## Outputs (`video/build/`, gitignored)

| File | What |
|------|------|
| `promo.mp4` | The video with the beat and the sound effects |
| `promo-nomusic.mp4` | The sound effects only, for adding your own song |
| `promo-silent.mp4` | No audio |
| `promo-music.wav` / `promo-sfx.wav` / `promo-mix.wav` | The stems and the mix |

## Files

- `promo.html`: the whole timeline. Key times are constants at the top (`BPM`, `T_FLARE`, `T_WARP`, `T_BLACK`, `T_SITE`, `T_TITLE`). It also holds the three.js scene, the overlays, the website edit `SITE_EDL`, the captions and the title card. `PROMO.seek(t)` draws one frame, and `PROMO.cues` lists the sound cues.
- `capture_site.py`: drives `interface.html` and `report.html` (segments `hud`, `eva`, `suits`, `medical`, `solar`). It writes screenshots plus `manifest.json` with timestamps. Pass segment names to re-record only those, for example `python video/capture_site.py http://127.0.0.1:8765 solar`.
- `make_audio.py`: every sound effect, synthesized with numpy:
  - station hum, whooshes, rail chirps, the bass drop and strobe hits;
  - the hatch;
  - the flare: boom, three-beep alarm, heavy helmet-mic breathing;
  - the warp, the silence, the UI power-up, punch hits, typing and the final hit.
- `make_music.py`: an original 120 BPM phonk-style beat. It has an 808 cowbell melody in F minor with a 3-3-2 rhythm, a distorted 808 bass, a kick, a clap and hi-hats. It follows the arrangement:
  - a filtered intro;
  - the drop at 4 s;
  - a breakdown to a drone and a heartbeat kick under the alarm;
  - an accelerating snare roll into the warp, then silence;
  - the full beat back at 17 s, and a final 808 on the title.

  It then mixes in the effects, ducking the beat under the alarm.
- `render.py`: renders each frame in headless Chromium (on the GPU through ANGLE when available) and encodes H.264 with the ffmpeg binary from `imageio-ffmpeg`.
- `PROMPT.md`: the same video as a shot-by-shot prompt for a text-to-video AI.

## Using a different song

Use `promo-nomusic.mp4`. Pick a track at **120 BPM** (or 60 or 240) and line its drop up with **4.0 s**. Mute the song from **16.0 to 17.0 s**, bring it back in at **17.0 s**, and hit the last beat at **28.0 s**. For a song at another tempo, change the times in `promo.html` and re-render. Check the license before posting a commercial track publicly.
