/* Static preview build: copies only the frontend into dist/ for static hosts
   (Cloudflare Pages, GitHub Pages, Netlify). No dependencies.

     node build-static.js        (or: npm run build:static)

   No backend in the preview: sign-in, VEGA's AI and the ElevenLabs voice are off. Pages still
   render, simulated vitals run, rule-based commands work, and VEGA uses the browser voice.
   A real 404.html is written so Cloudflare Pages doesn't serve index.html for /api/* paths
   (its default when there's no 404.html), which would make VEGA think an API is there. */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const PAGES = ["index.html", "interface.html", "tools.html", "vega.html", "report.html", "login.html"];
const DIRS = ["css", "js", "media"];
const SKIP = new Set(["README.md"]);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of PAGES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) {
  if (!fs.existsSync(path.join(ROOT, d))) continue;
  fs.cpSync(path.join(ROOT, d), path.join(OUT, d), {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)),
  });
}

fs.writeFileSync(path.join(OUT, "404.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not found · AstraSight</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070f;color:#cfe8ff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:16px}a{color:#4de1ff}</style>
</head><body><main><h1>Page not found</h1><p><a href="index.html">Back to AstraSight</a></p></main></body></html>
`);

let n = 0;
(function count(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? count(path.join(d, e.name)) : n++; })(OUT);
console.log(`Static preview written to dist/ (${n} files). Upload dist/ or point your host's output directory at it.`);
