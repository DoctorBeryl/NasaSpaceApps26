"""Render video/promo.html to an MP4, frame by frame.

    python video/render.py                 # full render: build/promo.mp4 (+ build/promo-silent.mp4)
    python video/render.py --stills 2 4.6 9  # just screenshots at those times, into build/stills/
    python video/render.py --from 4 --to 7   # render part of the timeline (for checking)

The site is served on BASE (default http://127.0.0.1:8765, e.g. `python -m http.server 8765`).
Needs: pip install playwright imageio-ffmpeg, then `playwright install chromium`.
Sound: run make_audio.py after the first render (it reads build/cues.json); this script muxes
build/promo-sfx.wav when it exists.
"""
import argparse, asyncio, json, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

ap = argparse.ArgumentParser()
ap.add_argument("--base", default="http://127.0.0.1:8765")
ap.add_argument("--stills", nargs="*", type=float)
ap.add_argument("--from", dest="t0", type=float, default=0.0)
ap.add_argument("--to", dest="t1", type=float, default=None)
ap.add_argument("--fps", type=int, default=30)
args = ap.parse_args()


async def main():
    BUILD.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type in ("error", "warning") and errors.append(m.text))
        await page.goto(f"{args.base.rstrip('/')}/video/promo.html?render")
        await page.wait_for_function("window.PROMO", timeout=60000)
        await page.evaluate("PROMO.ready")
        info = await page.evaluate("({ cues: PROMO.cues, grabs: PROMO.grabs, duration: PROMO.duration, gl: (() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; })() })")
        (BUILD / "cues.json").write_text(json.dumps(info["cues"], indent=1))
        print("renderer:", info["gl"])
        print("grabs:", info["grabs"])
        stage = page.locator("#stage")

        if args.stills is not None:
            out = BUILD / "stills"; out.mkdir(exist_ok=True)
            for t in args.stills:
                await page.evaluate(f"PROMO.seek({t})")
                await stage.screenshot(path=str(out / f"t{t:05.2f}.png"))
                print("still", t)
        else:
            dur = info["duration"]
            t1 = args.t1 if args.t1 is not None else dur
            n0, n1 = round(args.t0 * args.fps), round(t1 * args.fps)
            silent = BUILD / ("promo-silent.mp4" if args.t0 == 0 and args.t1 is None else f"part-{args.t0:g}-{t1:g}.mp4")
            ff = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(args.fps), "-c:v", "png", "-i", "-",
                                   "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)],
                                  stdin=subprocess.PIPE)
            start = time.time()
            for n in range(n0, n1):
                await page.evaluate(f"PROMO.seek({n / args.fps})")
                ff.stdin.write(await stage.screenshot(type="png"))
                if n % 30 == 0:
                    el = time.time() - start; done = n - n0 + 1
                    print(f"frame {n}/{n1}  {el:.0f}s elapsed, ~{el / done * (n1 - n0 - done):.0f}s left", flush=True)
            ff.stdin.close(); ff.wait()
            print("wrote", silent)
            sfx = BUILD / "promo-sfx.wav"
            if sfx.exists() and silent.name == "promo-silent.mp4":
                final = BUILD / "promo.mp4"
                subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(silent), "-i", str(sfx), "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                                "-shortest", "-movflags", "+faststart", str(final)], check=True)
                print("wrote", final)
        if errors:
            print("page errors / warnings:", *errors[:10], sep="\n  ")
        await browser.close()

asyncio.run(main())
