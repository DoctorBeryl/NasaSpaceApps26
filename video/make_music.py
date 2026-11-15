"""An original phonk-style beat at 120 BPM, arranged to the promo's cuts, plus the final mix.

    python video/make_music.py      # writes build/promo-music.wav and build/promo-mix.wav

Every cut in promo.html sits on the 120 BPM grid (a beat is 0.5 s, a bar is 2 s), so this lines up.
Synthesized with numpy, so there are no copyright issues. Instruments: 808-style cowbell
melody (the phonk signature), distorted 808 bass, kick, clap, hi-hats.

Arrangement (video seconds):
  0–4    intro: filtered cowbell and hats, building to the drop
  4–11   drop: full beat (hand close-up, readouts, back shot)
  11–14  solar flare: the beat breaks down to a low 808 drone and a heartbeat kick, so the alarm
         and the breathing come through
  14–16  warp: accelerating snare roll and riser
  16–17  silence
  17–28  the website: the full beat comes back in, with a melody variation
  28–30  final 808 hit and cowbell note on the title card
The mix (promo-mix.wav) puts the sound effects from make_audio.py on top.
"""
import wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
SR = 48000; DUR = 30.0; N = int(SR * DUR)
BPM = 120; BEAT = 60 / BPM; STEP = BEAT / 4          # 16th note = 0.125 s
rng = np.random.default_rng(7)

def t_axis(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.standard_normal(int(SR * d))
def norm(x): m = np.max(np.abs(x)); return x / m if m else x
def svf(x, fc, q=0.7, mode="bp"):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    lo = bp = 0.0; out = np.empty_like(x); damp = 1 / q
    for i in range(len(x)):
        hi = x[i] - lo - damp * bp; bp += f[i] * hi; lo += f[i] * bp
        out[i] = bp if mode == "bp" else lo if mode == "lp" else hi
    return out
def onepole_lp(x, fc):
    """Cheap time-varying low-pass for the intro filter sweep."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = a[i] * s + (1 - a[i]) * x[i]; y[i] = s
    return y

# ---------------- instruments ----------------
ROOT = 698.46                                      # F5: cowbell root (F minor)
SCALE = {0: 0, 2: 2, 3: 3, 5: 5, 7: 7, 8: 8, 10: 10, 12: 12, -2: -2, -4: -4}

def make_cowbell():
    d = 0.32; t = t_axis(d)
    sq = np.sign(np.sin(2 * np.pi * 540 * t)) + np.sign(np.sin(2 * np.pi * 800 * t))
    body = svf(sq, 900, 1.8) * (np.exp(-t * 28) * .7 + np.exp(-t * 7) * .3)
    click = svf(noise(0.01), 3000, 1.0) * np.exp(-t_axis(0.01) * 400)
    body[: len(click)] += click * .3
    return norm(body)
COWBELL = make_cowbell()
def cowbell(semi):
    """Pitch the cowbell by resampling (shorter when higher, like a sampler)."""
    r = 2 ** (semi / 12) * ROOT / 670.0
    idx = np.arange(0, len(COWBELL) - 1, r)
    return np.interp(idx, np.arange(len(COWBELL)), COWBELL)

def bass808(semi, d=0.9, drive=2.4):
    f0 = 43.65 * 2 ** (semi / 12)                  # F1
    t = t_axis(d)
    f = f0 * (1 + 1.6 * np.exp(-t * 38))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    x = np.tanh(x * drive) / np.tanh(drive)
    x[: int(SR * .003)] *= np.linspace(0, 1, int(SR * .003))
    x[-int(SR * .02):] *= np.linspace(1, 0, int(SR * .02))
    return x

def kick():
    t = t_axis(0.3)
    return np.sin(2 * np.pi * np.cumsum(48 + 120 * np.exp(-t * 45)) / SR) * np.exp(-t * 12)
KICK = kick()

def clap():
    d = 0.25; t = t_axis(d); env = np.zeros_like(t)
    for o in (0, .011, .022): env += np.exp(-np.maximum(0, t - o) * 90) * (t >= o)
    env += np.exp(-t * 16) * .5
    x = svf(noise(d), 1700, 1.2) * env
    x += np.sin(2 * np.pi * 210 * t) * np.exp(-t * 30) * .3
    return norm(x)
CLAP = clap()

def hat(open_=False):
    d = 0.22 if open_ else 0.05; t = t_axis(d)
    x = svf(noise(d), 8500, 0.7, "hp") * np.exp(-t * (14 if open_ else 90))
    return norm(x)
HAT, OHAT = hat(), hat(True)

# ---------------- sequencing ----------------
music = np.zeros((N, 2))
def put(sig, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0: return
    a = (pan + 1) * np.pi / 4
    j = min(N, i + len(sig))
    music[i:j, 0] += sig[: j - i] * g * np.cos(a); music[i:j, 1] += sig[: j - i] * g * np.sin(a)

# cowbell melody: 3-3-2 rhythm (16th steps 0, 3, 6, 8, 11, 14 in each bar), F minor
RHYTHM = [0, 3, 6, 8, 11, 14]
MEL_A = [[0, 0, 3, 7, 5, 3], [0, 0, 3, 8, 7, 5]]
MEL_B = [[12, 10, 8, 7, 8, 7], [5, 3, 5, 3, 0, -2]]
BASS_A = [0, 0]; BASS_B = [-4, -2]                  # F, F | Db, Eb  (i i VI VII)

def bar(t0, mel, bass_semi, full=True, cow_g=.42, hats=True, kick_808=True, roll=False):
    for st, n in zip(RHYTHM, mel): put(cowbell(n), t0 + st * STEP, cow_g, .15)
    if full:
        if kick_808:
            for st in (0, 6, 10):                       # 808 on the 3-3-2 too
                put(KICK, t0 + st * STEP, .8)
                put(bass808(bass_semi, 0.7 if st else 0.9), t0 + st * STEP, .7)
        for st in (4, 12): put(CLAP, t0 + st * STEP, .55)
    if hats:
        for st in range(0, 16, 2): put(HAT, t0 + st * STEP, .18 if st % 4 else .24, -.2)
        put(OHAT, t0 + 14 * STEP, .12, .25)
        if roll:                                         # 32nd-note hat roll into the next bar
            for k in range(8): put(HAT, t0 + 12 * STEP + k * STEP / 2, .1 + k * .015, -.2)

def section(t0, t1, melodies, basses, **kw):
    b = 0; t = t0
    while t < t1 - 1e-6:
        last = t + 2 > t1 - 1e-6
        bar(t, melodies[b % len(melodies)], basses[b % len(basses)], roll=last, **kw)
        t += 2; b += 1

# 0–4 intro: cowbell and hats only, behind a filter that opens up into the drop
bar(0, MEL_A[0], 0, full=False, hats=False); bar(2, MEL_A[1], 0, full=False, hats=True, roll=True)
seg = music[: int(SR * 4)].copy(); music[:] = 0           # nothing else is placed yet
cut = np.geomspace(500, 9000, len(seg))
for ch in (0, 1): seg[:, ch] = onepole_lp(seg[:, ch], cut)
music[: len(seg)] += seg * 1.2

# 4–11 drop (cut at 11 for the flare)
section(4, 10, [MEL_A[0], MEL_A[1], MEL_B[0]], [0, 0, -4])
bar(10, MEL_B[1], -2)
music[int(11 * SR):] = 0

# 11–14 flare breakdown: a low 808 drone and a heartbeat kick on each beat (lub-dub)
drone = bass808(0, 3.2, 1.6) * np.interp(t_axis(3.2), [0, 2.5, 3.2], [1, .8, 0])
put(drone, 11.0, .55)
for k in range(6):
    put(KICK, 11.0 + k * BEAT, .55); put(KICK, 11.0 + k * BEAT + .16, .3)

# 14–16 warp build: snare roll that speeds up, rising noise
tt = 14.0                                                  # quarters, 8ths, 16ths, 32nds
for div, count in [(1, 2), (2, 4), (4, 4), (8, 8)]:
    for _ in range(count):
        put(CLAP, tt, .25 + .25 * (tt - 14) / 2); tt += BEAT / div
riser = svf(noise(2.0), 300 * 30 ** (t_axis(2.0) / 2.0), 1.2) * (t_axis(2.0) / 2.0) ** 2
put(norm(riser) * .35, 14.0)
music[int(16 * SR): int(17 * SR)] = 0                      # silence, exactly as the edit

# 17–28 the website: the full beat comes back on the power-up
section(17, 21, [MEL_A[0], MEL_A[1]], [0, 0])
section(21, 25, [MEL_B[0], MEL_B[1]], [-4, -2])
section(25, 27, [MEL_A[0]], [0])
bar(27, MEL_A[1], 0)
music[int(28 * SR):] = 0

# 28–30 title: one long 808 and a last cowbell note
put(KICK, 28.0, 1.0); put(bass808(0, 2.0, 2.0), 28.0, .9); put(cowbell(12), 28.0, .45); put(cowbell(0), 28.0, .3)

# master: soft clip, -1 dBFS, fade the tail
m = np.tanh(music * 0.9)
m *= 10 ** (-1 / 20) / np.max(np.abs(m))
m[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]

def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("wrote", path)

write(BUILD / "promo-music.wav", m)

# final mix: music under the sound effects, ducked while the alarm and breathing play
sfx_path = BUILD / "promo-sfx.wav"
if sfx_path.exists():
    with wave.open(str(sfx_path)) as w:
        sfx = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2) / 32767
    sfx = np.pad(sfx, ((0, max(0, N - len(sfx))), (0, 0)))[:N]
    t = np.arange(N) / SR
    duck = np.interp(t, [0, 10.95, 11.05, 13.9, 14.0, 30], [1, 1, .55, .55, 1, 1])[:, None]
    mix = m * 0.62 * duck + sfx * 1.0
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
    write(BUILD / "promo-mix.wav", mix)
