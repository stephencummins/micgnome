# the plugin

The EP-2350's effect chain as a VST3, an Audio Unit and a standalone app, so a
pack can be auditioned on a real signal — through a DAW, at any sample rate,
with the DAW's own automation on the movers — before it goes onto the mic's
USB disk.

It loads the same `config.json` the site validates. Nothing is converted and
nothing is re-authored: the five positions of the orange button become a
five-way selector, the handle and the shake become two sliders, and the chain
plays top to bottom the way the mic runs it.

## Building

```sh
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j 8
```

JUCE 8 is fetched by CMake; there is nothing to install first beyond the Xcode
command line tools. `COPY_PLUGIN_AFTER_BUILD` installs the VST3 and the
component into `~/Library/Audio/Plug-Ins/`, so a build is a deploy. Validate
the AU the way the OS will:

```sh
auval -v aufx Mgn1 Mgnm
```

## The spec is generated, not typed

`Source/Spec.generated.h` comes from `src/fxmic/spec.ts` via `npm run
plugin-spec`, for the same reason the zine does: a second description of the
mic that can disagree with the first is worse than none. Change a range in the
TypeScript, run the script, rebuild. Never edit the header.

## What it plays, and what it does not

Ten of the eleven blocks play. `SAMPLE` does not, and the panel says so in
words rather than ignoring the row — the four sounds live in the mic itself, so
there is nothing here to play. That is the site's rule kept: **never pretend.**
A row that cannot be honestly approximated is declared unplayed and named.

Two blocks play *better* here than in the browser preview, because Web Audio
has no node for either:

- **HARMONY** — two crossfaded taps on a delay line, the rotating tape head a
  cheap hardware harmoniser has always used. A phase vocoder would be cleaner
  and would not sound like this mic.
- **SSB** — a Hartley frequency shifter over a four-section Hilbert pair, so
  negative shifts work as well as positive ones.

**DELAY** also gets its cross-feed, which the preview skips only because
crossing two feedback paths in Web Audio is awkward.

The readings that are guesses are still guesses, and they are shared with the
preview on purpose: `Source/Mapping.h` is a line-for-line port of
`src/preview/mapping.ts`. If one of them is corrected the day someone hears the
real mic, correct both — otherwise a pack auditioned on the site arrives in the
DAW as a different preset.

Three readings are the plugin's alone, because the preview has no equivalent:
the reverb's room size from its published tail length, the spring as an allpass
chain, and the LFO's unpublished `speed` unit taken as hertz up to twenty.

## Real-time discipline

Nothing allocates, locks or touches a file on the audio thread. The biquads are
hand-rolled rather than `juce::dsp::IIR`, whose coefficients are a
reference-counted object — an allocation, per sweep. Chains are built and
prepared on the message thread and handed over under a spin lock the audio
thread only ever *tries* to take; a failed try passes the block through rather
than waiting. Parameters are recomputed once per 64-sample control block and
gains ramp across it, so a swept filter slides instead of stepping.

| file | what it is |
|---|---|
| `Source/Dsp.h` | biquad, delay line, allpass, Hilbert pair, pitch shifter |
| `Source/Mapping.h` | the mic's numbers to audio ones — ported from the preview |
| `Source/Blocks.h` | one class per effect block |
| `Source/Chain.*` | a preset's chain, the movers and the LFO over it |
| `Source/Pack.*` | `config.json` in and out |
| `Source/PluginProcessor.*` | parameters, state, the audio callback |
| `Source/PluginEditor.*` | the panel |
| `Source/Spec.generated.h` | **generated** — see above |
