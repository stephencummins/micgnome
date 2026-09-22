/**
 * The small pieces every block is built from.
 *
 * Nothing here allocates, takes a lock or touches a file once prepare() has
 * run, because all of it is called from the audio thread. That is the one
 * rule that separates a plugin that works from one that clicks under load,
 * and it is a discipline rather than a feature, so it does not announce
 * itself anywhere else.
 */
#pragma once

#include <array>
#include <cmath>
#include <vector>

namespace dsp
{
constexpr float pi = 3.14159265358979323846f;

/**
 * A transposed direct-form II biquad. Hand-rolled rather than juce::dsp::IIR
 * because that one builds its coefficients into a reference-counted object —
 * an allocation, on the audio thread, every time a filter sweeps.
 */
struct Biquad
{
    void reset() { z1 = z2 = 0.0f; }

    float process (float x)
    {
        const auto y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        return y;
    }

    void setLowpass (float hz, float sampleRate, float q = 0.70710678f)
    {
        const auto w = omega (hz, sampleRate);
        const auto alpha = std::sin (w) / (2.0f * q);
        const auto cosw = std::cos (w);
        normalise ((1.0f - cosw) * 0.5f, 1.0f - cosw, (1.0f - cosw) * 0.5f,
                   1.0f + alpha, -2.0f * cosw, 1.0f - alpha);
    }

    void setHighpass (float hz, float sampleRate, float q = 0.70710678f)
    {
        const auto w = omega (hz, sampleRate);
        const auto alpha = std::sin (w) / (2.0f * q);
        const auto cosw = std::cos (w);
        normalise ((1.0f + cosw) * 0.5f, -(1.0f + cosw), (1.0f + cosw) * 0.5f,
                   1.0f + alpha, -2.0f * cosw, 1.0f - alpha);
    }

    void setPeaking (float hz, float sampleRate, float q, float gainDb)
    {
        const auto a = std::pow (10.0f, gainDb / 40.0f);
        const auto w = omega (hz, sampleRate);
        const auto alpha = std::sin (w) / (2.0f * q);
        const auto cosw = std::cos (w);
        normalise (1.0f + alpha * a, -2.0f * cosw, 1.0f - alpha * a,
                   1.0f + alpha / a, -2.0f * cosw, 1.0f - alpha / a);
    }

private:
    static float omega (float hz, float sampleRate)
    {
        // Keep the corner inside the band: a filter asked for more than
        // Nyquist is a filter asked to produce NaNs.
        const auto limited = std::fmin (std::fmax (hz, 10.0f), sampleRate * 0.49f);
        return 2.0f * pi * limited / sampleRate;
    }

    void normalise (float nb0, float nb1, float nb2, float na0, float na1, float na2)
    {
        b0 = nb0 / na0; b1 = nb1 / na0; b2 = nb2 / na0;
        a1 = na1 / na0; a2 = na2 / na0;
    }

    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f, a1 = 0.0f, a2 = 0.0f;
    float z1 = 0.0f, z2 = 0.0f;
};

/** A one-pole smoother, so a swept parameter slides instead of stepping. */
struct Smoothed
{
    void prepare (float sampleRate, float ms, float initial)
    {
        coeff = std::exp (-1.0f / (sampleRate * ms * 0.001f));
        value = target = initial;
    }

    void set (float v) { target = v; }
    void snap (float v) { value = target = v; }
    float next() { value = target + (value - target) * coeff; return value; }
    float current() const { return value; }

private:
    float coeff = 0.0f, value = 0.0f, target = 0.0f;
};

/** A delay line with fractional reads, which is all three of delay, harmony and spring. */
struct DelayLine
{
    void prepare (int maxSamples)
    {
        buffer.assign (static_cast<size_t> (maxSamples) + 4, 0.0f);
        writePos = 0;
    }

    void reset() { std::fill (buffer.begin(), buffer.end(), 0.0f); writePos = 0; }

    void write (float x)
    {
        buffer[static_cast<size_t> (writePos)] = x;
        if (++writePos >= static_cast<int> (buffer.size()))
            writePos = 0;
    }

    /** Linear interpolation: cheap, and its top-end loss is inaudible on a voice. */
    float read (float delaySamples) const
    {
        const auto size = static_cast<int> (buffer.size());
        const auto limited = std::fmin (std::fmax (delaySamples, 1.0f), static_cast<float> (size - 2));
        auto pos = static_cast<float> (writePos) - limited;
        while (pos < 0.0f) pos += static_cast<float> (size);

        const auto i = static_cast<int> (pos);
        const auto frac = pos - static_cast<float> (i);
        const auto a = buffer[static_cast<size_t> (i)];
        const auto b = buffer[static_cast<size_t> ((i + 1) % size)];
        return a + frac * (b - a);
    }

private:
    std::vector<float> buffer;
    int writePos = 0;
};

/** A second-order allpass, the building block of both the Hilbert pair and the spring. */
struct Allpass2
{
    void setCoefficient (float a) { a2 = a * a; }
    void reset() { x1 = x2 = y1 = y2 = 0.0f; }

    float process (float x)
    {
        const auto y = a2 * (x + y2) - x2;
        x2 = x1; x1 = x;
        y2 = y1; y1 = y;
        return y;
    }

private:
    float a2 = 0.0f, x1 = 0.0f, x2 = 0.0f, y1 = 0.0f, y2 = 0.0f;
};

/**
 * A Hilbert transformer: two allpass chains whose outputs stay 90 degrees
 * apart across the band. This is what a frequency shifter needs and what a
 * browser has no node for, which is why SSB is skipped in the preview and
 * played here. Coefficients are the standard four-section pair.
 */
struct Hilbert
{
    Hilbert()
    {
        constexpr float coeffsA[] = { 0.6923877778065f, 0.9360654322959f, 0.9882295226860f, 0.9987488452737f };
        constexpr float coeffsB[] = { 0.4021921162426f, 0.8561710882420f, 0.9722909545651f, 0.9952884791278f };
        for (size_t i = 0; i < 4; ++i)
        {
            a[i].setCoefficient (coeffsA[i]);
            b[i].setCoefficient (coeffsB[i]);
        }
    }

    void reset()
    {
        for (auto& f : a) f.reset();
        for (auto& f : b) f.reset();
        delayed = 0.0f;
    }

    /** Returns the in-phase and quadrature parts of one sample. */
    void process (float x, float& inPhase, float& quadrature)
    {
        auto p = delayed;   // branch B runs one sample behind, which is part of the design
        delayed = x;
        for (auto& f : b) p = f.process (p);

        auto q = x;
        for (auto& f : a) q = f.process (q);

        inPhase = p;
        quadrature = q;
    }

private:
    std::array<Allpass2, 4> a, b;
    float delayed = 0.0f;
};

/**
 * Pitch shifting by two crossfaded taps on a delay line — the rotating tape
 * head, which is how cheap hardware harmonisers have always done it. A phase
 * vocoder would be cleaner and would not sound like this mic.
 */
struct PitchShifter
{
    void prepare (float sampleRate)
    {
        window = sampleRate * 0.055f;         // ~55ms: long enough not to warble, short enough not to slap
        line.prepare (static_cast<int> (window * 2.0f) + 8);
        phase = 0.0f;
    }

    void reset() { line.reset(); phase = 0.0f; }

    float process (float x, float ratio)
    {
        line.write (x);

        // A ratio above 1 shrinks the read offset, which is what plays back fast.
        phase += 1.0f - ratio;
        while (phase < 0.0f) phase += window;
        while (phase >= window) phase -= window;

        const auto second = phase + window * 0.5f >= window ? phase - window * 0.5f : phase + window * 0.5f;

        // Raised cosine on each tap's position, so one fades up as the other
        // reaches the end of the window and has to jump.
        const auto g1 = 0.5f * (1.0f - std::cos (2.0f * pi * phase / window));
        const auto g2 = 0.5f * (1.0f - std::cos (2.0f * pi * second / window));

        return line.read (phase + 1.0f) * g1 + line.read (second + 1.0f) * g2;
    }

private:
    DelayLine line;
    float window = 1.0f, phase = 0.0f;
};
} // namespace dsp
