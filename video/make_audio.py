"""Synthesize the promo's sound-effect track (no music) from build/cues.json.

    python video/make_audio.py      # writes build/promo-sfx.wav (48 kHz stereo, 30 s)

Everything is generated with numpy: station hum, whooshes on each push-off, rail sensor chirps,
the bass drop, strobe hits for the readouts, hatch clunk and hiss, the solar flare (boom, three-beep
alarm for 3 s, heavy suit-mic breathing), the warp riser, one second of dead silence, a UI power-up,
punch hits for the website cuts, typing, and a final bass hit. make_music.py adds the beat.
Leave room for a song: the mix peaks at -3 dBFS and stays sparse.
"""
import json, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(42)
mix = np.zeros((N, 2))


def t_axis(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.standard_normal(int(SR * d))
def env_ad(d, a, decay, curve=4.0):
    t = t_axis(d); e = np.minimum(1, t / max(a, 1e-4)); return e * np.exp(-curve * np.maximum(0, t - a) / max(decay, 1e-4))
def sweep(f0, f1, d, kind="exp"):
    t = t_axis(d); k = t / d
    f = f0 * (f1 / f0) ** k if kind == "exp" else f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

def svf(x, fc, q=0.7, mode="bp"):
    """Chamberlin state-variable filter; fc may be an array (time-varying cutoff)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    lo = bp = 0.0; out = np.empty_like(x); damp = 1 / q
    for i in range(len(x)):
        hi = x[i] - lo - damp * bp
        bp += f[i] * hi; lo += f[i] * bp
        out[i] = bp if mode == "bp" else lo if mode == "lp" else hi
    return out

def fft_band(x, lo, hi):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= ((fr >= lo) & (fr <= hi)) * 1.0
    return np.fft.irfft(X, len(x))

def place(sig, at, gain=1.0, pan=0.0):
    """Add a mono (or stereo) signal at time `at` with constant-power pan (-1 left … 1 right)."""
    i = int(at * SR)
    if i >= N: return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
    j = min(N, i + len(sig)); mix[i:j] += sig[: j - i] * gain

def norm(x): m = np.max(np.abs(x)); return x / m if m else x

# ---------------- sound designs ----------------
def s_grab():
    click = svf(noise(0.03), 3200, 2.5) * env_ad(0.03, 0.001, 0.008)
    chirp = sweep(2300, 3300, 0.07) * env_ad(0.07, 0.003, 0.03) * 0.35
    thud = np.sin(2 * np.pi * 140 * t_axis(0.09)) * env_ad(0.09, 0.002, 0.03) * 0.6
    out = np.zeros(int(SR * 0.09)); out[: len(click)] += norm(click) * 0.7; out[: len(chirp)] += chirp; out += thud
    return out

def s_whoosh(d=0.5, f0=350, f1=1700, f2=450, big=False):
    n = noise(d); k = t_axis(d) / d
    fc = np.where(k < .5, f0 * (f1 / f0) ** (k * 2), f1 * (f2 / f1) ** ((k - .5) * 2))
    w = svf(n, fc, 1.6) * np.sin(np.pi * k) ** 1.5
    if big: w += svf(noise(d), fc * .5, 1.0, "lp") * np.sin(np.pi * k) ** 2 * .5
    return norm(w)

def s_riser(d):
    k = t_axis(d) / d
    n = svf(noise(d), 300 * (12 ** k), 1.2) * k ** 2
    tone = sweep(180, 900, d) * k ** 2.5 * .25
    return norm(n) * .8 + tone

def s_drop():
    d = 1.6; t = t_axis(d)
    f = 45 + 45 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    sub = np.tanh(sub * 2.2) / np.tanh(2.2)
    trans = svf(noise(0.12), 1800, 0.8, "lp") * env_ad(0.12, 0.001, 0.03)
    out = sub.copy(); out[: len(trans)] += norm(trans) * .7
    return out

def s_zoom():
    d = 0.28; k = t_axis(d) / d
    return norm(svf(noise(d), 600 * (8 ** k), 2.0) * k ** .5 * (1 - k) ** .3)

def s_strobe(n):
    shutter = svf(noise(0.05), 4500, 1.4, "hp") * env_ad(0.05, 0.0005, 0.01)
    f = 1100 + n * 140; t = t_axis(0.09)
    blip = np.sign(np.sin(2 * np.pi * f * t)) * env_ad(0.09, 0.002, 0.03) * .18
    thump = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-t_axis(0.2) * 30)) / SR) * env_ad(0.2, 0.002, 0.06)
    out = np.zeros(int(SR * 0.2)); out[: len(shutter)] += norm(shutter) * .6; out[: len(blip)] += blip; out += thump * .9
    return out

def s_unlock():
    t = t_axis(0.5)
    clank = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) * a for f, dcy, a in [(410, 9, .5), (1130, 14, .35), (2350, 22, .2), (3170, 30, .1)])
    thud = np.sin(2 * np.pi * 85 * t) * np.exp(-t * 18)
    return norm(clank * .6 + thud)

def s_hiss(d):
    k = t_axis(d) / d
    h = svf(noise(d), 5200, 0.6, "hp") * np.minimum(1, k * 30) * (1 - k) ** 1.4
    servo = sweep(260, 520, d, "lin") * np.sin(np.pi * k) * .12
    return norm(h) * .8 + servo

def s_beacon():
    d = 1.4; t = t_axis(d)
    tone = (np.sin(2 * np.pi * 1760 * t) + .5 * np.sin(2 * np.pi * 2637 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 6.5 * t))
    return tone * np.sin(np.pi * t / d) ** 2 * .25

def s_warp(d):
    k = t_axis(d) / d
    n = svf(noise(d), 200 * (40 ** k), 1.3) * (k ** 2.2)
    tone = sweep(90, 1400, d) * k ** 3 * .35
    rumble = np.sin(2 * np.pi * np.cumsum(38 + 30 * k) / SR) * k * .5
    out = norm(n) * .9 + tone + rumble
    l = out; r = np.roll(out, int(SR * 0.012))       # widen as it builds
    return np.stack([l, r], 1)

def s_powerup():
    a = sweep(260, 1250, 0.24) * env_ad(0.24, 0.01, 0.4, 1.0)
    b1 = np.sin(2 * np.pi * 1320 * t_axis(0.07)) * env_ad(0.07, 0.002, 0.03)
    b2 = np.sin(2 * np.pi * 1760 * t_axis(0.12)) * env_ad(0.12, 0.002, 0.05)
    out = np.zeros(int(SR * 0.5)); out[: len(a)] += a * .7
    i = int(SR * 0.27); out[i:i + len(b1)] += b1 * .5
    j = int(SR * 0.36); out[j:j + len(b2)] += b2 * .5
    return out

def s_punch():
    t = t_axis(0.22)
    thump = np.sin(2 * np.pi * np.cumsum(55 + 130 * np.exp(-t * 35)) / SR) * env_ad(0.22, 0.001, 0.07)
    hiss = svf(noise(0.12), 3000, 0.9, "hp") * env_ad(0.12, 0.0005, 0.025)
    swoosh = s_zoom()[: int(SR * 0.12)][::-1] * .35
    out = thump.copy(); out[: len(hiss)] += norm(hiss) * .45
    pre = np.zeros(len(swoosh) + len(out)); pre[: len(swoosh)] += swoosh; pre[len(swoosh):] += out
    return pre, len(swoosh) / SR

def s_blip(f=880): return np.sin(2 * np.pi * f * t_axis(0.06)) * env_ad(0.06, 0.002, 0.02)

def s_key():
    c = svf(noise(0.025), 2600 + rng.uniform(-400, 400), 3.0) * env_ad(0.025, 0.0005, 0.006)
    return norm(c)

def s_chime():
    t = t_axis(0.9)
    return (np.sin(2 * np.pi * 988 * t) * np.exp(-t * 5) + np.sin(2 * np.pi * 1319 * np.maximum(0, t - .12)) * np.exp(-np.maximum(0, t - .12) * 5) * (t > .12)) * .5

def s_alarm():
    out = np.zeros(int(SR * 0.6))
    for i, f in enumerate([740, 560, 740]):
        b = np.sign(np.sin(2 * np.pi * f * t_axis(0.13))) * env_ad(0.13, 0.003, 0.08, 1.5) * .25
        j = int(SR * i * 0.17); out[j:j + len(b)] += b
    return out

def s_hit():
    d = 3.0; t = t_axis(d)
    sub = np.tanh(np.sin(2 * np.pi * np.cumsum(42 + 50 * np.exp(-t * 12)) / SR) * np.exp(-t * 1.3) * 1.8)
    trans = svf(noise(0.2), 2500, 0.7, "lp") * env_ad(0.2, 0.001, 0.05)
    shimmer = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(2093, 0), (2637, 1), (3136, 2)]) * np.exp(-t * 1.1) * .06
    out = sub + shimmer; out[: len(trans)] += norm(trans) * .6
    return out

def s_flare():
    """Solar flare hit: a deep whump with a crackling, brightening noise swell."""
    d = 1.8; t = t_axis(d)
    whump = np.tanh(np.sin(2 * np.pi * np.cumsum(32 + 40 * np.exp(-t * 8)) / SR) * np.exp(-t * 1.8) * 2.0)
    crackle = svf(noise(d) * (rng.random(int(SR * d)) < 0.02) * 6 + noise(d) * 0.3, 1800 + 3000 * np.exp(-t * 2), 0.8) * np.exp(-t * 2.2)
    return whump * .9 + norm(crackle) * .35

def s_alarmbeeps(d):
    """beep-beep-beep, rest; repeated for d seconds (3 beeps per second, on the 16th notes at 120 BPM)."""
    out = np.zeros(int(SR * d))
    for sec in range(int(round(d))):
        for k in range(3):
            t0 = sec + k * 0.25; b = t_axis(0.14)
            tone = np.sign(np.sin(2 * np.pi * 1046 * b)) * .6 + np.sin(2 * np.pi * 2093 * b) * .4
            tone *= np.minimum(1, b / 0.004) * np.minimum(1, (0.14 - b) / 0.01)
            i = int(t0 * SR); out[i:i + len(tone)] += tone[: max(0, len(out) - i)]
    return out

def s_breathing(d):
    """Fast, heavy breathing through a helmet mic: bright inhale, louder falling exhale, 0.75 s a breath."""
    out = np.zeros(int(SR * d)); period = 0.75
    n = 0; t0 = 0.05
    while t0 < d - 0.1:
        rate = 1 + 0.06 * np.sin(n * 1.7)                       # a little uneven, like panic
        inh = 0.28 * rate; exh = 0.40 * rate
        ti = t_axis(inh); k = ti / inh
        a = svf(noise(inh), 1500 + 900 * k, 2.2) * np.sin(np.pi * k) ** 1.2 * .55
        te = t_axis(exh); k = te / exh
        b = svf(noise(exh), 1100 - 500 * k, 1.6) * (np.sin(np.pi * np.minimum(1, k * 1.3)) ** .8) * (1 - k) ** .4
        b += svf(noise(exh), 420, 3.0) * np.sin(np.pi * k) * .6   # chesty low end of the exhale
        i = int(t0 * SR); j = i + len(a)
        out[i:j] += a[: max(0, len(out) - i)]
        e = int((t0 + inh + 0.02) * SR); out[e:e + len(b)] += b[: max(0, len(out) - e)]
        t0 += period * rate; n += 1
    helmet = out + np.roll(out, int(SR * 0.0023)) * .55 + np.roll(out, int(SR * 0.0051)) * .3   # small-space comb
    return norm(helmet) * np.minimum(1, t_axis(d) / 0.05)

# ---------------- ambience ----------------
def ambience():
    d = 16.0; t = t_axis(d)
    hum = (np.sin(2 * np.pi * 50 * t) * .5 + np.sin(2 * np.pi * 100 * t) * .25 + np.sin(2 * np.pi * 150 * t) * .1) * (1 + .1 * np.sin(2 * np.pi * .3 * t))
    air = fft_band(noise(d), 80, 900); air = norm(air) * .5
    fans = fft_band(noise(d), 1800, 2600) * .15
    amb = hum * .35 + air + norm(fans) * .05
    fade = np.minimum(1, t / 0.4)
    # the far end of the station is quieter in the back shot (7-11 s); the alarm and the warp cover it
    duck = np.interp(t, [0, 6.9, 7.0, 11, 11.1, 14, 15.5, 16], [1, 1, .75, .75, .5, .5, .25, .25])
    return amb * fade * duck

def site_bed():
    """Very quiet data texture under the website section so it isn't dead air."""
    d = 11.0; t = t_axis(d)
    pad = (np.sin(2 * np.pi * 55 * t) + .4 * np.sin(2 * np.pi * 82.4 * t)) * .25
    out = pad * np.minimum(1, t / .3) * np.minimum(1, (d - t) / .3)
    for k in np.arange(0.2, d - .2, 0.25):
        b = s_blip(rng.choice([1760, 2093, 2349, 2637])) * .05
        i = int(k * SR); out[i:i + len(b)] += b
    return out


def main():
    cues = json.loads((BUILD / "cues.json").read_text())
    place(ambience(), 0.0, 0.10)
    place(site_bed(), 17.0, 0.12)
    for c in cues:
        t, k = c["t"], c["kind"]
        if k == "grab": place(s_grab(), t, .5, c.get("pan", -.4))
        elif k == "whoosh":
            big = c.get("big", False)
            w = s_whoosh(0.7 if big else 0.5, big=big)
            place(w, t - .15, .55 if big else .45, c.get("pan", -.3))
        elif k == "riser": place(s_riser(c.get("dur", .9)), t, .35)
        elif k == "drop": place(s_drop(), t, .95)
        elif k == "zoom": place(s_zoom(), t - .05, .35)
        elif k == "strobe": place(s_strobe(c.get("n", 0)), t, .6)
        elif k == "unlock": place(s_unlock(), t, .45)
        elif k == "hiss": place(s_hiss(c.get("dur", .9)), t, .3)
        elif k == "beacon": place(s_beacon(), t, .7)
        elif k == "warp": place(s_warp(c.get("dur", 2.0)), t, .55)
        elif k == "powerup": place(s_powerup(), t, .45)
        elif k == "punch":
            p, lead = s_punch(); place(p, t - lead, .7)
        elif k == "blip": place(s_blip(1320), t, .3)
        elif k == "key": place(s_key(), t, .18, .2)
        elif k == "enter": place(s_blip(1568), t, .3)
        elif k == "chime": place(s_chime(), t, .35)
        elif k == "alarm": place(s_alarm(), t, .25 if c.get("soft") else .4)
        elif k == "flare": place(s_flare(), t, .8)
        elif k == "alarmbeeps": place(s_alarmbeeps(c.get("dur", 3.0)), t, .32)
        elif k == "breathing": place(s_breathing(c.get("dur", 3.4)), t, .55)
        elif k == "hit": place(s_hit(), t, 1.0)
    # one second of dead silence after the white flash, exactly as the edit does
    a, b = int(16.0 * SR), int(17.0 * SR)
    mix[a:b] = 0
    mix[a - int(.004 * SR):a] *= np.linspace(1, 0, int(.004 * SR))[:, None]
    # gentle limiter, then peak at -3 dBFS so a song can sit on top
    out = np.tanh(mix * 1.2) / np.tanh(1.2)
    out *= 10 ** (-3 / 20) / max(1e-9, np.max(np.abs(out)))
    out[-int(.3 * SR):] *= np.linspace(1, 0, int(.3 * SR))[:, None]
    pcm = (out * 32767).astype("<i2")
    with wave.open(str(BUILD / "promo-sfx.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("wrote", BUILD / "promo-sfx.wav", f"({len(cues)} cues)")


main()
