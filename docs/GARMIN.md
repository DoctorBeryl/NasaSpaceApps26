# Live readings from a Garmin watch

The HUD (`interface.html`) can show real readings from a Garmin Forerunner 255 instead of simulated ones. Readings without a live source stay simulated, and if the watch goes quiet for 15 seconds, the HUD goes back to the simulation. Demo overrides (sliders, "simulate emergency") still win over live values, so the scripted demo works with a watch on.

There are two ways in. Both start from the watch button in the HUD panel header.

| | Bluetooth broadcast | AstraLink app |
|---|---|---|
| Watch code needed | No | Yes (`garmin/AstraLink`) |
| Readings | Heart rate (HRV only if the device sends beat intervals; Garmin's broadcast usually doesn't) | Heart rate, HRV (RMSSD), SpO₂, breathing rate, stress, plus body battery and steps |
| Path | Watch → Web Bluetooth in the browser | Watch → phone (Garmin Connect) → `POST /api/watch` → page polls `GET /api/watch/<code>` |
| Needs | Chrome or Edge, localhost or https, Bluetooth on the computer | The phone paired with the watch and the Garmin Connect app running; the server reachable over **https** |

## Which tool each reading feeds

| Watch | HUD tool (`TOOLS` id) | Note |
|---|---|---|
| Optical heart rate | Cardiac rhythm (`cardio`) | live, 1 Hz |
| RMSSD from beat intervals | Stress / HRV (`hrv`) | last ~40 beats, jumps over 20 % skipped |
| Pulse Ox | Blood oxygen (`spo2`) | live if the sensor gives it, else the newest stored reading under 30 min old |
| Respiration rate | Respiration (`resp`) | |
| Garmin stress score (0–100) | Cognitive load (`cog`) | a stand-in: both are 0–100, higher means more strained |

The watch's temperature sensor measures the wrist and the air around it, not core temperature, so Core thermal stays simulated. Pupillometry and radiation have no watch source.

ASTRA's chat context labels live readings ("live from the crew member's watch Pulse Ox"), so the model knows which readings are real.

## Option 1: Bluetooth broadcast (2 minutes, no code)

1. On the watch: hold **UP** › Settings › Wrist Heart Rate › **Broadcast Heart Rate**.
2. Open `interface.html` in Chrome or Edge, click the watch button, then **Connect over Bluetooth**, and pick the watch.

## Option 2: the AstraLink watch app

### One-time setup
1. Install the [Connect IQ SDK Manager](https://developer.garmin.com/connect-iq/sdk/). Sign in, download the latest SDK and the **Forerunner 255** device.
2. In VS Code, install the **Monkey C** extension, then run **Monkey C: Generate a Developer Key**. Keep the key outside the repo. `*.der` is gitignored anyway: never commit it.
3. Set the server address in `garmin/AstraLink/resources/settings/properties.xml` (`serverUrl`). The default is the team's live server, which already has `/api/watch`. Use **https**: Garmin Connect on iOS refuses plain http. To use a laptop instead, run `node server.js` and `cloudflared tunnel --url http://localhost:8000`, then paste the `https://….trycloudflare.com` URL (no trailing slash).

### Build
From `garmin/AstraLink`:

```sh
monkeyc -d fr255 -f monkey.jungle -o bin/AstraLink.prg -y <path-to>/developer_key.der
```

In VS Code you can use **Monkey C: Build for Device** instead. Other products in the manifest: `fr255m`, `fr255s`, `fr255sm`.

### Try it in the simulator first (no watch needed)
Run `connectiq` (it opens the simulator), then `monkeydo bin/AstraLink.prg fr255`. The simulator uses the computer's network, so `serverUrl` can be `http://localhost:8000` there. In the simulator, set sensor data with Simulation › Data Simulation.

### Put it on the watch
1. Connect the watch over USB. It mounts as a drive called `GARMIN`.
2. Copy `bin/AstraLink.prg` to `GARMIN/APPS/`, then eject the watch.
3. On the watch, open the apps list (press **START** on the watch face, or Activities & Apps) and start **AstraLink**.

### Run the demo
1. Keep the phone nearby with Bluetooth on and Garmin Connect open.
2. The watch shows your heart rate, SpO₂ / HRV / breathing, a **pair code** (6 characters, kept between runs) and a status line. "Live · 12" means 12 readings were accepted.
3. On the HUD, click the watch button, type the pair code, and press **Pair**. Within a few seconds the panel says `LIVE · FORERUNNER 255 · 5 OF 8 READINGS`, and live cards get a green **LIVE** tag. The page remembers the code.
4. Press **START** on the watch to send at once. **BACK** exits the app, and the HUD goes back to simulated readings after 15 s.

HRV needs about 10 beats before it appears. SpO₂ may show `--` until Pulse Ox has a reading. Turn Pulse Ox on in the watch's settings to get one sooner.

### Watch status messages

| Status | Meaning |
|---|---|
| No phone link | The watch isn't connected to the phone over Bluetooth, or Garmin Connect is closed |
| Needs https URL | `serverUrl` is http and the phone refuses it (error -1001) |
| Server timeout | The phone couldn't reach the server (error -300). Check the URL and that the server is up |
| Error 404 | The server doesn't have `/api/watch` yet (old deploy) |
| Waiting for HR | No heart-rate reading yet: wear the watch snugly |

## Server API (`server/watch.js`)

- `POST /api/watch` takes `{ code, hr, hrv, spo2, resp, stress, bodyBattery, steps, battery, device }`. `code` is 6 characters, A–Z and 0–9. Values outside physical ranges are dropped. It returns `{ ok: true }`, or `400` / `429`.
- `GET /api/watch/<code>` returns `{ connected, ageMs, data }`.
- Readings are kept in memory only (never on disk) and expire after 10 minutes, for at most 200 codes. Each code may post 60 times a minute.
- The pair code is the only thing tying a page to a watch. Anyone who knows a code can read it or post to it. That's fine for a demo with simulated-grade data, but don't treat it as authentication.

Test without a watch:

```sh
curl -X POST localhost:8000/api/watch -H "Content-Type: application/json" -d '{"code":"TEST42","hr":131,"spo2":96,"hrv":41}'
```

Then pair the HUD with `TEST42`. Readings go stale after 15 s, so repeat the request in a loop.

## Not done yet
- `report.html` still uses its own simulation. It could read `AstraWatch.get("cardio")` and the others the same way the HUD does.
- The app was written against the Connect IQ API (min API 3.3.0) without an SDK on the authoring machine. The first build may need small fixes; the compiler errors point at the line.
