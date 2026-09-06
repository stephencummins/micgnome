# The REPL API, and somebody else's editor

*Saved 2026-09-06 from a Reddit thread, to pick up later. Nothing here has been
run against hardware by us.*

## What was found

**brunomarinho** (supervisedmusic.com) has built a preset editor for this mic that
**connects directly to the device over Web Serial**, driving the firmware's MicroPython
REPL, and lets you change parameters **in real time** rather than writing a file and
ejecting. He has also published documentation of the REPL API, and an experimental drum
machine that plays rhythms on a grid using the four samplers.

- Thread: <https://www.reddit.com/r/teenageengineering/comments/1pid6ba/a_thing_for_ting/>
- REPL API docs: <https://github.com/brunomarinho/labs-te-ting-preset/blob/main/docs/REPL-API.md>
- Drum machine: <https://ting-drums.brunomarinho.com/>

His own caveat: the API gives no access to write custom DSP, so you cannot invent a new
effect. Firmware hacking he leaves to others.

## What it confirms, and it is the strongest evidence yet

The REPL's own effect list is read out of the firmware, which makes it better evidence than
the guide for what the device actually has:

- **BALANCE is a real effect.** It appears in the firmware's list. We added it on the
  strength of one video and marked it `unverified`; this is independent confirmation from
  the device itself. It is still not in TE's guide.
- **`mpy` is a real LFO key.** The documented modulation keys are `row, param, depth, shape,
  speed, phase, mpy` — exactly the set we carry, including the one the guide never mentions.
- **A "no effect" position exists**: `teenage.fx_pos` reads `-1` when none is selected, which
  matches the guide's "no effect and the 4 effect preset slots".
- 4 preset slots, 4 sample slots, ~1 MB of sample storage — all as we have them.

## What it adds that we do not have

- **A chain length limit: up to 16 effects per preset.** Our validator has no such limit and
  would happily write a longer one. Cheap to add, and it is a real ceiling.
- **`NONE` appears as an effect type** in the firmware list, presumably the bypass.
- **8 LEDs**, addressable as `ui.leds(fx_pos, sam_pos)` — orange for presets, white for samples.
- **Scripts over ~5000 characters can crash the device**; large config.json writes need to go
  line by line. That is a hard constraint on any live-connection feature.
- Connection details: USB serial, VID `0x2367`, PID `0x0620`, 115200 baud, then import the
  `fx`, `teenage`, `ui` and `spl` modules.

## An open question worth resolving before trusting the list

The firmware list as summarised is LOWPASS, DELAY, REVERB, DIST, HARMONY, SAMPLE, BALANCE,
HIGHPASS, SSB, RING — **no EQUALISER**, which TE's own guide documents with cutoff, q and
gain. Either the summary dropped it, or the guide documents a block the firmware does not
expose under that name. Read the source doc directly before acting on this; do **not** remove
EQUALISER from the spec on the strength of a summary.

## What this could mean for Mic Gnome

Two things, pulling in opposite directions.

**The opportunity.** Everything Mic Gnome does is write-a-file-and-eject, deliberately: it
never touches the device, which is why it is a web page that works anywhere and cannot brick
a mic by talking to hardware badly. Web Serial would let the bench *hear* a change as you
drag a slider, which is the one thing the preview engine can only approximate. It would also
make `verified` a thing the tool could establish rather than something Stephen has to do by
ear on the 14th.

**The overlap.** Somebody else has already built a preset editor for this mic, and theirs
does the live thing. Worth reading his before deciding what Mic Gnome is for. The parts that
are still ours alone: the validator that refuses to write a file that stops the mic booting,
the pack library, the help written for people who know Word and email, and the printed
manual.

Both are decisions for Stephen, not defaults.
