"""Record the real AstraSight site for the promo video's website section.

Drives interface.html and report.html in headless Chromium, takes screenshots as fast as it can
in real time, and writes video/build/site/<segment>/NNNN.jpg plus manifest.json (each frame's
time in seconds, and the time of each scripted action). promo.html maps video time to these frames.

Usage (from the repo root, with the site served on BASE, for example `python -m http.server 8765`;
add a comma list of segments as a second argument to re-record only those):
    python video/capture_site.py [BASE]
/api/* is blocked, so no ElevenLabs credits or AI calls are used.
"""
import asyncio, json, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765").rstrip("/")
ONLY = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None  # e.g. "medical" to redo one segment
OUT = Path(__file__).resolve().parent / "build" / "site"
W, H = 1920, 1080


class Recorder:
    def __init__(self, page, name):
        self.page, self.name = page, name
        self.dir = OUT / name
        self.dir.mkdir(parents=True, exist_ok=True)
        for f in self.dir.glob("*.jpg"):
            f.unlink()
        self.frames, self.events, self.running = [], {}, False

    async def _loop(self):
        while self.running:
            t = time.perf_counter() - self.t0
            buf = await self.page.screenshot(type="jpeg", quality=92)
            fn = f"{len(self.frames):04d}.jpg"
            (self.dir / fn).write_bytes(buf)
            self.frames.append({"f": f"{self.name}/{fn}", "t": round(t, 3)})

    def start(self):
        self.t0 = time.perf_counter()
        self.running = True
        self.task = asyncio.create_task(self._loop())

    def mark(self, label):
        self.events[label] = round(time.perf_counter() - self.t0, 3)
        print(f"  {self.name}: {label} at {self.events[label]} s")

    async def stop(self):
        self.running = False
        await self.task
        return {"frames": self.frames, "events": self.events}


async def new_page(browser, path):
    page = await browser.new_page(viewport={"width": W, "height": H})
    page.on("pageerror", lambda e: print("  page error:", e))
    await page.route("**/api/**", lambda r: r.abort())
    # No speech in headless anyway; keep VEGA.speak from queueing anything.
    await page.add_init_script("window.speechSynthesis && (window.speechSynthesis.speak = () => {});")
    await page.goto(f"{BASE}/{path}")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(1200)
    return page


async def seg_hud(browser):
    """interface.html: heart rate climbs past the warning line, ASTRA's popup, then a typed status report."""
    page = await new_page(browser, "interface.html")
    rec = Recorder(page, "hud"); rec.start()
    await page.wait_for_timeout(900)
    rec.mark("hr_up")
    await page.evaluate("""() => {
      const s = document.querySelector('.vital[data-id="cardio"] .vslider input');
      s.value = 128; s.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    await page.wait_for_timeout(5200)
    rec.mark("type")
    await page.click("#cmd")
    await page.keyboard.type("ASTRA, status report", delay=55)
    await page.wait_for_timeout(250)
    rec.mark("submit")
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(2600)
    m = await rec.stop(); await page.close(); return m


async def seg_eva(browser):
    """report.html EVA HUD: the Heavy exertion scenario pushes HR, heat and CO2 up."""
    page = await new_page(browser, "report.html?view=eva")
    rec = Recorder(page, "eva"); rec.start()
    await page.wait_for_timeout(700)
    rec.mark("exertion")
    await page.click('[data-scenario="exertion"]')
    await page.wait_for_timeout(5500)
    m = await rec.stop(); await page.close(); return m


async def seg_suits(browser):
    """report.html Suit check: break EMU-1's primary O2 sensor, the suit goes NO-GO."""
    page = await new_page(browser, "report.html?view=suits")
    await page.evaluate("""() => {
      const pick = (id, re) => { const s = document.getElementById(id);
        const o = [...s.options].find(o => re.test(o.textContent) || re.test(o.value)); if (o) s.value = o.value;
        s.dispatchEvent(new Event('change', { bubbles: true })); };
      pick('faultSuit', /EMU-1/); pick('faultSensor', /Primary O/); pick('faultType', /impossible/i);
    }""")
    rec = Recorder(page, "suits"); rec.start()
    await page.wait_for_timeout(700)
    rec.mark("break")
    await page.evaluate("document.getElementById('injectFault').click()")
    await page.wait_for_timeout(5000)
    m = await rec.stop(); await page.close(); return m


async def seg_medical(browser):
    """report.html Medical bay as CMO: whole-crew body map and ASTRA's pattern notes."""
    page = await new_page(browser, "report.html?view=medical&role=cmo")
    rec = Recorder(page, "medical"); rec.start()
    await page.wait_for_timeout(1800)
    rec.mark("scroll")
    await page.evaluate("window.scrollTo({ top: 330, behavior: 'smooth' })")
    await page.wait_for_timeout(3000)
    m = await rec.stop(); await page.close(); return m


async def seg_solar(browser):
    """report.html EVA HUD, outside: Solar radiation spike raises proton flux; ASTRA calls for shelter."""
    page = await new_page(browser, "report.html?view=eva")
    await page.evaluate("document.getElementById('exitButton').click()")
    await page.wait_for_timeout(1500)
    rec = Recorder(page, "solar"); rec.start()
    await page.wait_for_timeout(600)
    rec.mark("solar")
    await page.click('[data-scenario="solar"]')
    await page.wait_for_timeout(7500)
    m = await rec.stop(); await page.close(); return m


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mf = OUT / "manifest.json"
    manifest = json.loads(mf.read_text()) if ONLY and mf.exists() else {"width": W, "height": H, "segments": {}}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name, fn in [("hud", seg_hud), ("eva", seg_eva), ("suits", seg_suits), ("medical", seg_medical), ("solar", seg_solar)]:
            if ONLY and name not in ONLY:
                continue
            print("recording", name)
            manifest["segments"][name] = await fn(browser)
            print(f"  {len(manifest['segments'][name]['frames'])} frames")
        await browser.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("wrote", OUT / "manifest.json")


asyncio.run(main())
