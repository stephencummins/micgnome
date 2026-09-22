/**
 * Turning the mic's numbers into audio ones.
 *
 * A straight port of src/preview/mapping.ts, deliberately line for line: the
 * browser preview and the plugin must not disagree about what "cutoff 0.3"
 * sounds like, or a pack auditioned on the site would arrive in the DAW as a
 * different preset. If one of these readings is corrected the day someone
 * hears the real mic, correct both.
 *
 * The one rule the preview follows and this keeps: **never pretend.** A block
 * we cannot honestly approximate is declared unplayed and named in the UI.
 * Where the plugin can do better than the browser — HARMONY and SSB, which
 * Web Audio has no node for — it plays them properly rather than skipping.
 */
#pragma once

#include <cmath>

namespace mapping
{
inline float clamp (float v, float lo, float hi) { return std::fmin (hi, std::fmax (lo, v)); }

/**
 * 0..1 across a frequency range, by ear rather than by arithmetic: pitch is
 * logarithmic, so a linear sweep spends most of its travel doing nothing
 * audible at the top.
 */
inline float exponential (float x, float lo, float hi)
{
    return lo * std::pow (hi / lo, clamp (x, 0.0f, 1.0f));
}

/**
 * A low-pass at "0" should sound closed but not silent — the device plainly
 * still passes voice there, and a preview that goes mute reads as broken.
 */
inline float lowpassHz (float x) { return exponential (x, 90.0f, 18000.0f); }

/** A high-pass at "0" is off, so it must sit below anything audible. */
inline float highpassHz (float x) { return exponential (x, 20.0f, 6000.0f); }

/** The EQ band sweeps the range a voice actually occupies. */
inline float eqHz (float x) { return exponential (x, 120.0f, 8000.0f); }

/** Wide to surgical. Never below 0.3, which stops being a band at all. */
inline float eqQ (float x) { return 0.3f + clamp (x, 0.0f, 1.0f) * 11.7f; }

/** The one parameter besides SSB that goes negative: a cut as well as a boost. */
inline float eqGainDb (float x) { return clamp (x, -1.0f, 1.0f) * 20.0f; }

/** Delay "time" 0..1.1. The ceiling is 1.1, not 1.0 — see the spec's note. */
inline float delaySeconds (float x) { return 0.01f + clamp (x, 0.0f, 1.1f) * 0.99f; }

/** Reverb "time" as the length of the tail. */
inline float reverbSeconds (float x) { return 0.15f + clamp (x, 0.0f, 1.0f) * 3.5f; }

/** RING and SSB carry real hertz already; only guard the range. */
inline float ringHz (float x) { return clamp (x, 0.0f, 20000.0f); }

/**
 * DIST "amount" runs to 40, which is a lot of drive. Curve it so the first
 * third of the range is usable rather than instantly destroyed.
 */
inline float distortionDrive (float x) { return std::pow (clamp (x, 0.0f, 40.0f) / 40.0f, 0.6f) * 100.0f; }

/**
 * Standard soft-clip: gentle at low drive, squarer as it climbs, and
 * symmetrical so it adds odd harmonics like an overdriven preamp rather than
 * sounding like a broken speaker. The browser bakes this into a 1024-point
 * waveshaper table; here it is cheap enough to evaluate per sample, which
 * also means no stair-stepping on the way in.
 */
inline float softClip (float x, float drive)
{
    const auto k = std::fmax (0.0001f, drive);
    return ((1.0f + k) * x) / (1.0f + k * std::fabs (x));
}

/** 0 = hard left, 1 = hard right, 0.5 = centre. The panner wants -1..1. */
inline float balanceToPan (float x) { return clamp (x, 0.0f, 1.0f) * 2.0f - 1.0f; }

/**
 * Apply a modulation source to a parameter.
 *
 * The device's movers are described only as "moves one parameter on one row"
 * by some depth, so this is our reading: depth is a signed proportion of the
 * parameter's own published range, added to its set value and clamped back
 * into range.
 */
inline float modulate (float base, float depth, float amount, float min, float max)
{
    return clamp (base + depth * amount * (max - min), std::fmin (min, max), std::fmax (min, max));
}
} // namespace mapping
