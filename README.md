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

The site is static, with no build step. Voice input needs a secure origin, so serve it from localhost instead of opening the files directly:

```sh
npx serve .              # or: python -m http.server 8000
```

Then open the localhost URL it prints.

Voice recognition uses the Web Speech API, which works in Chrome and Edge. In any browser you can type commands or click the suggestion chips instead. Press **V** on the interface page to start talking.

## Try these commands

- "VEGA, run a full scan"
- "Show my heart rate" / "What's my oxygen?"
- "Move panel left" / "Hide panel" / "Show panel"
- "Breathing exercise"
- "Simulate emergency", then "Acknowledge"
- "Help"

## Structure

```
css/styles.css   shared design system
js/data.js       diagnostic tool registry (ranges, sensors, copy)
js/common.js     nav and footer, starfield, scroll reveal, sparklines
js/vega.js       VEGA intent parser and speech in/out
js/hud.js        interface page controller
js/tools.js      diagnostics demo stage
media/           put tool demo videos here (see media/README.md)
```

All health data is simulated. This is a concept prototype, not a medical device.
