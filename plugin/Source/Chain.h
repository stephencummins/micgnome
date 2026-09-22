/**
 * One preset's chain of blocks, and the movers over it.
 *
 * Audio falls down the chain — the mic's own rule — so a row only ever sees
 * what the rows above it did. Everything that allocates happens in build() and
 * prepare(); process() runs on the audio thread and does neither.
 */
#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <memory>
#include <vector>

#include "Blocks.h"
#include "Pack.h"
#include "Spec.generated.h"

namespace chain
{
/** DELAY has the most parameters at eight; the headroom is for a spec that grows. */
constexpr int maxParams = 16;

/** A row we could not play, and why — stated in the UI rather than swallowed. */
struct Skip
{
    int row;
    juce::String effect;
    juce::String why;
};

class Chain
{
public:
    /** Message thread. Allocates. */
    void build (const pack::Preset&);

    /** Message thread. Allocates. Safe to call again on a sample-rate change. */
    void prepare (float sampleRate);

    void reset();

    /** Audio thread. `handle` and `shake` are 0..1. */
    void process (float* left, float* right, int numSamples, float handle, float shake);

    const std::vector<Skip>& skipped() const { return skips; }
    /** Things worth saying about the preset that are not failures. */
    const juce::StringArray& notes() const { return remarks; }
    const pack::Preset& preset() const { return source; }
    bool isEmpty() const { return rows.empty(); }

private:
    struct RowState
    {
        const spec::Effect* effect = nullptr;
        std::unique_ptr<blocks::Block> block;
        /** Set values in the effect's own parameter order. */
        std::array<float, maxParams> base {};
        std::array<float, maxParams> live {};
        int numParams = 0;
        /** Where this row sits in the preset's list, which is what a mover names. */
        int sourceIndex = 0;
    };

    /** A mover resolved to a row we actually built, so the audio thread does no lookups. */
    struct Target
    {
        int rowState = -1;
        int paramIndex = -1;
        float depth = 0.0f;
        float min = 0.0f, max = 1.0f;
        bool valid() const { return rowState >= 0 && paramIndex >= 0; }
    };

    Target resolve (const pack::Modulation&) const;
    float lfoValue();
    void applyModulation (float handle, float shake, float lfo);

    pack::Preset source;
    std::vector<RowState> rows;
    std::vector<Skip> skips;
    juce::StringArray remarks;

    Target handleTarget, shakeTarget, lfoTarget;
    /** A handle or shake pointed at the LFO itself rather than at a row. */
    bool handleMovesLfo = false, shakeMovesLfo = false;
    float handleLfoDepth = 0.0f, shakeLfoDepth = 0.0f;

    float rate = 48000.0f;
    float lfoPhase = 0.0f;
    float lfoRandom = 0.0f;
    float lfoHz = 0.0f;
    juce::Random random;
};
} // namespace chain
