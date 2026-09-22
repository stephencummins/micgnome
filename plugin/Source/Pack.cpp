#include "Pack.h"

#include "Spec.generated.h"

namespace pack
{
namespace
{
float number (const juce::var& v, float fallback)
{
    return v.isDouble() || v.isInt() || v.isInt64() ? static_cast<float> (v) : fallback;
}

Modulation readModulation (const juce::var& v)
{
    Modulation m;
    if (auto* o = v.getDynamicObject())
    {
        m.targetsLfo = o->getProperty ("target").toString() == "lfo";
        m.row = o->hasProperty ("row") ? static_cast<int> (number (o->getProperty ("row"), -1.0f)) : -1;
        m.param = o->getProperty ("param").toString();
        m.depth = number (o->getProperty ("depth"), 0.0f);
    }
    return m;
}

Row readRow (const juce::var& v)
{
    Row row;
    auto* o = v.getDynamicObject();
    if (o == nullptr)
        return row;

    row.effect = o->getProperty ("effect").toString().toUpperCase();
    for (auto& prop : o->getProperties())
    {
        const auto key = prop.name.toString();
        if (key == "effect")
            continue;
        if (key == "BUS")
        {
            row.bus = static_cast<int> (number (prop.value, 0.0f));
            continue;
        }
        // Anything else is a parameter. An unknown one is carried and ignored
        // later rather than rejected here, because the mic may well know it.
        row.params.emplace_back (key, number (prop.value, 0.0f));
    }
    return row;
}
} // namespace

Pack parse (const juce::String& json, juce::String& error)
{
    Pack out;
    error.clear();

    juce::var parsed;
    const auto result = juce::JSON::parse (json, parsed);
    if (result.failed())
    {
        error = result.getErrorMessage();
        return out;
    }

    auto* root = parsed.getDynamicObject();
    if (root == nullptr)
    {
        error = "the file is not a JSON object";
        return out;
    }

    out.name = root->getProperty ("name").toString();
    out.comment = root->getProperty ("comment").toString();

    auto* presets = root->getProperty ("presets").getArray();
    if (presets == nullptr)
    {
        error = "no presets";
        return out;
    }

    int fallbackPos = 0;
    for (auto& pv : *presets)
    {
        auto* po = pv.getDynamicObject();
        if (po == nullptr)
            continue;

        Preset p;
        // A preset without a pos takes the next slot, which is how a
        // hand-written pack usually reads.
        p.pos = po->hasProperty ("pos") ? static_cast<int> (number (po->getProperty ("pos"), 0.0f))
                                        : fallbackPos;
        fallbackPos = p.pos + 1;
        p.name = po->getProperty ("name").toString();
        p.comment = po->getProperty ("comment").toString();

        if (auto* list = po->getProperty ("list").getArray())
            for (auto& rv : *list)
                p.list.push_back (readRow (rv));

        p.handle = readModulation (po->getProperty ("handle"));
        p.shake = readModulation (po->getProperty ("shake"));

        if (auto* lo = po->getProperty ("lfo").getDynamicObject())
        {
            static_cast<Modulation&> (p.lfo) = readModulation (po->getProperty ("lfo"));
            p.lfo.shape = lo->hasProperty ("shape") ? lo->getProperty ("shape").toString() : juce::String ("sine");
            p.lfo.speed = number (lo->getProperty ("speed"), 1.0f);
            p.lfo.mpy = number (lo->getProperty ("mpy"), 1.0f);
            p.lfo.phase = number (lo->getProperty ("phase"), 0.0f);
        }

        if (auto* t = po->getProperty ("trigger").getDynamicObject())
            p.triggerRow = static_cast<int> (number (t->getProperty ("row"), -1.0f));

        out.presets.push_back (std::move (p));
    }

    if (out.presets.empty())
        error = "no presets";

    return out;
}

juce::String toJson (const Pack& p)
{
    auto* root = new juce::DynamicObject();
    if (p.name.isNotEmpty()) root->setProperty ("name", p.name);
    if (p.comment.isNotEmpty()) root->setProperty ("comment", p.comment);

    juce::Array<juce::var> presets;
    for (auto& preset : p.presets)
    {
        auto* po = new juce::DynamicObject();
        po->setProperty ("pos", preset.pos);
        if (preset.name.isNotEmpty()) po->setProperty ("name", preset.name);
        if (preset.comment.isNotEmpty()) po->setProperty ("comment", preset.comment);

        juce::Array<juce::var> list;
        for (auto& row : preset.list)
        {
            auto* ro = new juce::DynamicObject();
            ro->setProperty ("effect", row.effect);
            if (row.bus != 0) ro->setProperty ("BUS", row.bus);
            for (auto& [key, value] : row.params)
                ro->setProperty (key, value);
            list.add (juce::var (ro));
        }
        po->setProperty ("list", list);

        const auto mod = [] (const Modulation& m) -> juce::var
        {
            auto* mo = new juce::DynamicObject();
            if (m.targetsLfo) mo->setProperty ("target", "lfo");
            else mo->setProperty ("row", m.row);
            mo->setProperty ("param", m.param);
            mo->setProperty ("depth", m.depth);
            return juce::var (mo);
        };

        if (preset.handle.isSet()) po->setProperty ("handle", mod (preset.handle));
        if (preset.shake.isSet()) po->setProperty ("shake", mod (preset.shake));
        if (preset.lfo.isSet())
        {
            auto lfo = mod (preset.lfo);
            auto* lo = lfo.getDynamicObject();
            lo->setProperty ("shape", preset.lfo.shape);
            lo->setProperty ("speed", preset.lfo.speed);
            if (preset.lfo.mpy != 1.0f) lo->setProperty ("mpy", preset.lfo.mpy);
            if (preset.lfo.phase != 0.0f) lo->setProperty ("phase", preset.lfo.phase);
            po->setProperty ("lfo", lfo);
        }

        presets.add (juce::var (po));
    }
    root->setProperty ("presets", presets);

    return juce::JSON::toString (juce::var (root), false);
}

Pack starter()
{
    Pack p;
    p.name = "Starter";
    p.comment = "Four chains to show the plugin working. Load a pack of your own over it.";

    const auto row = [] (const char* effect, std::initializer_list<std::pair<juce::String, float>> params)
    {
        Row r;
        r.effect = effect;
        r.params.assign (params);
        return r;
    };

    Preset close;
    close.pos = 0;
    close.name = "Close";
    close.comment = "A voice, tidied. The handle opens the top end.";
    close.list = { row ("HIGHPASS", { { "cutoff", 0.18f } }),
                   row ("EQUALISER", { { "cutoff", 0.55f }, { "q", 0.25f }, { "gain", 0.35f } }),
                   row ("LOWPASS", { { "cutoff", 0.75f } }) };
    close.handle = { 2, "cutoff", 0.25f, false };

    Preset hall;
    hall.pos = 1;
    hall.name = "Hall";
    hall.comment = "Long room, dark echo. Shake throws the tail out.";
    hall.list = { row ("DELAY", { { "time", 0.38f }, { "echo", 0.42f }, { "cross-feed", 0.35f },
                                  { "lowpass-cutoff", 0.45f }, { "wet-level", 0.32f }, { "dry-level", 1.0f } }),
                  row ("REVERB", { { "time", 0.55f }, { "wet-level", 0.35f }, { "dry-level", 1.0f },
                                   { "spring-mix", 0.15f } }) };
    hall.handle = { 0, "time", 0.3f, false };
    hall.shake = { 1, "wet-level", 0.5f, false };

    Preset choir;
    choir.pos = 2;
    choir.name = "Choir";
    choir.comment = "A fifth above and a spring behind it. The one a browser cannot play.";
    choir.list = { row ("HARMONY", { { "pitch", 1.498307f }, { "dry-level", 0.8f } }),
                   row ("REVERB", { { "time", 0.4f }, { "wet-level", 0.3f }, { "dry-level", 1.0f },
                                    { "spring-mix", 0.6f } }) };
    choir.handle = { 0, "pitch", 0.2f, false };
    choir.lfo.row = 1;
    choir.lfo.param = "wet-level";
    choir.lfo.depth = 0.2f;
    choir.lfo.shape = "sine";
    choir.lfo.speed = 0.3f;

    Preset wreck;
    wreck.pos = 3;
    wreck.name = "Wreck";
    wreck.comment = "Driven, ring-modulated, sideband-shifted. Not for singing.";
    wreck.list = { row ("DIST", { { "amount", 14.0f }, { "mix", 0.7f },
                                  { "lowpass-cutoff", 0.6f }, { "highpass-cutoff", 0.25f } }),
                   row ("RING", { { "frequency", 140.0f }, { "mix", 0.4f } }),
                   row ("SSB", { { "frequency", 45.0f } }) };
    wreck.handle = { 1, "frequency", 0.5f, false };
    wreck.shake = { 2, "frequency", 0.3f, false };

    p.presets = { close, hall, choir, wreck };
    return p;
}
} // namespace pack
