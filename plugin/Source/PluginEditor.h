/**
 * The panel.
 *
 * Same discipline as the site: the guide's own look — hairline rules, one
 * orange, everything lowercase, technical data in mono — and orange reserved
 * for the things that move. The five positions of the orange button, the two
 * movers, and the chain written out so you can read what is actually playing,
 * including the rows that are not.
 */
#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "PluginProcessor.h"

namespace skin
{
// The dark half of the site's palette: a plugin lives inside a DAW.
const juce::Colour paper { 0xff0e0d0c };
const juce::Colour panel { 0xff181614 };
const juce::Colour ink { 0xfff3f1ee };
const juce::Colour mute { 0xff98928a };
const juce::Colour rule { 0xff2e2b27 };
const juce::Colour orange { 0xffff5f1f };
const juce::Colour filter { 0xff6aa7ff };
const juce::Colour space { 0xff3fc4b0 };
const juce::Colour pitch { 0xffb394ff };
const juce::Colour drive { 0xffff5fae };

/** A block's family colour, or the rule colour for SAMPLE and unknowns. */
juce::Colour family (const juce::String& effect);

juce::Font mono (float height, bool bold = false);
juce::Font sans (float height, bool bold = false);
} // namespace skin

/** The chain, written out. Painted rather than built from child components. */
class ChainView : public juce::Component
{
public:
    explicit ChainView (MicGnomeProcessor& p) : plugin (p) {}

    void paint (juce::Graphics&) override;
    /** Lays itself out to fit the current preset, for the viewport to scroll. */
    void refresh();

private:
    MicGnomeProcessor& plugin;
    int slot() const;
};

class MicGnomeEditor : public juce::AudioProcessorEditor,
                       private juce::ChangeListener,
                       private juce::Timer
{
public:
    explicit MicGnomeEditor (MicGnomeProcessor&);
    ~MicGnomeEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void changeListenerCallback (juce::ChangeBroadcaster*) override;
    void timerCallback() override;
    void choosePack();

    MicGnomeProcessor& plugin;

    juce::OwnedArray<juce::TextButton> slotButtons;
    std::unique_ptr<juce::ParameterAttachment> slotAttachment;
    int shownSlot = -2;

    juce::Slider handle, shake, input, output, mix;
    juce::Label handleLabel, shakeLabel, inputLabel, outputLabel, mixLabel;
    juce::OwnedArray<juce::AudioProcessorValueTreeState::SliderAttachment> sliderAttachments;

    juce::TextButton load { "load pack" };
    std::unique_ptr<juce::FileChooser> chooser;

    juce::Viewport viewport;
    ChainView chainView { plugin };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MicGnomeEditor)
};
