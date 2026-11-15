# Promo video (30 s)

A 30-second promo built from code. There's no music, so you can add a song in your editor. The shots:

| Time | Shot |
|------|------|
| 0–4 s | Side shot, camera on the right: a white 3D stickman wearing the AstraSight helmet pushes off the smart handrails and drifts diagonally left, away from the camera |
| 4–7 s | Hyper-zoom on his hand at rail **3B**, with car-edit strobe readouts: rail linked to the helmet, push-off force, grip force against his pre-flight baseline, heart rate (PPG), skin conductance (EDA) |
| 7–12 s | Locked-off back shot: he floats to the hatch, it opens on an observation window, and a reticle locks onto a small cyan light far out in space |
| 12–14 s | Warp zoom into the light, white flash, then hard silence |
| 14–15 s | Black, silent |
| 15–26 s | The real website, recorded with Playwright: a HUD heart-rate alert, "status report" typed to ASTRA, the EVA HUD under heavy exertion, Suit check NO-GO, the Medical bay (CMO) |
| 26–30 s | Title card, with the "Concept prototype · Simulated data · Not a medical device" line |

The handrail readouts follow [docs/research/smart-handrails.md](../docs/research/smart-handrails.md) (load cell, PPG, EDA, temperature, compared to a personal baseline). All numbers are simulated.

## Build it

From the repo root, with the site served as static files (no `/api`, so no ElevenLabs credits are used):

```sh
pip install playwright imageio-ffmpeg && playwright install chromium
python -m http.server 8765 --bind 127.0.0.1      # in another terminal
python video/capture_site.py                      # records the website shots → video/build/site/
python video/render.py --stills 2 4.6 11.8        # optional: check frames → video/build/stills/
python video/make_audio.py                        # needs build/cues.json, which render.py writes first
python video/render.py                            # → video/build/promo.mp4 (+ promo-silent.mp4)
```

Order on a fresh clone: `capture_site.py`, then `render.py --stills 0` (writes `cues.json`), then `make_audio.py`, then `render.py`.

To preview in the browser, open `http://127.0.0.1:8765/video/promo.html?play` and click. Add `?t=11.8` to jump to one frame.

## Files

- `promo.html`: the whole timeline (three.js scene, overlays, the website edit `SITE_EDL`, captions, title card). `PROMO.seek(t)` draws one frame, and `PROMO.cues` lists the sound cues.
- `capture_site.py`: drives `interface.html` and `report.html` and writes screenshots plus `manifest.json` with timestamps. Add a second argument to re-record one segment, for example `python video/capture_site.py http://127.0.0.1:8765 medical`.
- `make_audio.py`: synthesizes every sound effect with numpy (station hum, whooshes, rail chirps, bass drop, strobe hits, hatch, warp, silence, UI power-up, punches, typing, final hit). The mix peaks at −3 dBFS to leave room for music.
- `render.py`: renders each frame in headless Chromium (GPU through ANGLE when available) and encodes H.264 with the ffmpeg binary from `imageio-ffmpeg`.
- `build/` is gitignored.

## Adding the song

The cuts land on 4.0 s (bass drop), 7.0, 12.0 (warp), 14.0 (silence), 15.0 (website), and 26.0 (title hit). Put the track's drop at 4.0 s and mute it from 14.0 to 15.0. The SFX stem is `build/promo-sfx.wav`, if you want to mix it under the music.
