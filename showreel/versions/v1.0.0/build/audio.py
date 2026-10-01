"""FDDD 쇼릴 사운드트랙을 numpy로 직접 합성합니다(샘플·외부 음원 없음).

영상에서 뽑은 이벤트(data/events_{cut}.json)의 시각에 맞춰 효과음을 놓고,
128 BPM 박자 격자 위에 D단조 진행(Dm–B♭–F–C)으로 음악을 쌓습니다.
출력: data/audio_{cut}.wav (48 kHz, 스테레오, 24비트) — 음량 정규화는 인코딩 단계에서 합니다.
사용법: python3 build/audio.py [15|30 ...]
"""
import json
import os
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RNG = np.random.default_rng(20260927)


# ───────────────────────────────────────── 기본 부품
def tt(n):
    return np.arange(n) / SR


def noise(n, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(n)


def sos_filter(x, kind, f, order=2):
    if kind == "bp":
        sos = signal.butter(order, f, "bandpass", fs=SR, output="sos")
    else:
        sos = signal.butter(order, f, "lowpass" if kind == "lp" else "highpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return sos_filter(x, "lp", min(f, SR * 0.45), order)


def hp(x, f, order=2):
    return sos_filter(x, "hp", f, order)


def bp(x, lo, hi, order=2):
    return sos_filter(x, "bp", [lo, min(hi, SR * 0.45)], order)


def sweep(x, f_of_t, kind="lp", block=128, q=0.9):
    """시간에 따라 차단 주파수가 변하는 2차 필터(블록 단위, 상태 유지)."""
    out = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for i in range(0, len(x), block):
        fc = float(np.clip(f_of_t((i + block / 2) / SR), 30, SR * 0.45))
        if kind == "bp":
            b, a = signal.iirpeak(fc, q, fs=SR)
            sos = np.array([[b[0], b[1], b[2], a[0], a[1], a[2]]])
        else:
            sos = signal.butter(2, fc, "lowpass" if kind == "lp" else "highpass", fs=SR, output="sos")
        seg, zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
        out[i:i + block] = seg
    return out


def saw(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    dt = f / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def sine(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return np.sin(2 * np.pi * (ph0 + np.cumsum(f) / SR))


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[p] + 12 * (o + 1) - 69) / 12)


def fade(x, a=0.002, r=0.01):
    n = len(x)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        x[:na] *= np.linspace(0, 1, na)
    if nr:
        x[-nr:] *= np.linspace(1, 0, nr)
    return x


# ───────────────────────────────────────── 악기
def kick(v=1.0):
    n = int(0.5 * SR); t = tt(n)
    f = 44 + 120 * np.exp(-t * 32) + 60 * np.exp(-t * 260)
    body = sine(f, n) * np.exp(-t * 6.0) * (1 - np.exp(-t * 900))
    click = hp(noise(n, 11), 3000) * np.exp(-t * 380) * 0.28
    return np.tanh((body + click) * 1.7) * 0.9 * v


def clap(v=1.0):
    n = int(0.42 * SR); t = tt(n)
    env = np.zeros(n)
    for d in (0.0, 0.0085, 0.0175, 0.026):
        env += np.exp(-np.maximum(t - d, 0) * 150) * (t >= d)
    tail = np.exp(-np.maximum(t - 0.03, 0) * 13) * (t >= 0.03)
    x = bp(noise(n, 12), 950, 3400) * (env * 0.7 + tail * 0.55)
    return x * 0.9 * v


def snare(v=1.0):
    n = int(0.25 * SR); t = tt(n)
    tone = sine(185 * (1 + 0.3 * np.exp(-t * 40)), n) * np.exp(-t * 28) * 0.5
    nz = bp(noise(n, 13), 1200, 7500) * np.exp(-t * 22)
    return (tone + nz) * 0.7 * v


def hat(v=1.0, open_=False, seed=0):
    dur = 0.32 if open_ else 0.07
    n = int(dur * SR); t = tt(n)
    metal = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        metal += np.sign(np.sin(2 * np.pi * f * 3.1 * t))
    x = hp(noise(n, 20 + seed) * 0.8 + metal * 0.12, 7200)
    x *= np.exp(-t * (9 if open_ else 65))
    return x * 0.3 * v


def pluck_cache():
    cache = {}

    def get(f, bright=1.0):
        key = (round(f, 2), round(bright, 2))
        if key not in cache:
            n = int(0.42 * SR); t = tt(n)
            x = saw(f, n) * 0.6 + saw(f * 1.004, n, 0.3) * 0.4
            x = sweep(x, lambda s: 380 + 3400 * bright * np.exp(-s * 24), "lp", block=64)
            cache[key] = fade(x * np.exp(-t * 7.5), 0.001, 0.05)
        return cache[key]

    return get


PLUCK = pluck_cache()


def pad(freqs, dur, cutoff=1500, attack=0.35, release=0.9, detune=0.006, v=1.0):
    n = int((dur + release) * SR); t = tt(n)
    L = np.zeros(n); R = np.zeros(n)
    for k, f in enumerate(freqs):
        for j, d in enumerate((-detune, 0, detune)):
            ph = RNG.random()
            s = saw(f * (1 + d), n, ph)
            pan = (j - 1) * 0.6
            L += s * np.cos((pan + 1) * np.pi / 4)
            R += s * np.sin((pan + 1) * np.pi / 4)
    env = np.minimum(1, t / attack) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 4)))
    L = lp(L, cutoff) * env
    R = lp(R, cutoff) * env
    g = v * 0.12 / max(1, len(freqs))
    return np.stack([L * g, R * g])


def bass(f, dur, v=1.0):
    n = int((dur + 0.05) * SR); t = tt(n)
    x = sine(f, n) * 0.9 + lp(saw(f, n), 420) * 0.45
    env = np.minimum(1, t / 0.004) * np.where(t < dur, 1.0, np.exp(-(t - dur) * 60))
    return np.tanh(x * env * 1.4) * 0.55 * v


def stab(freqs, v=1.0):
    n = int(0.3 * SR); t = tt(n)
    x = sum(saw(f, n, RNG.random()) for f in freqs) / len(freqs)
    x = sweep(x, lambda s: 600 + 5000 * np.exp(-s * 30), "lp", block=64)
    return x * np.exp(-t * 11) * 0.35 * v


def riser(dur, v=1.0):
    n = int(dur * SR); t = tt(n)
    p = t / dur
    nzL = sweep(noise(n, 31), lambda s: 350 * (22 ** (s / dur)), "bp", block=128, q=1.2)
    nzR = sweep(noise(n, 32), lambda s: 380 * (22 ** (s / dur)), "bp", block=128, q=1.2)
    tone = sine(180 * (8 ** p), n) * 0.12 + saw(90 * (8 ** p), n) * 0.03
    g = (p ** 2.2) * v * 0.5
    return np.stack([(nzL * 0.5 + tone) * g, (nzR * 0.5 + tone) * g])


def swell(dur, v=1.0):
    n = int(dur * SR); t = tt(n)
    p = t / dur
    x = hp(noise(n, 41), 3500) * (p ** 3)
    return np.stack([x, np.roll(x, 37)]) * 0.35 * v


def impact(big=False, v=1.0):
    n = int((2.2 if big else 1.4) * SR); t = tt(n)
    boom = sine(30 + 50 * np.exp(-t * 3.0), n) * np.exp(-t * (1.6 if big else 2.4)) * (1 - np.exp(-t * 500))
    crash = lp(noise(n, 51), 6500) * np.exp(-t * 3.2) * 0.35
    snap = hp(noise(n, 52), 1500) * np.exp(-t * 45) * 0.5
    x = np.tanh((boom * 1.3 + crash + snap) * 1.2)
    return np.stack([x, x * 0.96 + np.roll(crash, 91) * 0.04]) * 0.8 * v


def whoosh(dur, v=1.0, direction=1):
    n = int(dur * SR); t = tt(n)
    p = t / dur
    fc = lambda s: 300 + 5200 * np.sin(np.pi * np.clip(s / dur, 0, 1)) ** 1.5
    x = sweep(noise(n, 61), fc, "bp", block=96, q=0.8)
    env = np.sin(np.pi * p) ** 2
    pan = np.clip(-direction + 2 * direction * p, -1, 1)
    return np.stack([x * env * np.cos((pan + 1) * np.pi / 4), x * env * np.sin((pan + 1) * np.pi / 4)]) * 0.55 * v


def downsweep(dur, v=1.0):
    n = int(dur * SR); t = tt(n)
    x = sweep(noise(n, 71), lambda s: 7000 * (0.05 ** (s / dur)), "bp", block=96, q=1.0)
    return x * np.exp(-t / dur * 3) * 0.4 * v


def blip(pitch, v=1.0):
    scale = ["D6", "F6", "G6", "A6", "C7", "D7", "F7", "G7"]
    f = note(scale[pitch % len(scale)])
    n = int(0.16 * SR); t = tt(n)
    mod = sine(f * 2.01, n) * 90 * np.exp(-t * 40)
    x = sine(f + mod, n) * np.exp(-t * 32)
    return fade(x * 0.2 * v, 0.001, 0.01)


def tick(v=1.0):
    n = int(0.03 * SR); t = tt(n)
    return hp(noise(n, 81), 4000) * np.exp(-t * 260) * 0.35 * v + sine(2400, n) * np.exp(-t * 120) * 0.12 * v


def typing(dur=0.4, v=1.0, seed=5):
    r = np.random.default_rng(seed)
    n = int((dur + 0.05) * SR)
    out = np.zeros(n)
    tcur = 0.0
    while tcur < dur:
        c = tick(0.35 + 0.3 * r.random())
        i = int(tcur * SR)
        out[i:i + len(c)] += c[: n - i]
        tcur += 0.028 + 0.035 * r.random()
    return out * v


def glitch(dur=0.14, v=1.0, seed=9):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    g = int(0.012 * SR)
    for i in range(0, n, g):
        f = r.choice([220, 440, 880, 1760, 3520]) * (1 + r.random() * 0.1)
        seg = sine(f, g) * 0.5 + noise(g, int(r.integers(1e6))) * 0.3
        seg = np.round(seg * 6) / 6
        out[i:i + g] = seg[: n - i] * (0.3 + 0.7 * r.random())
    return fade(hp(out, 300) * 0.35 * v, 0.001, 0.005)


def heartbeat(v=1.0):
    n = int(0.6 * SR); t = tt(n)
    x = np.zeros(n)
    for d, a in ((0.0, 1.0), (0.16, 0.7)):
        tt_ = np.maximum(t - d, 0)
        x += sine(48 + 30 * np.exp(-tt_ * 30), n) * np.exp(-tt_ * 11) * (t >= d) * a
    return np.tanh(x * 1.5) * 0.8 * v


def buzz(dur, v=1.0):
    n = int(dur * SR); t = tt(n)
    f = 196 * (1 + 0.012 * np.sin(2 * np.pi * 5.3 * t))
    x = saw(f, n) + 0.5 * saw(f * 2.003, n)
    x = bp(x, 180, 2400) * (0.75 + 0.25 * np.sin(2 * np.pi * 11.7 * t))
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.3)
    pan = 0.5 * np.sin(2 * np.pi * t / dur * 1.2)
    return np.stack([x * env * np.cos((pan + 1) * np.pi / 4), x * env * np.sin((pan + 1) * np.pi / 4)]) * 0.07 * v


def shatter(dur, v=1.0):
    n = int((dur + 0.6) * SR); t = tt(n)
    out = np.zeros(n)
    r = np.random.default_rng(3)
    for k in range(36):
        d = r.random() * dur
        f = 1800 + r.random() * 5200
        i = int(d * SR); m = int(0.18 * SR)
        s = sine(f, m) * np.exp(-tt(m) * (25 + r.random() * 30)) * (0.3 + 0.7 * r.random())
        out[i:i + m] += s[: n - i]
    nz = hp(noise(n, 91), 2500) * np.exp(-t * 6) * 0.25
    down = sweep(noise(n, 92), lambda s: 6000 * (0.08 ** min(1, s / (dur + 0.3))), "bp", block=96, q=1.1) * np.exp(-t * 2.5) * 0.35
    x = (out * 0.25 + nz + down) * v
    return np.stack([x, np.roll(x, 53)])


def drawon(dur, v=1.0):
    n = int(dur * SR); t = tt(n)
    p = t / dur
    tone = sine(520 * (2.5 ** p), n) * 0.06 * np.sin(np.pi * p)
    scratch = bp(noise(n, 95), 2500, 7000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 9 * t))) * 0.05 * np.sin(np.pi * p)
    return (tone + scratch) * v


def bell(f, v=1.0, dur=2.5):
    n = int(dur * SR); t = tt(n)
    mod = sine(f * 3.5, n) * f * 1.2 * np.exp(-t * 3)
    return sine(f + mod, n) * np.exp(-t * 1.6) * 0.18 * v


# ───────────────────────────────────────── 믹서
class Mix:
    BUSES = ("drums", "bass", "music", "fx")

    def __init__(self, dur):
        self.dur = dur
        self.n = int(round(dur * SR))
        pad_n = self.n + SR * 3
        self.bus = {b: np.zeros((2, pad_n)) for b in self.BUSES}
        self.send = np.zeros((2, pad_n))
        self.kicks = []

    def add(self, bus, sig, t, pan=0.0, gain=1.0, send=0.0):
        i = int(round(t * SR))
        if i < 0:
            sig = sig[..., -i:] if sig.ndim == 1 else sig[:, -i:]
            i = 0
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            st = np.stack([sig * l * 1.414, sig * r * 1.414])
        else:
            st = sig
        m = min(st.shape[1], self.bus[bus].shape[1] - i)
        if m <= 0:
            return
        self.bus[bus][:, i:i + m] += st[:, :m] * gain
        if send:
            self.send[:, i:i + m] += st[:, :m] * gain * send

    def sidechain(self, depth=0.72, k=9.0):
        n = self.bus["bass"].shape[1]
        env = np.ones(n)
        t = tt(n)
        for tk in self.kicks:
            i = int(tk * SR)
            seg = t[i:] - tk
            duck = 1 - depth * np.exp(-seg * k) * np.minimum(1, seg / 0.003 + 0.2)
            env[i:] = np.minimum(env[i:], duck)
        return env

    def render(self, gaps=()):
        sc = self.sidechain()
        music = self.bus["music"] * sc
        bassb = self.bus["bass"] * sc
        drums = self.bus["drums"]
        fx = self.bus["fx"]
        # 드롭 직전 무음 구간(석션)
        for a, b in gaps:
            ia, ib = int(a * SR), int(b * SR)
            ramp = int(0.004 * SR)
            for arr in (music, bassb, drums):
                arr[:, ia:ib] *= 0.0
                arr[:, ia - ramp:ia] *= np.linspace(1, 0, ramp)
        # 리버브(감쇠 노이즈 임펄스 응답)
        ir_n = int(2.4 * SR)
        te = tt(ir_n)
        env = np.exp(-6.9 * te / 2.2)
        irL = lp(noise(ir_n, 101) * env, 5200)
        irR = lp(noise(ir_n, 102) * env, 5200)
        pre = np.zeros(int(0.018 * SR))
        irL = np.concatenate([pre, irL]); irR = np.concatenate([pre, irR])
        irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
        send = self.send + music * 0.18
        wetL = signal.fftconvolve(send[0], irL)[: send.shape[1]]
        wetR = signal.fftconvolve(send[1], irR)[: send.shape[1]]
        wet = np.stack([wetL, wetR]) * 0.55
        mix = drums * 1.0 + bassb * 0.95 + music * 0.8 + fx * 0.9 + wet
        # 버스 컴프레션(느슨한 RMS 기반) + 부드러운 클리핑
        mono = np.abs(mix).max(axis=0)
        rms = np.sqrt(signal.lfilter([1 - 0.9995], [1, -0.9995], mono ** 2) + 1e-9)
        gain = np.minimum(1.0, (0.35 / rms) ** 0.35)
        mix = mix * gain
        mix = np.tanh(mix * 1.1) / np.tanh(1.1)
        out = mix[:, : self.n]
        # 끝부분 페이드
        fo = int(0.35 * SR)
        out[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
        out /= np.abs(out).max() / 0.89
        return out


# ───────────────────────────────────────── 편곡
PROG = [  # (베이스 근음, 패드 화음, 아르페지오 음)
    ("D2", ["D3", "F3", "A3", "E4"], ["D4", "A4", "F5", "A4", "E5", "A4", "D5", "F4"]),
    ("Bb1", ["Bb2", "D3", "F3", "C4"], ["Bb3", "F4", "D5", "F4", "C5", "F4", "Bb4", "D4"]),
    ("F2", ["F3", "A3", "C4", "E4"], ["F4", "C5", "A5", "C5", "E5", "C5", "F5", "A4"]),
    ("C2", ["C3", "E3", "G3", "D4"], ["C4", "G4", "E5", "G4", "D5", "G4", "C5", "E4"]),
]


def build(cut):
    ev = json.load(open(os.path.join(DATA, f"events_{cut}.json")))
    dur, BEAT, BAR = ev["dur"], ev["beat"], ev["bar"]
    M = Mix(dur)
    S16 = BEAT / 4
    gaps = []

    def part_at(t):
        for m in ev["music"]:
            if m["t0"] <= t < m["t1"]:
                return m["part"]
        return None

    total_bars = int(round(dur / BAR))
    for b in range(total_bars):
        t0 = b * BAR
        part = part_at(t0 + 1e-6)
        root, chord, arp = PROG[b % 4]
        rf = note(root)
        chord_f = [note(x) for x in chord]
        arp_f = [note(x) for x in arp]
        # 패드: 대부분의 구간에서 깔리지만 드롭에서는 낮게
        pad_gain = {"intro": 0.8, "breakdown": 1.0, "lift": 0.85, "dropA": 0.45, "dropB": 0.5, "build": 0.55, "slam": 0.0, "outro": 0.0}.get(part, 0.5)
        if pad_gain > 0:
            cutoff = {"intro": 900 + 500 * (b % 2), "breakdown": 1300, "lift": 1600}.get(part, 1800)
            M.add("music", pad(chord_f, BAR * 0.98, cutoff=cutoff, v=pad_gain), t0, send=0.5)
        if part in ("intro", "breakdown", "lift"):
            M.add("bass", sine(rf / 2, int(BAR * SR)) * np.minimum(1, tt(int(BAR * SR)) / 0.3) * 0.22, t0)
        drop = part in ("dropA", "dropB", "build")
        # 킥
        if drop or part == "lift":
            beats = range(4) if drop else (0, 2)
            for k in beats:
                tk = t0 + k * BEAT
                M.add("drums", kick(1.0), tk)
                M.kicks.append(tk)
        # 클랩
        if drop:
            for k in (1, 3):
                M.add("drums", clap(0.8), t0 + k * BEAT, pan=0.05, send=0.35)
        # 하이햇
        if drop or part in ("lift",) or (part == "intro" and b % 2 == 1) or (part == "breakdown" and b % 2 == 1):
            for s in range(16):
                ts = t0 + s * S16
                acc = 1.0 if s % 4 == 2 else 0.55 if s % 2 == 0 else 0.38
                if part == "intro":
                    acc *= 0.25 + 0.75 * s / 16
                    if s % 2:
                        continue
                if part == "breakdown" and s % 2:
                    continue
                M.add("drums", hat(acc, False, s), ts + (0.012 if s % 2 else 0), pan=0.25 if s % 2 else -0.15)
            if drop:
                for k in range(4):
                    M.add("drums", hat(0.55, True, k), t0 + k * BEAT + BEAT / 2, pan=-0.2)
        # 베이스(8분음, 사이드체인)
        if drop:
            pat = [1, 0, 1, 1, 0, 1, 1, 1]
            octs = [1, 1, 2, 1, 1, 2, 1, 2]
            for k in range(8):
                if pat[k]:
                    M.add("bass", bass(rf * octs[k], BEAT / 2 * 0.85, 0.9), t0 + k * BEAT / 2)
        # 아르페지오(16분음)
        if part in ("dropA", "dropB", "build", "breakdown", "lift") or (part == "intro" and b % 2 == 1 and cut == 30):
            bright = {"breakdown": 0.35 + 0.4 * (b % 2), "lift": 0.6, "dropA": 0.7, "dropB": 0.9, "build": 0.6 + 0.4 * (b % 2), "intro": 0.25}[part]
            for s in range(16):
                f = arp_f[s % 8]
                vv = (0.9 if s % 4 == 0 else 0.6) * (0.7 if part == "intro" else 1.0)
                pl = PLUCK(f, bright)
                pan = -0.35 if s % 2 else 0.35
                M.add("music", pl * 0.55 * vv, t0 + s * S16, pan=pan, send=0.25)
                M.add("music", pl * 0.18 * vv, t0 + s * S16 + S16 * 3, pan=-pan)
        # 드롭 B: 오프비트 스탭
        if part == "dropB":
            for k in range(4):
                M.add("music", stab([f * 2 for f in chord_f[:3]], 0.8), t0 + k * BEAT + BEAT / 2, pan=0.1, send=0.3)

    # 효과음 이벤트
    for e in ev["events"]:
        t, typ = e["t"], e["type"]
        d = e.get("dur", 0.3)
        if typ == "poster":
            M.add("fx", impact(False, 0.45), t, send=0.3)
            M.add("music", pad([note("D3"), note("A3"), note("E4"), note("F4")], 0.5, cutoff=2600, attack=0.005, release=1.2, v=1.2), t, send=0.6)
        elif typ == "shatter":
            M.add("fx", shatter(d, 0.9), t, send=0.3)
            M.add("fx", glitch(d * 0.8, 0.9, seed=1), t)
        elif typ == "heartbeat":
            M.add("fx", heartbeat(1.0), t, send=0.15)
            M.add("fx", blip(0, 0.7), t + 0.01, send=0.4)
        elif typ == "type":
            M.add("fx", typing(0.42, 0.8, seed=int(t * 10)), t, pan=-0.2)
        elif typ == "riser":
            M.add("fx", riser(d, 0.9), t, send=0.25)
        elif typ == "roll":
            n16 = int(d / (BEAT / 4))
            tcur = t
            for k in range(64):
                frac = (tcur - t) / d
                if frac >= 1:
                    break
                M.add("drums", snare(0.25 + 0.6 * frac), tcur, send=0.2)
                tcur += (BEAT / 4) * (1 - 0.5 * frac)
        elif typ == "suck":
            M.add("fx", swell(BEAT * 1.0, 0.9), t - BEAT * 1.0 + (BEAT * 0.125))
            gaps.append((t, t + BEAT * 0.125 - 0.004))
        elif typ == "impact":
            M.add("fx", impact(e.get("big", False), 1.0), t, send=0.35)
        elif typ == "hit":
            M.add("fx", impact(False, 0.45), t, send=0.25)
        elif typ == "slam":
            big = e.get("big", False)
            M.add("drums", kick(1.1), t)
            M.kicks.append(t)
            M.add("drums", clap(0.9 if big else 0.6), t, send=0.4)
            M.add("fx", impact(big, 0.7 if big else 0.4), t, send=0.3)
            if big:
                pitch_set = [["D3", "A3", "D4", "F4"], ["Bb2", "F3", "Bb3", "D4"], ["C3", "G3", "C4", "E4"]]
                ch = pitch_set[int(round((t % (BEAT * 4)) / BEAT)) % 3]
                M.add("music", stab([note(x) for x in ch], 1.3), t, send=0.5)
            else:
                M.add("fx", blip(e.get("pitch", 0) + 1, 0.8), t, send=0.3)
        elif typ == "swell":
            M.add("fx", swell(d, 1.0), t)
        elif typ == "sting":
            M.add("fx", impact(True, 0.9), t, send=0.5)
            M.add("music", pad([note("D3"), note("A3"), note("E4"), note("F4"), note("A4")], BAR * 0.7, cutoff=2400, attack=0.01, release=1.6, v=1.4), t, send=0.8)
            for k, nm in enumerate(["D5", "A5", "E6"]):
                M.add("fx", bell(note(nm), 0.9, 2.0), t + k * 0.06, pan=(k - 1) * 0.5, send=0.6)
        elif typ == "blip":
            M.add("fx", blip(e.get("pitch", 0), 0.8), t, pan=((e.get("pitch", 0) % 5) - 2) * 0.3, send=0.35)
        elif typ == "tick":
            M.add("fx", tick(0.9), t, pan=0.3)
            M.add("fx", blip(e.get("pitch", 0) + 3, 0.5), t, pan=0.3, send=0.3)
        elif typ == "sweep":
            M.add("fx", downsweep(d, 0.9), t, send=0.3)
        elif typ == "whoosh":
            M.add("fx", whoosh(d, 1.0, direction=-1), t, send=0.2)
        elif typ == "whooshIn":
            M.add("fx", whoosh(0.28, 0.5, direction=1), t - 0.05)
        elif typ == "glitch":
            M.add("fx", glitch(0.12, 1.0, seed=int(t * 7)), t)
        elif typ == "buzz":
            M.add("fx", buzz(d, 1.0), t)
        elif typ == "drawon":
            M.add("fx", drawon(d, 1.0), t, send=0.4)
    out = M.render(gaps)
    return out


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x.T * (2 ** 23 - 1)).astype(np.int32)
    b = np.zeros((pcm.shape[0], 2, 3), dtype=np.uint8)
    for ch in range(2):
        v = pcm[:, ch].astype(np.int64) & 0xFFFFFF
        b[:, ch, 0] = v & 0xFF
        b[:, ch, 1] = (v >> 8) & 0xFF
        b[:, ch, 2] = (v >> 16) & 0xFF
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b.tobytes())


def embed_m4a(wav, m4a, target=-14.0):
    """HTML 재생용 AAC(음량 정규화 포함)를 만듭니다."""
    import subprocess
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", wav, "-af", f"loudnorm=I={target}:TP=-2:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    af = (f"loudnorm=I={target}:TP=-2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-af", af, "-c:a", "aac_at", "-b:a", "192k", "-movflags", "+faststart", m4a], check=True)


if __name__ == "__main__":
    cuts = [int(c) for c in sys.argv[1:]] or [30, 15]
    for cut in cuts:
        out = build(cut)
        path = os.path.join(DATA, f"audio_{cut}.wav")
        write_wav(path, out)
        embed_m4a(path, os.path.join(DATA, f"audio_{cut}.m4a"))
        print(cut, "->", path, f"{out.shape[1] / SR:.3f}s", "peak", float(np.abs(out).max()))
