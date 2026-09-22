/**
 * The mic's effect blocks, one class each.
 *
 * Every block reads its parameters in the order src/fxmic/spec.ts declares
 * them, because that is the order Spec.generated.h emits and the order the
 * chain hands them over. Add a parameter in the TypeScript and it appears
 * here as a new index — which is why the names are asserted at build time in
 * Chain.cpp rather than trusted.
 *
 * Signal flow is top to bottom, the mic's own rule, so a block only ever sees
 * what the blocks above it did.
 */
#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <memory>

#include "Dsp.h"
#include "Mapping.h"

namespace blocks
{
/** Parameters arrive once per control block; audio in chunks no longer than that. */
constexpr int controlBlock = 64;

struct Block
{
    virtual ~Block() = default;

    /** Allocate here and nowhere else. controlRate is sampleRate / controlBlock. */
    virtual void prepare (float sampleRate, float controlRate) = 0;
    virtual void reset() = 0;

    /** Values in the effect's own parameter order, already modulated. */
    virtual void setParams (const float* v) = 0;

    virtual void process (float* left, float* right, int n) = 0;
};

/** A gain that slides across the block instead of stepping at its edge. */
struct Ramp
{
    void snap (float v) { current = target = v; }
    void set (float v) { target = v; }

    /** Call once per block; returns the per-sample step to add to `current`. */
    float step (int n)
    {
        const auto d = (target - current) / static_cast<float> (juce::jmax (1, n));
        return d;
    }

    float current = 0.0f, target = 0.0f;
};

//==============================================================================
struct Lowpass : Block
{
    void prepare (float sr, float cr) override { rate = sr; cutoff.prepare (cr, 20.0f, 1.0f); }
    void reset() override { l.reset(); r.reset(); }
    void setParams (const float* v) override { cutoff.set (v[0]); }

    void process (float* left, float* right, int n) override
    {
        const auto hz = mapping::lowpassHz (cutoff.next());
        l.setLowpass (hz, rate);
        r.setLowpass (hz, rate);
        for (int i = 0; i < n; ++i) { left[i] = l.process (left[i]); right[i] = r.process (right[i]); }
    }

    float rate = 48000.0f;
    dsp::Smoothed cutoff;
    dsp::Biquad l, r;
};

struct Highpass : Block
{
    void prepare (float sr, float cr) override { rate = sr; cutoff.prepare (cr, 20.0f, 0.0f); }
    void reset() override { l.reset(); r.reset(); }
    void setParams (const float* v) override { cutoff.set (v[0]); }

    void process (float* left, float* right, int n) override
    {
        const auto hz = mapping::highpassHz (cutoff.next());
        l.setHighpass (hz, rate);
        r.setHighpass (hz, rate);
        for (int i = 0; i < n; ++i) { left[i] = l.process (left[i]); right[i] = r.process (right[i]); }
    }

    float rate = 48000.0f;
    dsp::Smoothed cutoff;
    dsp::Biquad l, r;
};

struct Equaliser : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        cutoff.prepare (cr, 20.0f, 0.5f);
        q.prepare (cr, 20.0f, 0.5f);
        gain.prepare (cr, 20.0f, 0.0f);
    }

    void reset() override { l.reset(); r.reset(); }
    void setParams (const float* v) override { cutoff.set (v[0]); q.set (v[1]); gain.set (v[2]); }

    void process (float* left, float* right, int n) override
    {
        const auto hz = mapping::eqHz (cutoff.next());
        const auto qv = mapping::eqQ (q.next());
        const auto db = mapping::eqGainDb (gain.next());
        l.setPeaking (hz, rate, qv, db);
        r.setPeaking (hz, rate, qv, db);
        for (int i = 0; i < n; ++i) { left[i] = l.process (left[i]); right[i] = r.process (right[i]); }
    }

    float rate = 48000.0f;
    dsp::Smoothed cutoff, q, gain;
    dsp::Biquad l, r;
};

/**
 * The stereo panning law from the Web Audio spec, so a BALANCE row lands in
 * the same place here as it does in the browser preview: the near channel
 * keeps its level and the far one bleeds across.
 */
inline void panStereo (float inL, float inR, float pan, float& outL, float& outR)
{
    const auto x = (pan <= 0.0f ? pan + 1.0f : pan) * dsp::pi * 0.5f;
    const auto c = std::cos (x), s = std::sin (x);
    if (pan <= 0.0f) { outL = inL + inR * c; outR = inR * s; }
    else             { outL = inL * c;       outR = inR + inL * s; }
}

struct Balance : Block
{
    void prepare (float, float) override { pan.snap (0.0f); }
    void reset() override {}
    void setParams (const float* v) override { pan.set (mapping::balanceToPan (v[0])); }

    void process (float* left, float* right, int n) override
    {
        const auto d = pan.step (n);
        for (int i = 0; i < n; ++i)
        {
            panStereo (left[i], right[i], pan.current, left[i], right[i]);
            pan.current += d;
        }
        pan.current = pan.target;
    }

    Ramp pan;
};

struct Dist : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        amount.prepare (cr, 20.0f, 10.0f);
        low.prepare (cr, 20.0f, 1.0f);
        high.prepare (cr, 20.0f, 0.0f);
        mix.snap (0.5f);
    }

    void reset() override { for (auto* f : { &lpL, &lpR, &hpL, &hpR }) f->reset(); }

    void setParams (const float* v) override
    {
        amount.set (v[0]);
        mix.set (v[1]);
        low.set (v[2]);
        high.set (v[3]);
    }

    void process (float* left, float* right, int n) override
    {
        const auto drive = mapping::distortionDrive (amount.next());
        const auto lowHz = mapping::lowpassHz (low.next());
        const auto highHz = mapping::highpassHz (high.next());
        lpL.setLowpass (lowHz, rate); lpR.setLowpass (lowHz, rate);
        hpL.setHighpass (highHz, rate); hpR.setHighpass (highHz, rate);

        const auto d = mix.step (n);
        for (int i = 0; i < n; ++i)
        {
            const auto wetL = lpL.process (mapping::softClip (hpL.process (left[i]), drive));
            const auto wetR = lpR.process (mapping::softClip (hpR.process (right[i]), drive));
            left[i] = wetL * mix.current + left[i] * (1.0f - mix.current);
            right[i] = wetR * mix.current + right[i] * (1.0f - mix.current);
            mix.current += d;
        }
        mix.current = mix.target;
    }

    float rate = 48000.0f;
    dsp::Smoothed amount, low, high;
    Ramp mix;
    dsp::Biquad lpL, lpR, hpL, hpR;
};

struct Ring : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        frequency.prepare (cr, 20.0f, 200.0f);
        mix.snap (0.5f);
        phase = 0.0f;
    }

    void reset() override { phase = 0.0f; }
    void setParams (const float* v) override { frequency.set (mapping::ringHz (v[0])); mix.set (v[1]); }

    void process (float* left, float* right, int n) override
    {
        const auto inc = 2.0f * dsp::pi * frequency.next() / rate;
        const auto d = mix.step (n);
        for (int i = 0; i < n; ++i)
        {
            const auto carrier = std::sin (phase);
            phase += inc;
            if (phase > 2.0f * dsp::pi) phase -= 2.0f * dsp::pi;

            left[i] = left[i] * carrier * mix.current + left[i] * (1.0f - mix.current);
            right[i] = right[i] * carrier * mix.current + right[i] * (1.0f - mix.current);
            mix.current += d;
        }
        mix.current = mix.target;
    }

    float rate = 48000.0f, phase = 0.0f;
    dsp::Smoothed frequency;
    Ramp mix;
};

/**
 * DELAY, including the cross-feed the browser preview leaves out: Web Audio
 * has no tidy way to cross two feedback paths, and in C++ it is one line.
 */
struct Delay : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        // time tops out at 1.1, which maps to 1.099 seconds. Two seconds of
        // line leaves room for the smoother to lag behind a jump.
        const auto maxSamples = static_cast<int> (sr * 2.0f);
        lineL.prepare (maxSamples);
        lineR.prepare (maxSamples);
        time.prepare (cr, 60.0f, mapping::delaySeconds (0.4f) * sr);
        low.prepare (cr, 20.0f, 1.0f);
        high.prepare (cr, 20.0f, 0.0f);
        echo.prepare (cr, 20.0f, 0.4f);
        cross.prepare (cr, 20.0f, 0.0f);
        wet.snap (0.5f); dry.snap (1.0f); pan.snap (0.0f);
    }

    void reset() override
    {
        lineL.reset(); lineR.reset();
        for (auto* f : { &lpL, &lpR, &hpL, &hpR }) f->reset();
    }

    void setParams (const float* v) override
    {
        time.set (mapping::delaySeconds (v[0]) * rate);
        echo.set (v[1]);
        cross.set (v[2]);
        low.set (v[3]);
        high.set (v[4]);
        wet.set (v[5]);
        dry.set (v[6]);
        pan.set (mapping::balanceToPan (v[7]));
    }

    void process (float* left, float* right, int n) override
    {
        const auto delaySamples = time.next();
        // Feedback must stay below 1 or the echo grows without limit.
        const auto fb = std::fmin (0.95f, echo.next());
        const auto cf = cross.next();
        const auto lowHz = mapping::lowpassHz (low.next());
        const auto highHz = mapping::highpassHz (high.next());
        lpL.setLowpass (lowHz, rate); lpR.setLowpass (lowHz, rate);
        hpL.setHighpass (highHz, rate); hpR.setHighpass (highHz, rate);

        const auto dWet = wet.step (n), dDry = dry.step (n), dPan = pan.step (n);
        for (int i = 0; i < n; ++i)
        {
            const auto echoL = lpL.process (hpL.process (lineL.read (delaySamples)));
            const auto echoR = lpR.process (hpR.process (lineR.read (delaySamples)));

            lineL.write (left[i] + fb * ((1.0f - cf) * echoL + cf * echoR));
            lineR.write (right[i] + fb * ((1.0f - cf) * echoR + cf * echoL));

            float wetL, wetR;
            panStereo (echoL, echoR, pan.current, wetL, wetR);
            left[i] = wetL * wet.current + left[i] * dry.current;
            right[i] = wetR * wet.current + right[i] * dry.current;

            wet.current += dWet; dry.current += dDry; pan.current += dPan;
        }
        wet.current = wet.target; dry.current = dry.target; pan.current = pan.target;
    }

    float rate = 48000.0f;
    dsp::DelayLine lineL, lineR;
    dsp::Smoothed time, echo, cross, low, high;
    Ramp wet, dry, pan;
    dsp::Biquad lpL, lpR, hpL, hpR;
};

/**
 * REVERB. The room is Freeverb, which JUCE ships; the spring is a chain of
 * allpasses, which is what disperses a real spring's reflections into that
 * metallic chirp. Both are a reading — nobody has heard the mic's reverb yet.
 */
struct Reverb : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        room.setSampleRate (sr);
        time.prepare (cr, 50.0f, 0.4f);
        spring.prepare (cr, 50.0f, 0.0f);
        high.prepare (cr, 20.0f, 0.0f);
        wet.snap (0.4f); dry.snap (1.0f);

        springDelay.prepare (static_cast<int> (sr * 0.05f) + 8);
        float c = 0.55f;
        for (auto& ap : dispersion) { ap.setCoefficient (c); c += 0.025f; }
    }

    void reset() override
    {
        room.reset();
        springDelay.reset();
        for (auto& ap : dispersion) ap.reset();
        hpL.reset(); hpR.reset();
    }

    void setParams (const float* v) override
    {
        time.set (v[0]);
        wet.set (v[1]);
        dry.set (v[2]);
        spring.set (v[3]);
        high.set (v[4]);
    }

    void process (float* left, float* right, int n) override
    {
        const auto seconds = mapping::reverbSeconds (time.next());
        const auto springAmount = spring.next();
        const auto highHz = mapping::highpassHz (high.next());
        hpL.setHighpass (highHz, rate); hpR.setHighpass (highHz, rate);

        juce::Reverb::Parameters p;
        // Freeverb's room size is not seconds; this is the curve that puts the
        // published range of tails roughly where the numbers say they are.
        p.roomSize = mapping::clamp ((seconds - 0.15f) / 3.5f, 0.0f, 1.0f) * 0.75f + 0.2f;
        // A brighter tail rings longer at the top, which is the spring end of it.
        p.damping = 1.0f - springAmount * 0.8f;
        p.wetLevel = 1.0f;
        p.dryLevel = 0.0f;
        p.width = 1.0f;
        room.setParameters (p);

        // Freeverb wants its own buffers, so the wet path is built separately
        // and mixed back afterwards.
        for (int i = 0; i < n; ++i)
        {
            scratchL[i] = hpL.process (left[i]);
            scratchR[i] = hpR.process (right[i]);
        }
        room.processStereo (scratchL, scratchR, n);

        if (springAmount > 0.001f)
        {
            for (int i = 0; i < n; ++i)
            {
                springDelay.write (0.5f * (scratchL[i] + scratchR[i]));
                auto s = springDelay.read (rate * 0.023f);
                for (auto& ap : dispersion) s = ap.process (s);
                scratchL[i] += s * springAmount;
                scratchR[i] += s * springAmount * 0.8f;   // not quite mono, like a real tank
            }
        }

        const auto dWet = wet.step (n), dDry = dry.step (n);
        for (int i = 0; i < n; ++i)
        {
            left[i] = scratchL[i] * wet.current + left[i] * dry.current;
            right[i] = scratchR[i] * wet.current + right[i] * dry.current;
            wet.current += dWet; dry.current += dDry;
        }
        wet.current = wet.target; dry.current = dry.target;
    }

    float rate = 48000.0f;
    juce::Reverb room;
    dsp::Smoothed time, spring, high;
    Ramp wet, dry;
    dsp::Biquad hpL, hpR;
    dsp::DelayLine springDelay;
    std::array<dsp::Allpass2, 8> dispersion;
    float scratchL[controlBlock] {}, scratchR[controlBlock] {};
};

/** HARMONY — the block the browser preview has to skip. */
struct Harmony : Block
{
    void prepare (float sr, float cr) override
    {
        shiftL.prepare (sr);
        shiftR.prepare (sr);
        pitch.prepare (cr, 30.0f, 1.0f);
        dry.snap (1.0f);
    }

    void reset() override { shiftL.reset(); shiftR.reset(); }
    void setParams (const float* v) override { pitch.set (v[0]); dry.set (v[1]); }

    void process (float* left, float* right, int n) override
    {
        const auto ratio = mapping::clamp (pitch.next(), 0.25f, 4.0f);
        const auto d = dry.step (n);
        for (int i = 0; i < n; ++i)
        {
            const auto hL = shiftL.process (left[i], ratio);
            const auto hR = shiftR.process (right[i], ratio);
            left[i] = hL + left[i] * dry.current;
            right[i] = hR + right[i] * dry.current;
            dry.current += d;
        }
        dry.current = dry.target;
    }

    dsp::PitchShifter shiftL, shiftR;
    dsp::Smoothed pitch;
    Ramp dry;
};

/** SSB — the other one. A Hartley frequency shifter, negative shifts included. */
struct Ssb : Block
{
    void prepare (float sr, float cr) override
    {
        rate = sr;
        frequency.prepare (cr, 30.0f, 0.0f);
        phase = 0.0f;
    }

    void reset() override { hL.reset(); hR.reset(); phase = 0.0f; }
    void setParams (const float* v) override { frequency.set (v[0]); }

    void process (float* left, float* right, int n) override
    {
        const auto inc = 2.0f * dsp::pi * frequency.next() / rate;
        for (int i = 0; i < n; ++i)
        {
            const auto c = std::cos (phase), s = std::sin (phase);
            phase += inc;
            if (phase > 2.0f * dsp::pi) phase -= 2.0f * dsp::pi;
            if (phase < 0.0f) phase += 2.0f * dsp::pi;

            float iL, qL, iR, qR;
            hL.process (left[i], iL, qL);
            hR.process (right[i], iR, qR);
            left[i] = iL * c - qL * s;
            right[i] = iR * c - qR * s;
        }
    }

    float rate = 48000.0f, phase = 0.0f;
    dsp::Smoothed frequency;
    dsp::Hilbert hL, hR;
};

/** Create the block for an effect name, or null when we do not play it. */
inline std::unique_ptr<Block> make (const juce::String& effect)
{
    if (effect == "LOWPASS")   return std::make_unique<Lowpass>();
    if (effect == "HIGHPASS")  return std::make_unique<Highpass>();
    if (effect == "EQUALISER") return std::make_unique<Equaliser>();
    if (effect == "BALANCE")   return std::make_unique<Balance>();
    if (effect == "DIST")      return std::make_unique<Dist>();
    if (effect == "RING")      return std::make_unique<Ring>();
    if (effect == "DELAY")     return std::make_unique<Delay>();
    if (effect == "REVERB")    return std::make_unique<Reverb>();
    if (effect == "HARMONY")   return std::make_unique<Harmony>();
    if (effect == "SSB")       return std::make_unique<Ssb>();
    return {};
}

/**
 * Why a block is missing, in words a person can read — the preview's rule,
 * kept. A plugin that quietly ignored a row would teach someone their preset
 * does nothing.
 */
inline juce::String whyNotPlayed (const juce::String& effect)
{
    if (effect == "SAMPLE")
        return "the four sounds live in the mic itself, so there is nothing here to play";
    return "the mic has no block by that name";
}
} // namespace blocks
