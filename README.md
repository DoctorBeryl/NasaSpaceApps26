# AstraSight: Health Optics for Space

Concept website for a space health challenge. AstraSight is a pair of smart glasses with an in-lens health diagnostic HUD (a side panel) and **VEGA**, a voice AI for astronaut health monitoring.

## Pages

| Page | What it shows |
|------|---------------|
| `index.html` | Home page: product overview, the eight diagnostic tools, an introduction to VEGA |
| `interface.html` | Interactive lens HUD with live (simulated) vitals, a side panel that docks or hides, and voice and typed commands |
| `tools.html` | A page for each diagnostic tool with an animated signal, a placeholder slot for demo video, specs, and how it works |
| `vega.html` | The VEGA language model: its pipeline, an intent-parser console, design principles, and a command reference |

## Running it

There's no build step and no dependencies. Run the bundled server (Node 18+), which serves the site and proxies VEGA's voice to ElevenLabs:

```sh
cp .env.example .env     # then put your ELEVENLABS_API_KEY in .env
node server.js           # http://localhost:8000
```

VEGA's AI (onboarding questionnaire, chat, critical-stats brief) runs on **Qwen 2.5 through a local [Ollama](https://ollama.com)**. Install Ollama and run `ollama pull qwen2.5:3b` before starting the server. See [docs/AI-BACKEND.md](docs/AI-BACKEND.md) for the API.

**Crew sign-in** is by face, at `login.html`. New crew enter a name and do a ten-second scan; returning crew just look at the camera. Face recognition runs in the browser (face-api.js), and only 128-number face templates reach the server. Sign-in works with no setup in local mode. Add the `FIREBASE_*` values in `.env` to get real Firebase Auth sessions and Firestore profiles. See [docs/AUTH.md](docs/AUTH.md).

To start Ollama (for VEGA's free-form answers) and the server together, run `npm run dev` (or `node dev.js`) instead. It uses Ollama if it's already running, otherwise starts `ollama serve`, prefixes each process's output, and stops both on Ctrl+C.

The API key is only read by `server.js` and is never sent to the browser. `.env` is git-ignored. Without a key, or with a plain static server (`npx serve .`), VEGA falls back to the browser's built-in voice. Voice input needs a secure origin, so use localhost instead of opening the files directly.

Voice recognition uses the Web Speech API, which works in Chrome and Edge. In any browser you can type commands or click the suggestion chips instead. Press **V** on the interface page to start talking.

## Try these commands

- "VEGA, run a full scan"
- "Show my heart rate" / "What's my oxygen?"
- "Move panel left" / "Hide panel" / "Show panel"
- "Breathing exercise"
- "Simulate emergency", then "Acknowledge"
- "Reset readings" (returns every slider to baseline)

## Reading sliders

Every diagnostic has a slider that runs from dangerously low to dangerously high: red is danger, amber is caution, green is normal. When a reading leaves the green band, VEGA shows a popup that names the problem and lists what to do, and speaks the first step. In the red band, the escalation step comes first. On the lens interface the popup is drawn as see-through light; on the Diagnostics page it's a solid card. With both pages open in tabs of the same browser, moving a slider on one page also moves it on the other.
- "Help"

## Structure

```
css/styles.css   shared design system
js/data.js       diagnostic tool registry (ranges, sensors, copy)
js/common.js     nav and footer, starfield, scroll reveal, sparklines
js/vega.js       VEGA intent parser and speech in/out
js/alerts.js     reading sliders, VEGA warning popups, cross-tab sync
js/hud.js        interface page controller
js/tools.js      diagnostics demo stage
media/           put tool demo videos here (see media/README.md)
server/          VEGA AI backend: Ollama client, onboarding, chat and brief routes, persona.md
backups/         earlier versions of the site, runnable as-is
```

All health data is simulated. This is a concept prototype, not a medical device.
