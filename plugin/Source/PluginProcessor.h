/**
 * Mic Gnome — the EP-2350's effect chain, as a plugin.
 *
 * The mic's whole instrument is a config.json on a USB disk. This loads the
 * same file: the five positions of the orange button become a five-way
 * selector, the handle and the shake become two sliders, and the chain plays.
 * A pack auditioned here is the pack that goes on the mic.
 */
#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "Chain.h"
#include "Pack.h"

class MicGnomeProcessor : public juce::AudioProcessor,
                          public juce::ChangeBroadcaster
{
public:
    MicGnomeProcessor();
    ~MicGnomeProcessor() override = default;

    void prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Mic Gnome"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 5.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    //==========================================================================
    /** Message thread. Replaces the loaded pack and rebuilds all four chains. */
    void loadPack (const juce::String& json);

    const pack::Pack& getPack() const { return currentPack; }
    /** Empty when the last load was clean. */
    const juce::String& getPackError() const { return packError; }
    const juce::String& getPackJson() const { return packJson; }

    /** Message thread only. Null for a slot the pack does not fill. */
    const chain::Chain* getChain (int slot) const;

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout layout();
    void rebuild();

    pack::Pack currentPack;
    juce::String packJson, packError;

    /** Guarded by chainLock, which the audio thread only ever tries to take. */
    juce::SpinLock chainLock;
    std::array<std::unique_ptr<chain::Chain>, 4> chains;

    juce::AudioBuffer<float> dry;
    float rate = 48000.0f;

    std::atomic<float>* presetParam = nullptr;
    std::atomic<float>* handleParam = nullptr;
    std::atomic<float>* shakeParam = nullptr;
    std::atomic<float>* inputParam = nullptr;
    std::atomic<float>* outputParam = nullptr;
    std::atomic<float>* mixParam = nullptr;

    juce::SmoothedValue<float> inputGain, outputGain, wetMix;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MicGnomeProcessor)
};
