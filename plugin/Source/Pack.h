/**
 * A pack — the mic's config.json — as C++ structs.
 *
 * The same file the site validates and the same file that goes on the mic's
 * USB disk. The plugin reads it rather than inventing a format of its own,
 * which is the whole point: audition the pack here, copy the same file across,
 * hear the same preset.
 *
 * Parsing is deliberately forgiving in the same places the validator warns
 * rather than refuses — an unknown key is carried, not rejected — because a
 * pack that the mic plays must not be a pack the plugin turns away.
 */
#pragma once

#include <juce_core/juce_core.h>
#include <vector>

namespace pack
{
/** A mover: one parameter on one row, by some depth. */
struct Modulation
{
    int row = -1;
    juce::String param;
    float depth = 0.0f;
    /** "lfo" in the config: this mover moves the LFO instead of a row. */
    bool targetsLfo = false;

    bool isSet() const { return param.isNotEmpty() && (targetsLfo || row >= 0); }
};

struct Lfo : Modulation
{
    juce::String shape { "sine" };
    float speed = 1.0f;
    /** Not in the guide; present in a config that runs, so it is carried. */
    float mpy = 1.0f;
    float phase = 0.0f;
};

struct Row
{
    juce::String effect;
    /** Set values, by the parameter's own name. Anything absent uses the spec's start. */
    std::vector<std::pair<juce::String, float>> params;
    /** 1 or 2 in the guide, 0 when the row does not say. */
    int bus = 0;
};

struct Preset
{
    int pos = 0;
    juce::String name, comment;
    std::vector<Row> list;
    Modulation handle, shake;
    Lfo lfo;
    int triggerRow = -1;
};

struct Pack
{
    juce::String name, comment;
    std::vector<Preset> presets;

    /** The preset in orange-button slot `pos`, or null. */
    const Preset* atPos (int pos) const
    {
        for (auto& p : presets)
            if (p.pos == pos)
                return &p;
        return nullptr;
    }
};

/** Parse config.json. On failure returns an empty pack and sets `error`. */
Pack parse (const juce::String& json, juce::String& error);

juce::String toJson (const Pack&);

/**
 * What loads when nothing else has been. Not a factory patch of the mic's —
 * nobody has one to copy — just a chain that shows the plugin working.
 */
Pack starter();
} // namespace pack
