"""Build the four QUIZ NIGHT wavs from nothing: every sound is synthesised here,
so the pack redistributes no one's recording.

    python3 make_sounds.py      (needs numpy)

24 kHz, 16-bit mono keeps all four inside the mic's 1 MB with room to spare.
"""
import wave
from pathlib import Path

import numpy as np

SR = 24_000
HERE = Path(__file__).resolve().parent
rng = np.random.default_rng(19650)


def t(seconds):
    return np.arange(int(seconds * SR)) / SR


def band(x, lo, hi):
    """Zero-phase band-pass by FFT mask, with soft edges so nothing rings."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-9), 0, 1) if lo else np.ones_like(f)
    m *= np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(np.fft.rfft(x) * m, len(x))


def place(out, sound, at):
    i = int(at * SR)
    n = min(len(sound), len(out) - i)
    out[i:i + n] += sound[:n]


def write(name, x, peak_db):
    x = x / np.abs(x).max() * 10 ** (peak_db / 20)
    fade = min(len(x), int(0.005 * SR))
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(str(HERE / name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    print(f'{name:14} {len(x) / SR:4.1f} s  {(HERE / name).stat().st_size // 1024} KB')


def bell(freq, seconds):
    """Struck-bar partials, the upper ones dying first: a doorbell, not a church."""
    tt = t(seconds)
    x = np.zeros_like(tt)
    for ratio, amp, decay in ((1, 1.0, 1.1), (2.0, 0.35, 0.6), (2.76, 0.25, 0.35), (5.4, 0.12, 0.15)):
        x += amp * np.sin(2 * np.pi * freq * ratio * tt) * np.exp(-tt / decay)
    return x * np.clip(tt / 0.002, 0, 1)


def chime():
    x = np.zeros(int(2.4 * SR))
    place(x, bell(659.3, 2.4), 0.0)      # E5
    place(x, bell(523.3, 1.9), 0.5)      # C5
    return x


def applause():
    """About forty people clapping: short band-limited noise bursts at random
    times, swelling in and tailing off, over a thin wash of the same noise."""
    secs = 4.5
    x = np.zeros(int(secs * SR))
    clap_len = int(0.03 * SR)
    env = np.exp(-np.arange(clap_len) / (0.006 * SR))
    for _ in range(40):
        rate = rng.uniform(3.5, 5.5)                 # claps a second, per person
        start = rng.uniform(0.0, 0.5)
        stop = rng.uniform(2.8, 4.2)
        loud = rng.uniform(0.3, 1.0)
        tone = rng.uniform(900, 2200)                # each pair of hands sounds different
        clap = band(rng.standard_normal(clap_len), tone * 0.5, tone * 2.2) * env
        at = start
        while at < stop:
            place(x, clap * loud * rng.uniform(0.7, 1.0), at)
            at += 1 / rate * rng.uniform(0.85, 1.15)
    tt = t(secs)
    x += 0.15 * band(rng.standard_normal(len(x)), 500, 6000) * np.clip(tt / 0.4, 0, 1)
    return x * np.clip(tt / 0.25, 0, 1) * np.clip((secs - tt) / 1.3, 0, 1)


def walkon():
    """Four bars of game-show brass at 128 bpm: C, F, G, then a held C with a
    cymbal. It ends on its own, so it works whether startstop loops or not."""
    bpm = 128
    beat = 60 / bpm
    secs = 4 * 4 * beat + 1.2
    x = np.zeros(int(secs * SR))

    def midi(n):
        return 440 * 2 ** ((n - 69) / 12)

    def brass(notes, length):
        tt = t(length)
        s = np.zeros_like(tt)
        for n in notes:
            for detune in (-0.12, 0.12):
                f = midi(n + detune)
                s += (2 * ((f * tt) % 1) - 1)          # saw
        s = band(s, 80, 3500)
        attack = np.clip(tt / 0.02, 0, 1)
        release = np.clip((length - tt) / 0.06, 0, 1)
        return s * attack * release

    def kick():
        tt = t(0.3)
        return np.sin(2 * np.pi * (50 * tt + 60 * 0.04 * (1 - np.exp(-tt / 0.04)))) * np.exp(-tt / 0.12)

    def snare():
        tt = t(0.2)
        return (band(rng.standard_normal(len(tt)), 1500, 8000) * 0.7
                + 0.4 * np.sin(2 * np.pi * 190 * tt)) * np.exp(-tt / 0.06)

    def hat():
        tt = t(0.05)
        return band(rng.standard_normal(len(tt)), 6000, 11000) * np.exp(-tt / 0.012) * 0.35

    chords = [(60, 64, 67, 72), (60, 65, 69, 72), (59, 62, 67, 71)]   # C, F/C, G/B
    stabs = (0, 1.5, 2.5, 3.0)                                        # beats within a bar
    for bar, chord in enumerate(chords):
        base = bar * 4 * beat
        for b in stabs:
            place(x, brass(chord, beat * 0.45) * 0.5, base + b * beat)
        place(x, band(brass((chord[0] - 24,), 4 * beat * 0.95), 40, 400) * 0.9, base)
    end = 3 * 4 * beat
    place(x, brass((60, 64, 67, 72, 76), 4 * beat + 1.0) * 0.5, end)
    place(x, band(brass((36,), 4 * beat + 1.0), 40, 400) * 0.9, end)
    crash_t = t(2.5)
    place(x, band(rng.standard_normal(len(crash_t)), 3000, 11000) * np.exp(-crash_t / 0.8) * 0.5, end)
    for b in range(12):
        at = b * beat
        place(x, kick(), at)
        if b % 2:
            place(x, snare(), at)
        place(x, hat(), at + beat / 2)
    place(x, kick(), end)
    tt = t(secs)
    return x * np.clip((secs - tt) / 1.5, 0, 1)


def buzzer():
    """The wrong-answer buzzer: two falling notes, square-ish and a bit sour."""
    x = np.zeros(int(1.2 * SR))
    for f, at, length in ((155, 0.0, 0.3), (116, 0.33, 0.8)):
        tt = t(length)
        s = sum(np.sign(np.sin(2 * np.pi * f * d * tt)) for d in (1.0, 1.012))
        s = band(s, 60, 2500) * np.clip(tt / 0.01, 0, 1) * np.clip((length - tt) / 0.05, 0, 1)
        place(x, s, at)
    return x


if __name__ == '__main__':
    write('chime.wav', chime(), -3)
    write('applause.wav', applause(), -4)
    write('walkon.wav', walkon(), -4)
    write('buzzer.wav', buzzer(), -10)
