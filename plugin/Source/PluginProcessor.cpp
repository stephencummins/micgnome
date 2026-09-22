#include "PluginProcessor.h"

#include "PluginEditor.h"

namespace
{
constexpr const char* packStateTag = "pack";
constexpr const char* packStateJson = "json";
} // namespace

juce::AudioProcessorValueTreeState::ParameterLayout MicGnomeProcessor::layout()
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout l;

    // The orange button has five positions, not four: the first is your voice,
    // dry. People count the lights and assume a preset is missing.
    l.add (std::make_unique<AudioParameterChoice> (
        ParameterID { "preset", 1 }, "Preset",
        StringArray { "Dry", "Slot 1", "Slot 2", "Slot 3", "Slot 4" }, 1));

    // Two decimals, not seven: a mover reading "0.0000000" in the DAW's
    // automation lane is a number nobody can use.
    const auto twoPlaces = AudioParameterFloatAttributes().withStringFromValueFunction (
        [] (float v, int) { return String (v, 2); });

    l.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "handle", 1 }, "Handle", NormalisableRange<float> { 0.0f, 1.0f }, 0.0f, twoPlaces));
    l.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "shake", 1 }, "Shake", NormalisableRange<float> { 0.0f, 1.0f }, 0.0f, twoPlaces));

    l.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "input", 1 }, "Input", NormalisableRange<float> { -24.0f, 24.0f, 0.1f }, 0.0f,
        AudioParameterFloatAttributes().withLabel ("dB")));
    l.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "output", 1 }, "Output", NormalisableRange<float> { -24.0f, 24.0f, 0.1f }, 0.0f,
        AudioParameterFloatAttributes().withLabel ("dB")));
    l.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "mix", 1 }, "Mix", NormalisableRange<float> { 0.0f, 1.0f }, 1.0f, twoPlaces));

    return l;
}

MicGnomeProcessor::MicGnomeProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "state", layout())
{
    presetParam = apvts.getRawParameterValue ("preset");
    handleParam = apvts.getRawParameterValue ("handle");
    shakeParam = apvts.getRawParameterValue ("shake");
    inputParam = apvts.getRawParameterValue ("input");
    outputParam = apvts.getRawParameterValue ("output");
    mixParam = apvts.getRawParameterValue ("mix");

    loadPack (pack::toJson (pack::starter()));
}

bool MicGnomeProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::stereo() && out != juce::AudioChannelSet::mono())
        return false;

    // A mic is one channel; a chain with BALANCE or a cross-fed DELAY in it is
    // two. Mono in, stereo out is the layout this plugin is actually for.
    const auto& in = layouts.getMainInputChannelSet();
    return in == juce::AudioChannelSet::mono() || in == out;
}

void MicGnomeProcessor::loadPack (const juce::String& json)
{
    juce::String error;
    auto parsed = pack::parse (json, error);

    if (error.isNotEmpty())
    {
        packError = error;
        sendChangeMessage();
        return;
    }

    packError.clear();
    packJson = json;
    currentPack = std::move (parsed);
    rebuild();
    sendChangeMessage();
}

void MicGnomeProcessor::rebuild()
{
    // Built and prepared outside the lock so nothing allocates while the audio
    // thread might be waiting on it.
    std::array<std::unique_ptr<chain::Chain>, 4> built;
    for (int slot = 0; slot < 4; ++slot)
    {
        if (const auto* p = currentPack.atPos (slot))
        {
            built[static_cast<size_t> (slot)] = std::make_unique<chain::Chain>();
            built[static_cast<size_t> (slot)]->build (*p);
            built[static_cast<size_t> (slot)]->prepare (rate);
        }
    }

    const juce::SpinLock::ScopedLockType sl (chainLock);
    chains = std::move (built);
}

const chain::Chain* MicGnomeProcessor::getChain (int slot) const
{
    if (slot < 0 || slot >= 4)
        return nullptr;
    return chains[static_cast<size_t> (slot)].get();
}

void MicGnomeProcessor::prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock)
{
    rate = static_cast<float> (sampleRate);
    dry.setSize (2, maximumExpectedSamplesPerBlock, false, false, true);

    for (auto* s : { &inputGain, &outputGain, &wetMix })
        s->reset (sampleRate, 0.02);
    inputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (inputParam->load()));
    outputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (outputParam->load()));
    wetMix.setCurrentAndTargetValue (mixParam->load());

    rebuild();
}

void MicGnomeProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const auto numSamples = buffer.getNumSamples();
    const auto numIn = getMainBusNumInputChannels();
    const auto numOut = getMainBusNumOutputChannels();

    for (int ch = numIn; ch < numOut; ++ch)
        buffer.copyFrom (ch, 0, buffer, 0, 0, numSamples);   // a mono mic feeding a stereo chain

    inputGain.setTargetValue (juce::Decibels::decibelsToGain (inputParam->load()));
    outputGain.setTargetValue (juce::Decibels::decibelsToGain (outputParam->load()));
    wetMix.setTargetValue (mixParam->load());

    // The ramp's ends are taken once, not per channel: skip() advances the
    // smoother, so calling it inside the loop would leave the right channel a
    // block ahead of the left.
    const auto inFrom = inputGain.getCurrentValue();
    const auto inTo = inputGain.skip (numSamples);
    for (int ch = 0; ch < numOut; ++ch)
        buffer.applyGainRamp (ch, 0, numSamples, inFrom, inTo);

    const auto slot = static_cast<int> (presetParam->load()) - 1;   // 0 is the dry position

    if (slot >= 0)
    {
        const auto stereo = juce::jmin (2, numOut);

        // A host may hand over a longer block than it promised in
        // prepareToPlay. Growing the buffer here would allocate on the audio
        // thread, so instead the mix is skipped for that block — all wet, which
        // is what a chain is for — rather than writing past the end of it.
        const auto canMix = dry.getNumSamples() >= numSamples;
        if (canMix)
            for (int ch = 0; ch < stereo; ++ch)
                dry.copyFrom (ch, 0, buffer, ch, 0, numSamples);

        // A try-lock, never a lock: if the message thread is mid-swap the block
        // passes through untouched rather than the audio thread waiting on it.
        const juce::SpinLock::ScopedTryLockType sl (chainLock);
        if (sl.isLocked())
        {
            if (auto* c = chains[static_cast<size_t> (slot)].get())
            {
                auto* left = buffer.getWritePointer (0);
                auto* right = numOut > 1 ? buffer.getWritePointer (1) : left;
                c->process (left, right, numSamples, handleParam->load(), shakeParam->load());

                if (canMix)
                {
                    for (int i = 0; i < numSamples; ++i)
                    {
                        const auto wet = wetMix.getNextValue();
                        for (int ch = 0; ch < stereo; ++ch)
                        {
                            auto* d = buffer.getWritePointer (ch);
                            d[i] = d[i] * wet + dry.getSample (ch, i) * (1.0f - wet);
                        }
                    }
                }
                else
                {
                    wetMix.skip (numSamples);
                }
            }
        }
    }

    const auto outFrom = outputGain.getCurrentValue();
    const auto outTo = outputGain.skip (numSamples);
    for (int ch = 0; ch < numOut; ++ch)
        buffer.applyGainRamp (ch, 0, numSamples, outFrom, outTo);
}

void MicGnomeProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    // The pack travels in the session, so reopening a project does not need the
    // original config.json to still be on the disk where it was.
    state.removeChild (state.getChildWithName (packStateTag), nullptr);
    juce::ValueTree packNode (packStateTag);
    packNode.setProperty (packStateJson, packJson, nullptr);
    state.appendChild (packNode, nullptr);

    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void MicGnomeProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml == nullptr)
        return;

    auto state = juce::ValueTree::fromXml (*xml);
    if (! state.isValid())
        return;

    auto packNode = state.getChildWithName (packStateTag);
    const auto json = packNode.isValid() ? packNode.getProperty (packStateJson).toString() : juce::String();

    state.removeChild (packNode, nullptr);
    apvts.replaceState (state);

    loadPack (json.isNotEmpty() ? json : pack::toJson (pack::starter()));
}

juce::AudioProcessorEditor* MicGnomeProcessor::createEditor()
{
    return new MicGnomeEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MicGnomeProcessor();
}
