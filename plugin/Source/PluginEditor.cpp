#include "PluginEditor.h"

#include "Spec.generated.h"

namespace skin
{
juce::Colour family (const juce::String& effect)
{
    if (effect == "LOWPASS" || effect == "HIGHPASS" || effect == "EQUALIZER") return filter;
    if (effect == "DELAY" || effect == "REVERB" || effect == "BALANCE") return space;
    if (effect == "HARMONY" || effect == "SSB") return pitch;
    if (effect == "DIST" || effect == "RING") return drive;
    return rule;
}

juce::Font mono (float height, bool bold)
{
    return juce::Font (juce::FontOptions (juce::Font::getDefaultMonospacedFontName(), height,
                                          bold ? juce::Font::bold : juce::Font::plain));
}

juce::Font sans (float height, bool bold)
{
    return juce::Font (juce::FontOptions (height, bold ? juce::Font::bold : juce::Font::plain));
}
} // namespace skin

namespace
{
constexpr int rowHeight = 50;
constexpr int noteHeight = 22;

/** A number written the way a config writes it: short, and never 0.3800000001. */
juce::String number (float v)
{
    auto s = juce::String (v, 4).trimCharactersAtEnd ("0");
    if (s.endsWithChar ('.')) s = s.dropLastCharacters (1);
    return s;
}

/** Which mover, if any, points at this row's parameter. */
juce::String moverFor (const pack::Preset& p, int row, const juce::String& param)
{
    juce::StringArray found;
    if (p.handle.isSet() && ! p.handle.targetsLfo && p.handle.row == row && p.handle.param == param) found.add ("handle");
    if (p.shake.isSet() && ! p.shake.targetsLfo && p.shake.row == row && p.shake.param == param) found.add ("shake");
    if (p.lfo.isSet() && ! p.lfo.targetsLfo && p.lfo.row == row && p.lfo.param == param) found.add ("lfo");
    return found.joinIntoString ("+");
}
} // namespace

//==============================================================================
int ChainView::slot() const
{
    return static_cast<int> (plugin.apvts.getRawParameterValue ("preset")->load()) - 1;
}

void ChainView::refresh()
{
    const auto* chain = plugin.getChain (slot());
    int height = 10;

    if (chain != nullptr)
    {
        height += static_cast<int> (chain->preset().list.size()) * rowHeight;
        height += (static_cast<int> (chain->skipped().size()) + chain->notes().size()) * noteHeight;
        if (! chain->skipped().empty() || chain->notes().size() > 0)
            height += 12;
    }

    setSize (getParentWidth() > 0 ? getParentWidth() : getWidth(), juce::jmax (height, 10));
    repaint();
}

void ChainView::paint (juce::Graphics& g)
{
    g.fillAll (skin::paper);

    const auto s = slot();
    if (s < 0)
    {
        g.setColour (skin::mute);
        g.setFont (skin::sans (14.0f));
        g.drawText ("your voice, dry — the orange button's first position",
                    getLocalBounds().withTrimmedTop (10).withHeight (24), juce::Justification::centred);
        return;
    }

    const auto* chain = plugin.getChain (s);
    if (chain == nullptr)
    {
        g.setColour (skin::mute);
        g.setFont (skin::sans (14.0f));
        g.drawText ("this pack does not fill slot " + juce::String (s + 1),
                    getLocalBounds().withTrimmedTop (10).withHeight (24), juce::Justification::centred);
        return;
    }

    const auto& preset = chain->preset();
    auto area = getLocalBounds().reduced (12, 0).withTrimmedTop (6);

    for (size_t i = 0; i < preset.list.size(); ++i)
    {
        const auto& row = preset.list[i];
        const auto index = static_cast<int> (i);
        auto band = area.removeFromTop (rowHeight);

        const auto skipped = std::any_of (chain->skipped().begin(), chain->skipped().end(),
                                          [index] (const chain::Skip& k) { return k.row == index; });
        const auto colour = skipped ? skin::rule : skin::family (row.effect);

        // The left edge carries the block's family, the way the printed manual
        // draws it.
        g.setColour (colour);
        g.fillRect (band.getX(), band.getY() + 4, 2, rowHeight - 12);

        auto text = band.withTrimmedLeft (12);
        g.setColour (skipped ? skin::mute : colour);
        g.setFont (skin::mono (14.0f, true));
        g.drawText (row.effect.toLowerCase(), text.removeFromTop (20), juce::Justification::centredLeft);

        // Parameters in the order the effect declares them, not the order the
        // JSON happens to list them, so two packs read the same way.
        juce::String line;
        juce::String moved;
        if (const auto* e = spec::effectByName (row.effect.toRawUTF8()))
        {
            for (int p = 0; p < e->numParams; ++p)
            {
                const juce::String name (e->params[p].name);
                auto value = e->params[p].start;
                for (const auto& [key, v] : row.params)
                    if (key == name)
                        value = v;

                line << name << " " << number (value) << "   ";
                const auto mover = moverFor (preset, index, name);
                if (mover.isNotEmpty())
                    moved << (moved.isEmpty() ? "" : ", ") << mover << " moves " << name;
            }
        }

        g.setColour (skin::mute);
        g.setFont (skin::mono (11.5f));
        g.drawText (line.trimEnd(), text.removeFromTop (16), juce::Justification::centredLeft);

        if (moved.isNotEmpty())
        {
            g.setColour (skin::orange);
            g.setFont (skin::sans (11.5f));
            g.drawText (moved, text.removeFromTop (14), juce::Justification::centredLeft);
        }

        g.setColour (skin::rule);
        g.fillRect (band.getX(), band.getBottom() - 1, band.getWidth(), 1);
    }

    if (chain->skipped().empty() && chain->notes().size() == 0)
        return;

    area.removeFromTop (10);
    g.setFont (skin::sans (12.0f));

    for (const auto& skip : chain->skipped())
    {
        g.setColour (skin::mute);
        g.drawText ("row " + juce::String (skip.row) + " " + skip.effect.toLowerCase()
                        + " does not play — " + skip.why,
                    area.removeFromTop (noteHeight), juce::Justification::centredLeft);
    }

    for (const auto& note : chain->notes())
    {
        g.setColour (skin::mute);
        g.drawText (note, area.removeFromTop (noteHeight), juce::Justification::centredLeft);
    }
}

//==============================================================================
MicGnomeEditor::MicGnomeEditor (MicGnomeProcessor& p)
    : AudioProcessorEditor (&p), plugin (p)
{
    setLookAndFeel (nullptr);

    const char* names[] = { "dry", "1", "2", "3", "4" };
    for (int i = 0; i < 5; ++i)
    {
        auto* b = slotButtons.add (new juce::TextButton (names[i]));
        b->setClickingTogglesState (false);
        b->setColour (juce::TextButton::buttonColourId, skin::panel);
        b->setColour (juce::TextButton::textColourOffId, skin::mute);
        b->setConnectedEdges ((i > 0 ? juce::Button::ConnectedOnLeft : 0)
                              | (i < 4 ? juce::Button::ConnectedOnRight : 0));
        b->onClick = [this, i] { slotAttachment->setValueAsCompleteGesture (static_cast<float> (i)); };
        addAndMakeVisible (b);
    }

    slotAttachment = std::make_unique<juce::ParameterAttachment> (
        *plugin.apvts.getParameter ("preset"), [this] (float) { shownSlot = -2; }, nullptr);
    slotAttachment->sendInitialUpdate();

    const auto setupSlider = [this] (juce::Slider& s, juce::Label& label, const juce::String& text,
                                     const juce::String& id, juce::Slider::SliderStyle style,
                                     juce::Colour colour)
    {
        s.setSliderStyle (style);
        s.setTextBoxStyle (style == juce::Slider::LinearHorizontal ? juce::Slider::TextBoxRight
                                                                    : juce::Slider::TextBoxBelow,
                           false, 56, 16);
        s.setColour (juce::Slider::thumbColourId, colour);
        s.setColour (juce::Slider::trackColourId, colour);
        s.setColour (juce::Slider::rotarySliderFillColourId, colour);
        s.setColour (juce::Slider::rotarySliderOutlineColourId, skin::rule);
        s.setColour (juce::Slider::backgroundColourId, skin::rule);
        s.setColour (juce::Slider::textBoxTextColourId, skin::mute);
        s.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        addAndMakeVisible (s);

        label.setText (text, juce::dontSendNotification);
        label.setFont (skin::sans (11.5f));
        label.setColour (juce::Label::textColourId, skin::mute);
        label.setJustificationType (juce::Justification::centred);
        addAndMakeVisible (label);

        sliderAttachments.add (new juce::AudioProcessorValueTreeState::SliderAttachment (
            plugin.apvts, id, s));

        // The attachment installs the parameter's own text conversion, so the
        // number of decimals is set on the parameter, not here — all that is
        // left for the slider is the unit.
        if (id == "input" || id == "output")
            s.setTextValueSuffix (" dB");
    };

    // Orange is reserved for the things that move, which is exactly these two.
    setupSlider (handle, handleLabel, "handle", "handle", juce::Slider::LinearHorizontal, skin::orange);
    setupSlider (shake, shakeLabel, "shake", "shake", juce::Slider::LinearHorizontal, skin::orange);
    setupSlider (input, inputLabel, "input", "input", juce::Slider::RotaryVerticalDrag, skin::ink);
    setupSlider (mix, mixLabel, "mix", "mix", juce::Slider::RotaryVerticalDrag, skin::ink);
    setupSlider (output, outputLabel, "output", "output", juce::Slider::RotaryVerticalDrag, skin::ink);

    load.setColour (juce::TextButton::buttonColourId, skin::panel);
    load.setColour (juce::TextButton::textColourOffId, skin::ink);
    load.onClick = [this] { choosePack(); };
    addAndMakeVisible (load);

    viewport.setViewedComponent (&chainView, false);
    viewport.setScrollBarsShown (true, false);
    viewport.setColour (juce::ScrollBar::thumbColourId, skin::rule);
    addAndMakeVisible (viewport);

    plugin.addChangeListener (this);
    startTimerHz (20);

    setResizable (true, true);
    setResizeLimits (480, 460, 900, 1000);
    setSize (540, 620);
}

MicGnomeEditor::~MicGnomeEditor()
{
    plugin.removeChangeListener (this);
}

void MicGnomeEditor::choosePack()
{
    chooser = std::make_unique<juce::FileChooser> ("load a pack's config.json", juce::File(), "*.json");
    chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
                          [this] (const juce::FileChooser& fc)
                          {
                              const auto file = fc.getResult();
                              if (file.existsAsFile())
                                  plugin.loadPack (file.loadFileAsString());
                          });
}

void MicGnomeEditor::changeListenerCallback (juce::ChangeBroadcaster*)
{
    shownSlot = -2;
    repaint();
}

void MicGnomeEditor::timerCallback()
{
    const auto s = static_cast<int> (plugin.apvts.getRawParameterValue ("preset")->load());
    if (s == shownSlot)
        return;

    shownSlot = s;
    for (int i = 0; i < slotButtons.size(); ++i)
    {
        const auto on = i == s;
        slotButtons[i]->setColour (juce::TextButton::buttonColourId, on ? skin::orange : skin::panel);
        slotButtons[i]->setColour (juce::TextButton::textColourOffId, on ? skin::paper : skin::mute);
        slotButtons[i]->repaint();
    }

    chainView.refresh();
    repaint();
}

void MicGnomeEditor::paint (juce::Graphics& g)
{
    g.fillAll (skin::paper);

    auto area = getLocalBounds().reduced (12);
    auto header = area.removeFromTop (46);

    g.setColour (skin::ink);
    g.setFont (skin::sans (19.0f, true));
    g.drawText ("mic gnome", header.removeFromTop (24).withTrimmedRight (110), juce::Justification::topLeft);

    const auto& p = plugin.getPack();
    const auto error = plugin.getPackError();
    g.setColour (error.isNotEmpty() ? skin::drive : skin::mute);
    g.setFont (skin::mono (11.5f));
    g.drawText (error.isNotEmpty() ? "that pack did not load — " + error
                                   : (p.name.isNotEmpty() ? p.name : juce::String ("untitled pack")),
                header.withTrimmedRight (110), juce::Justification::topLeft);

    // The preset's own name and comment, under the orange button's row.
    auto title = area.withTrimmedTop (34).withHeight (36);
    const auto slot = static_cast<int> (plugin.apvts.getRawParameterValue ("preset")->load()) - 1;
    if (const auto* chain = plugin.getChain (slot))
    {
        g.setColour (skin::ink);
        g.setFont (skin::sans (14.0f, true));
        g.drawText (chain->preset().name.isNotEmpty() ? chain->preset().name : "slot " + juce::String (slot + 1),
                    title.removeFromTop (18), juce::Justification::centredLeft);
        g.setColour (skin::mute);
        g.setFont (skin::sans (12.0f));
        g.drawText (chain->preset().comment, title, juce::Justification::centredLeft);
    }

    g.setColour (skin::rule);
    g.fillRect (area.getX(), viewport.getY() - 6, area.getWidth(), 1);
    g.fillRect (area.getX(), viewport.getBottom() + 6, area.getWidth(), 1);
}

void MicGnomeEditor::resized()
{
    auto area = getLocalBounds().reduced (12);

    auto header = area.removeFromTop (46);
    load.setBounds (header.removeFromRight (100).withHeight (26));

    auto buttons = area.removeFromTop (30);
    const auto width = buttons.getWidth() / 5;
    for (int i = 0; i < slotButtons.size(); ++i)
        slotButtons[i]->setBounds (i < 4 ? buttons.removeFromLeft (width) : buttons);

    area.removeFromTop (40);   // the preset's name and comment, painted

    auto movers = area.removeFromBottom (122);
    auto knobs = movers.removeFromBottom (72);
    const auto knobWidth = knobs.getWidth() / 3;
    const auto place = [] (juce::Slider& s, juce::Label& l, juce::Rectangle<int> r)
    {
        l.setBounds (r.removeFromTop (14));
        s.setBounds (r);
    };
    place (input, inputLabel, knobs.removeFromLeft (knobWidth));
    place (mix, mixLabel, knobs.removeFromLeft (knobWidth));
    place (output, outputLabel, knobs);

    auto handleRow = movers.removeFromTop (22);
    handleLabel.setBounds (handleRow.removeFromLeft (54));
    handle.setBounds (handleRow);
    auto shakeRow = movers.removeFromTop (22);
    shakeLabel.setBounds (shakeRow.removeFromLeft (54));
    shake.setBounds (shakeRow);

    viewport.setBounds (area.reduced (0, 8));
    chainView.setSize (viewport.getWidth(), chainView.getHeight());
    chainView.refresh();
}
