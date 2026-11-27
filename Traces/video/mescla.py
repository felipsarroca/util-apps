# SPDX-License-Identifier: AGPL-3.0-or-later
"""Banda sonora original del vídeo de Traces: música i efectes sintetitzats.

Llegeix sortida/esdeveniments.json (el desa renderitza.py) i escriu sortida/so.wav.
Tot el so es genera aquí: no hi ha cap mostra ni música de tercers.
"""
import json
from pathlib import Path
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR = 48000
DIR = Path(__file__).resolve().parent
OUT = DIR / "sortida"
rng = np.random.default_rng(7)
ev = json.loads((OUT / "esdeveniments.json").read_text(encoding="utf-8"))
DUR = ev["total"] + 0.3
N = int(DUR * SR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2))
BEAT = 60 / 96


def hz(note):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    n, o = note[:-1], int(note[-1])
    return 440 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * l * 1.414
    buf[i:i + len(sig), 1] += sig * r * 1.414


def tt(d): return np.arange(int(d * SR)) / SR


def lp(x, f, order=2): return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, order=2): return sosfilt(butter(order, [a, b], "band", fs=SR, output="sos"), x)


# ---------- Instruments ----------
def piano(f, d=2.4, vel=1.0):
    t = tt(d); s = np.zeros_like(t)
    for k, a in enumerate([1, .55, .32, .18, .1, .06], start=1):
        s += a * np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * t) * np.exp(-t * (1.6 + 1.3 * k))
    s *= np.minimum(1, t / .004)
    ham = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 90) * .05
    return (s + ham) * vel * .22


def pad(freqs, d, att=1.2, rel=1.5):
    t = tt(d); s = np.zeros_like(t)
    for f in freqs:
        for det in (-.004, 0, .005):
            ph = rng.uniform(0, 2 * np.pi)
            for k, a in enumerate([1, .4, .2, .1], start=1):
                s += a * np.sin(2 * np.pi * f * (1 + det) * k * t + ph)
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel)
    return lp(s, 1600) * env * .016


def pluck(f, d=.9, vel=1.0):
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 7) * np.minimum(1, t / .002)
    return s * vel * .18


def sub(f, d):
    t = tt(d)
    return np.sin(2 * np.pi * f * t) * np.minimum(1, t / .03) * np.exp(-t * 1.2) * .2


def tick(vel=1.0):
    t = tt(.05)
    return lp(hp(rng.standard_normal(len(t)), 5000), 11000) * np.exp(-t * 180) * vel * .035


# ---------- Música ----------
CH = {
    "Dmaj9": ["D3", "F#3", "A3", "C#4", "E4"], "Bm7": ["B2", "D3", "F#3", "A3"], "Gmaj7": ["G2", "B2", "D3", "F#3"],
    "A": ["A2", "C#3", "E3", "A3"], "Asus": ["A2", "D3", "E3", "A3"], "Em7": ["E3", "G3", "B3", "D4"], "D": ["D3", "F#3", "A3", "D4"],
}
ARP = {
    "Dmaj9": ["D5", "A4", "F#5", "A4", "E5", "A4", "C#5", "A4"], "Bm7": ["B4", "F#4", "D5", "F#4", "A4", "F#4", "D5", "F#4"],
    "Gmaj7": ["G4", "D4", "B4", "D4", "F#4", "D4", "B4", "D4"], "A": ["A4", "E4", "C#5", "E4", "A4", "E4", "E5", "E4"],
    "D": ["D5", "A4", "F#5", "A4", "D5", "A4", "A5", "A4"], "Em7": ["E5", "B4", "G4", "B4", "D5", "B4", "G4", "B4"],
}
BASS = {"Dmaj9": "D2", "Bm7": "B1", "Gmaj7": "G1", "A": "A1", "Asus": "A1", "D": "D2", "Em7": "E2"}

# Introducció: pad i motiu de piano escàs
add(music, 0.2, pad([hz(n) for n in CH["Dmaj9"]], 7.4, att=2.0), pan=0)
for t0, n, v in [(0.9, "A4", .8), (1.55, "F#4", .6), (2.2, "E5", .7), (3.4, "D5", .7), (4.6, "C#5", .55), (5.3, "A4", .5), (6.1, "E4", .5)]:
    add(music, t0, piano(hz(n), vel=v), pan=-.2)

# Repetició (7,2–17): pols de rellotge i arpegi en corxeres
prog = ["Bm7", "Gmaj7", "D", "A"]
start = 7.2; bar = 4 * BEAT
for i in range(4):
    c = prog[i % 4]; tb = start + i * bar
    add(music, tb, pad([hz(n) for n in CH[c]], bar + .6, att=.5, rel=.6))
    for j, n in enumerate(ARP[c]):
        add(music, tb + j * BEAT / 2, piano(hz(n), d=1.2, vel=.45 + .1 * (j % 2 == 0) + .05 * i), pan=.25)
    for j in range(8):
        add(music, tb + j * BEAT / 2, tick(1 if j % 2 == 0 else .55), pan=.4)
# Gir cap als panells (17–24,2): entra el baix i s'obre l'harmonia
prog2 = ["Gmaj7", "A", "Bm7", "D"]; start2 = start + 4 * bar  # ≈ 17,2
bar2 = (24.2 - start2) / 4
for i, c in enumerate(prog2):
    tb = start2 + i * bar2
    add(music, tb, pad([hz(n) for n in CH[c]], bar2 + .7, att=.3, rel=.7))
    add(music, tb, sub(hz(BASS[c]), bar2 + .3))
    for j, n in enumerate(ARP[c]):
        add(music, tb + j * bar2 / 8, piano(hz(n), d=1.3, vel=.55 + .1 * (j % 2 == 0)), pan=.25)
    for j in range(8):
        add(music, tb + j * bar2 / 8, tick(1 if j % 2 == 0 else .55), pan=.4)
# Rajoles (24,2–28,6)
for i, c in enumerate(["Em7", "A"]):
    d = (28.6 - 24.2) / 2; tb = 24.2 + i * d
    add(music, tb, pad([hz(n) for n in CH[c]], d + .8, att=.2, rel=.8))
    add(music, tb, sub(hz(BASS[c]), d))
    for j, n in enumerate(ARP[c]):
        add(music, tb + j * d / 8, piano(hz(n), d=1.2, vel=.5), pan=.25)
# Missatge (28,6–32): tot es buida, només pad suspès
add(music, 28.5, pad([hz(n) for n in CH["Gmaj7"]], 2.2, att=.4, rel=1.0))
add(music, 30.3, pad([hz(n) for n in CH["Asus"]], 2.2, att=.6, rel=1.0))
add(music, 28.7, piano(hz("B4"), vel=.5)); add(music, 30.4, piano(hz("A4"), vel=.45))
# Tancament: acord resolt
te = ev["end"]
add(music, te - .1, pad([hz(n) for n in CH["Dmaj9"]], DUR - te, att=.3, rel=2.5))
add(music, te - .1, sub(hz("D2"), 3.5))
for k, n in enumerate(["D3", "A3", "F#4", "C#5", "E5"]):
    add(music, te - .1 + k * .07, piano(hz(n), d=4, vel=.8), pan=-.3 + .15 * k)

# ---------- Efectes ----------
def key_tap():
    t = tt(.03)
    return bp(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t * 260) * rng.uniform(.6, 1)


def thud():
    t = tt(.6)
    f = 85 * np.exp(-t * 4) + 40
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    slap = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 45) * .5
    return (body + slap) * .9


def ding(f):
    t = tt(1.4)
    return (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.2) * np.minimum(1, t / .003) * .32


def click():
    t = tt(.04)
    s = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400)
    s2 = np.zeros_like(s); k = int(.022 * SR); s2[k:] = s[: len(s) - k] * .6
    return (s + s2) * .5


def whoosh(d=.7):
    t = tt(d); x = rng.standard_normal(len(t))
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return (bp(x, 400, 2200) * .6 + bp(x, 2200, 7000) * .25 * (t / d)) * env * .16


def glow(f):
    t = tt(.5)
    return np.sin(2 * np.pi * (f * t + f * .25 * t * t)) * np.exp(-t * 7) * np.minimum(1, t / .01) * .2


for k in ev["keys"]:
    add(sfx, k, key_tap(), gain=.32, pan=-.45)
for t in ev["thuds"]:
    add(sfx, t, thud(), gain=.85, pan=.45)
for t, f in zip(ev["dings"], [hz("E6"), hz("B6")]):
    add(sfx, t, ding(f), pan=(-.4 if f < 1500 else .4))
for i, t in enumerate(ev["clicks"]):
    add(sfx, t, click(), gain=.9, pan=(-.4, .4)[i])
for t in ev["whoosh"]:
    add(sfx, t, whoosh(), pan=0)
for t, f in zip(ev["rings"], [hz("A5"), hz("D6")]):
    add(sfx, t, glow(f), pan=(-.35, .35)[ev["rings"].index(t)])
for t, n in zip(ev["pops"], ["D5", "F#5", "A5", "D6"]):
    add(sfx, t, pluck(hz(n), vel=1.1), pan=-.45 + .3 * ev["pops"].index(t))
add(sfx, te + .1, ding(hz("D6")) * .8, pan=0)
add(sfx, te + .35, ding(hz("A6")) * .5, pan=.2)

# ---------- Reverberació, mescla i límit ----------
def reverb(x, dec=1.9, mix=.28):
    tir = tt(dec); ir = rng.standard_normal((len(tir), 2)) * np.exp(-tir * 6.9 / dec)[:, None]
    ir[:, 0] = lp(ir[:, 0], 5000); ir[:, 1] = lp(ir[:, 1], 5000)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    wet *= np.sqrt(np.mean(x ** 2) / (np.mean(wet ** 2) + 1e-12))
    return x * (1 - mix) + wet * mix


mix = reverb(music, 2.2, .32) * 1.0 + reverb(sfx, 1.0, .15) * 1.0
# fosa final
fade = np.ones(N); fs = int((ev["total"] - .9) * SR); fade[fs:] = np.linspace(1, 0, N - fs)
fade[: int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR))
mix *= fade[:, None]
mix = hp(mix.T, 30).T
rms = np.sqrt(np.mean(mix ** 2)); mix *= 0.12 / rms          # ≈ −18 dBFS RMS
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / max(1e-9, np.max(np.abs(mix)))
wavfile.write(OUT / "so.wav", SR, (mix * 32767).astype(np.int16))
print("so.wav", round(DUR, 2), "s")
