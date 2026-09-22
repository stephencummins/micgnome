#include "Chain.h"

#include "Mapping.h"

namespace chain
{
namespace
{
int paramIndex (const spec::Effect& e, const juce::String& name)
{
    for (int i = 0; i < e.numParams; ++i)
        if (name == juce::String (e.params[i].name))
            return i;
    return -1;
}

/**
 * The LFO's speed is a number in the config with no published unit. Treating
 * it as hertz up to twenty is a reading: slow enough to sweep a filter over a
 * phrase, fast enough to sound like modulation rather than an effect.
 */
constexpr float lfoMaxHz = 20.0f;
} // namespace

void Chain::build (const pack::Preset& preset)
{
    source = preset;
    rows.clear();
    skips.clear();
    remarks.clear();
    handleTarget = shakeTarget = lfoTarget = {};

    juce::StringArray seenOnce;

    for (size_t i = 0; i < preset.list.size(); ++i)
    {
        const auto& row = preset.list[i];
        const auto index = static_cast<int> (i);
        const auto* e = spec::effectByName (row.effect.toRawUTF8());
        auto block = e != nullptr ? blocks::make (row.effect) : nullptr;

        if (block == nullptr)
        {
            skips.push_back ({ index, row.effect, blocks::whyNotPlayed (row.effect) });
            continue;
        }

        if (e->oncePerChain)
        {
            if (seenOnce.contains (row.effect))
                remarks.add (row.effect + " appears more than once; the mic allows it only once per chain");
            seenOnce.add (row.effect);
        }

        RowState state;
        state.effect = e;
        state.block = std::move (block);
        state.sourceIndex = index;
        state.numParams = juce::jmin (e->numParams, maxParams);
        for (int p = 0; p < state.numParams; ++p)
            state.base[static_cast<size_t> (p)] = e->params[p].start;

        for (const auto& [key, value] : row.params)
        {
            const auto p = paramIndex (*e, key);
            if (p < 0 || p >= maxParams)
                remarks.add ("row " + juce::String (index) + ": " + row.effect + " has no parameter \"" + key + "\"");
            else
                state.base[static_cast<size_t> (p)] = value;
        }

        if (row.bus > 1)
            remarks.add ("row " + juce::String (index) + " sets BUS " + juce::String (row.bus)
                         + "; this plugin plays one bus, so it runs in series");

        rows.push_back (std::move (state));
    }

    const auto resolveMover = [this] (const pack::Modulation& m, const char* what, Target& into, bool& movesLfo, float& lfoDepth)
    {
        movesLfo = false;
        lfoDepth = 0.0f;
        if (! m.isSet())
            return;

        if (m.targetsLfo)
        {
            movesLfo = true;
            lfoDepth = m.depth;
            if (m.param != "speed")
                remarks.add (juce::String (what) + " moves the LFO's \"" + m.param
                             + "\"; only speed is moved here");
            return;
        }

        into = resolve (m);
        if (! into.valid())
            remarks.add (juce::String (what) + " points at row " + juce::String (m.row) + " \"" + m.param
                         + "\", which does not play here, so it does nothing");
    };

    bool unusedLfoFlag = false;
    float unusedLfoDepth = 0.0f;
    resolveMover (preset.handle, "the handle", handleTarget, handleMovesLfo, handleLfoDepth);
    resolveMover (preset.shake, "the shake", shakeTarget, shakeMovesLfo, shakeLfoDepth);
    resolveMover (preset.lfo, "the LFO", lfoTarget, unusedLfoFlag, unusedLfoDepth);

    lfoPhase = juce::jlimit (0.0f, 1.0f, preset.lfo.phase);
    lfoRandom = 0.0f;
}

Chain::Target Chain::resolve (const pack::Modulation& m) const
{
    Target t;
    for (size_t i = 0; i < rows.size(); ++i)
    {
        if (rows[i].sourceIndex != m.row)
            continue;

        const auto p = paramIndex (*rows[i].effect, m.param);
        if (p < 0 || p >= maxParams)
            break;

        t.rowState = static_cast<int> (i);
        t.paramIndex = p;
        t.depth = m.depth;
        t.min = rows[i].effect->params[p].min;
        t.max = rows[i].effect->params[p].max;
        break;
    }
    return t;
}

void Chain::prepare (float sampleRate)
{
    rate = sampleRate;
    const auto controlRate = sampleRate / static_cast<float> (blocks::controlBlock);
    for (auto& r : rows)
    {
        r.block->prepare (sampleRate, controlRate);
        r.block->reset();
        r.live = r.base;
        r.block->setParams (r.live.data());
    }
}

void Chain::reset()
{
    for (auto& r : rows)
        r.block->reset();
    lfoPhase = juce::jlimit (0.0f, 1.0f, source.lfo.phase);
}

float Chain::lfoValue()
{
    const auto shape = source.lfo.shape;
    if (shape == "square")   return lfoPhase < 0.5f ? 1.0f : -1.0f;
    if (shape == "sawtooth") return lfoPhase * 2.0f - 1.0f;
    if (shape == "random")   return lfoRandom;
    return std::sin (2.0f * dsp::pi * lfoPhase);
}

void Chain::applyModulation (float handle, float shake, float lfo)
{
    for (auto& r : rows)
        r.live = r.base;

    // Movers compose rather than override: two pointed at the same parameter
    // add up, and letting one go leaves the other where it was.
    const auto apply = [this] (const Target& t, float amount)
    {
        if (! t.valid())
            return;
        auto& r = rows[static_cast<size_t> (t.rowState)];
        auto& v = r.live[static_cast<size_t> (t.paramIndex)];
        v = mapping::modulate (v, t.depth, amount, t.min, t.max);
    };

    apply (handleTarget, handle);
    apply (shakeTarget, shake);
    apply (lfoTarget, lfo);

    for (auto& r : rows)
        r.block->setParams (r.live.data());
}

void Chain::process (float* left, float* right, int numSamples, float handle, float shake)
{
    if (rows.empty())
        return;

    for (int offset = 0; offset < numSamples; offset += blocks::controlBlock)
    {
        const auto n = juce::jmin (blocks::controlBlock, numSamples - offset);

        // The LFO's own speed can be moved, which is what `target: "lfo"` means.
        auto speed = juce::jlimit (0.0f, 1.0f, source.lfo.speed * source.lfo.mpy);
        if (handleMovesLfo) speed = mapping::modulate (speed, handleLfoDepth, handle, 0.0f, 1.0f);
        if (shakeMovesLfo) speed = mapping::modulate (speed, shakeLfoDepth, shake, 0.0f, 1.0f);
        lfoHz = speed * lfoMaxHz;

        const auto previous = lfoPhase;
        lfoPhase += lfoHz * static_cast<float> (n) / rate;
        while (lfoPhase >= 1.0f)
            lfoPhase -= 1.0f;
        if (lfoPhase < previous)   // wrapped: the random shape picks a new value
            lfoRandom = random.nextFloat() * 2.0f - 1.0f;

        applyModulation (handle, shake, lfoValue());

        for (auto& r : rows)
            r.block->process (left + offset, right + offset, n);
    }
}
} // namespace chain
