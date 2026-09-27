# Mic Gnome

<img src="public/logo-tile.png" alt="Mic Gnome" width="150" align="right" />

A browser patch bay for the [Teenage Engineering EP–2350 fx-mic](https://teenage.engineering/guides/ep-2350).
Hear it before you eject it.

Not affiliated with Teenage Engineering.

## Why

The fx-mic mounts over USB-C as a FAT disk. You drop `1.wav`–`4.wav` and a `config.json`
onto it, eject, and the mic restarts with new sounds. That `config.json` is the whole
instrument — four effect chains, eleven effect blocks, and rules for how the handle,
the accelerometer and an LFO push parameters around while you perform.

It is also a text file with no safety net. The guide says it plainly: break the syntax
and the unit will not start, a missing comma is the number one cause, and recovery means
holding **white + grey** on boot to get the disk back.

So the brief is two sentences:

1. Never let the user write a file that stops the mic booting.
2. Let them hear the preset before it leaves the browser.

## Where it is

**Phase 0 — the safety net.** In progress.

| module | what it does | state |
| --- | --- | --- |
| `src/fxmic/spec.ts` | the device: 10 effects, every parameter and published range, limits, playmodes, LFO shapes | done |
| `src/fxmic/validate.ts` | the validator — errors where the guide is explicit, warnings where it is silent | done |
| `src/fxmic/parse.ts` | the lenient importer — opens files the device would reject, reports every repair | done |
| `src/fxmic/serialize.ts` | canonical `config.json`, plus the handle-map curve | done |
| `src/fxmic/store.ts` | one file-store interface over memory, OPFS and a real directory handle | done |
| `src/fxmic/disk.ts` | the virtual fx-mic — 1 mb ceiling, eject→restart→boot, freeze, recovery, snapshot/restore | done |
| `src/fxmic/wav.ts` | wav decode/encode at 8/16/24-bit and 32-bit float, mono-fold, resample, silence detection | done |
| `src/fxmic/fit.ts` | the fitter — gets four sounds into 1 mb and says what it traded | done |
| `src/bench/` | the bench — preset slots, chain editor, modulation, handle map, sample bay, the write ritual | done |
| `src/bench/Tour.tsx`, `HowTo.tsx`, `progress.ts` | the guide — seven steps docked beside the bench that light up as they are done, and the full guide behind them | done |
| `src/bench/Downloads.tsx`, `submit.ts` | the way out — files to drop on a real fx-mic disk, and "send it in" as a pre-filled GitHub issue | done |
| Web Audio preview | | after the hardware lands |

Nothing here has touched hardware yet — the unit arrives 14 Sep at the earliest.
Until then everything runs against the virtual disk.

### What the virtual mic does and does not model

It models the 1 mb ceiling (refusing a write rather than truncating it), the
eject→restart→boot cycle, the frozen state, the white + grey recovery, and
snapshot/restore so "put it back how it was" is always one call away.

Boot rules follow the guide and stop there. The guide says a syntax error stops the
unit starting; it says nothing about what the firmware does with a value out of range
or an unknown key. So **only a parse failure freezes the virtual mic** — everything
else boots and is reported as a validator finding. A file Mic Gnome had to repair to
open also counts as frozen, because the firmware cannot repair anything. Guessing
harder than the manual would make the simulator lie.

### The rule about severities

An **error** is something the guide states plainly: an unknown effect, a value outside a
published range, a modulation row that does not exist, an effect the guide marks
use-once appearing twice. Errors block the write.

A **warning** is somewhere the guide is silent — `BUS` semantics, whether `trigger` is
mandatory, whether parameter names are case-sensitive, whether unknown keys are ignored.
Warnings never block. Refusing a config that actually works is a worse failure than
passing one that might not.

`spec.AMBIGUOUS` lists every place we made that call, and why.

### Defaults

The guide publishes ranges but not device defaults. So the serializer only writes
parameters the user actually set — emitting a default we invented would quietly change
how somebody's mic sounds. `ParamSpec.start` is Mic Gnome's starting value for the
editor UI only.

### Brand assets

| file | what it is | used by |
| --- | --- | --- |
| `public/favicon.svg` | the mark drawn as a vector — cone hat, beard, orange nose | browser tab |
| `src/bench/Mark.tsx` | the same mark, taking its greys from the theme | app header |
| `public/logo-tile.png` | the square logo, wordmark included | README, `og:image` |
| `public/apple-touch-icon.png` | the same tile at 180px | home-screen icon |
| `public/device.png` | the device render | the help panel |

The tab icon and the header mark are **drawn, not placed**, for two reasons that the
raster cannot solve: the logo's beard is white on white, so the tile becomes a white box
in dark mode; and the wordmark inside it is illegible below about 60px, which is where a
favicon and a header mark both live. The vector is the same artwork with the type removed.

### The glyphs

`src/bench/Glyphs.tsx`. One small drawing per effect block, LFO shape and modulation
source, so a chain can be read by shape before it is read by name. They sit on every
chain row and add-block button, on the modulation panel (the LFO shape picker is four
waveforms rather than a dropdown), at the end of every library preset as a strip —
blocks in their family colour, then a rule, then whatever moves them in orange — and beside each of
the five steps.

Drawn, not placed, for the same reason as the mark: they take `currentColor` from the
text around them, so they survive dark mode and stay crisp at 14px. One-pixel strokes,
no fills, nothing decorative, after the guide's own line drawings. Orange is reserved
for the movers, and each block carries the colour of its family: filters blue, time and
space teal, pitch violet, drive magenta. SAMPLE stays in ink, because it is the sound
rather than something done to it. An effect the mic does not have gets a dashed box with a question mark,
so the chain still lines up and the problem stays visible.

The chain also has a spine now — a hairline down the left with a dot per row and an
arrowhead at the bottom — because "audio falls through top to bottom" is a sentence,
and a line is faster.

### The starter library

`src/packs/library.ts`. Ten packs, thirty-eight presets, in a **library** tab that loads any
of them onto the bench.

| pack | after | idea |
| --- | --- | --- |
| PUNCH IN | OP&ndash;Z punch-in FX | four presets that are gestures, not settings — nothing at rest, extreme at full squeeze |
| FOUR SHAPES | OP&ndash;Z step components | the same patch four ways so you can hear what each LFO shape does |
| KO LO-FI | EP&ndash;133 K.O. II | grit, tape drag, pitch and spring, with the handle used as a performance fader |
| SHORTWAVE | TE OB&ndash;4 | a voice arriving from a long way off: SSB drift, telegraphic echo, hollow room |
| TAPE HEAD | OP&ndash;1 | doubling, an octave underneath, tape wow, saturation ridden across the middle |
| XY RACK | OP&ndash;XY | the three of its six published effects the library did not already have, plus a phaser |
| HOUSE MIC | no device | the working pack: host, tannoy, mc and a fader, with the built-in sounds playing dry |
| Y CABLE | guide &sect;7.10 | the only pack that uses BUS: a clean voice with a copy mangled beside it, four ways |
| QUIZ NIGHT | a pub quiz host&rsquo;s sound desk | the one pack with its own sounds (chime, applause, walk-on, buzzer, all synthesised) and the only one heard on hardware |
| DUAL MONO | windowbed | not ours: a published config known to run on a TING, ending in a clean channel and a wet one |

Each card leads with a **sigil** (`src/bench/Sigil.tsx`) that draws what the pack does
rather than decorating it: PUNCH IN is the punch, FOUR SHAPES is the four shapes,
KO LO-FI is a sine quantised onto a staircase, SHORTWAVE is a carrier drifting off its
tuning line. Generated from the same maths that produces the waveform, in theme colours,
so it survives dark mode and any size. A test fails if a pack has no sigil, or a sigil no
pack.

Every pack but QUIZ NIGHT is **fx-only**: no `samples` block, so per guide 7.5 the mic falls back to its
four factory sounds. Three good consequences: nothing of Teenage Engineering's is
redistributed, a pack is under 2 kB rather than a megabyte, and anyone can try one without
finding a wav first. QUIZ NIGHT is the exception on purpose: its four wavs are made from
scratch by `docs/packs/quiz-night/make_sounds.py`, served from `public/packs/quiz-night/`, and
fetched onto the bench when the pack loads. It is also the only pack marked **tested on
hardware** (fx-mic, firmware 1.1.2, 27 Sep 2026); a test holds `verified` to that list.

Six are homages assembled from the fx-mic's own blocks, not recreations of another
device's DSP. The seventh, HOUSE MIC, is the first pack that is not a demonstration: four
jobs a mic does at an actual event, using the four sounds already in it. It is also the
only pack that puts the SAMPLE row at the **end** of a chain, which per guide 7.5 is how
the built-in sounds play dry — so the censor beep is a beep whatever the voice is doing,
which is the whole point of a censor beep. The eighth, Y CABLE, is the only pack that uses
`BUS`, and so the only one resting on a guess: the guide gives parallel routing a single line
and never says how buses sum. The reading taken is that untagged rows are the voice and a bus
row is a copy summed back in, so every bus row carries wet only (a test enforces it). If the
firmware reads it otherwise these collapse to fully wet serial chains — which is exactly the
thing to find out first when the mic arrives. Chain rows and library strips now show a row's
bus. **None has been heard on hardware yet** — every card says so, and
`verified` flips per pack once each has actually been played through a mic.

The ninth, DUAL MONO, is the only one that is not ours. It is windowbed's published example
pack, walked through preset by preset on video with the mic in hand and released to be
modified and redistributed, so it is the only entry here where every row is known to run.
It earns its place twice over: it is the one pack that demonstrates BALANCE, and it settles
what a `BUS` actually is. Y CABLE guessed a bus was a wet-only copy. DUAL MONO's first row
is a bare pan on bus 2 and its delay on bus 1 carries `dry-level: 1.0`, which means a bus is
a copy of *whatever is at that point*, dry included — wet-only was never the format's rule,
only the convention a send effect follows. The test that enforced it across the whole
library now applies to Y CABLE alone, where it is the point of the pack rather than a claim
about the mic.

The tests are the quality bar, not just a smoke check. Each pack must produce **zero errors
and zero warnings** — a shipped pack is the example everyone copies, so it has to be
exemplary rather than merely legal. Each must round-trip through serialize → parse with no
repairs, fill all four slots, give every preset a SAMPLE row with a matching trigger, and
**not waste the handle**: no handle modulation may hit its ceiling before 90% travel.

Building SHORTWAVE exposed a real flaw in the handle map: it plotted against the
parameter's whole range, and SSB's frequency spans 40,000 hz while a musical shift is 150
of them — the line was flat and told you nothing. It now scales to the travel, pads from
the travel rather than the range, and prints the full range in the caption so nothing is
hidden.
Between them they must use **every one of the eleven blocks** and all four LFO shapes, and
demonstrate shake and handle-controls-LFO as well as ordinary handle modulation. The
library is how someone learns what these things do; a block that appears nowhere is never
heard.

### Reading the guide directly

Everything in `spec.ts` was transcribed from Teenage Engineering's guide, but the guide had
never actually been fetched and checked against it. Doing that confirmed the ten documented
blocks (an eleventh name, `ECHO`, turns out to be DELAY's feedback parameter rather than a
block of its own, and BALANCE really is absent — which is what makes the field-report tier
necessary) and turned up four things the tool did not have:

- **The orange button has five positions, not four**: "no effect and the 4 effect preset
  slots". People count the lights and assume a preset is missing. The white button arms a
  sample slot; the grey one plays it.
- **The four built-in sounds are horn, applause, ringside bell and censor beep** — and the
  beep is not just a sound, it "temporarily mutes fx-mic, for foul language emergencies".
- **The output is a line output**, 8 dBu / 2 VRMS max, 98 dBA SNR, "designed to connect to
  koii or an audio mixer, not directly to headphones", where 2 VRMS "can be very loud". That
  is the only warning in any of this about a person rather than a device, so it now sits
  beside the recovery note in the manual and in the guide tab.
- **Sample names, settled by the readme on the mic's own disk** (`docs/factory-disk/`,
  copied the day the unit arrived). Files called `1.wav`–`4.wav` replace the factory sounds
  with no config at all; a `"samples"` block may name any file, in a folder or not — TE's
  own example uses `samples/whistle1.wav`. So the old `wav-name` warning is gone, and a wav
  only counts as unused when nothing names it.
- **The same readme corrected three things:** the equaliser is `EQUALIZER` with a capital
  `Q` (Mic Gnome wrote `EQUALISER`; the old spelling now warns `effect-spelling`),
  LOWPASS and HIGHPASS take a `Q` too, and BALANCE is TE's, range 0–1. Its own example
  modulates `echo` on a SAMPLE row, so modulating a parameter a block lacks is now a
  warning. It calls the recovery buttons green + white; the standalone mic's are orange,
  white and grey, so RECOVERY still says white + grey.
- **`duck` on a sample**, from firmware 1.0.9 ("duck setting for sample play") and the
  readme's example (`"duck": 1.0` on a oneshot). Neither says what the number means, so
  we measured it (firmware 1.1.2, `docs/test-packs/duck-test`, a held hum through the line
  out): 0 leaves your voice alone, 0.5 drops it about 6.5 dB, 1 silences it while the
  sample plays. Leaving it off is assumed to mean no ducking. The bench has a slider for it; the
  validator only warns on a value outside 0–1 or one that isn't a number. Flash 1.1.2 before
  trusting any of it — 1.0.9 to 1.1.1 misparse user JSON.

### What we know, and who told us

Two sources, and the validator treats them differently. The **guide** is the authority on
what is legal: where it states a rule plainly, breaking it is an error. A **field report**
is somebody who has the hardware saying what actually happens — weaker than the guide,
stronger than nothing, and never enough to refuse a file. `spec.FIELD_REPORTS` names them;
`spec.AMBIGUOUS` says where the guide is silent.

The first field report is windowbed's config, run on an **EP-2350 TING** — the mic bundled
with the EP-40 RIDDIM rather than the standalone unit. Same model number; the two differ in
labelling and in the presets they ship with, and whether they differ in any other way is not
known. That is exactly why the tier exists: everything below stays a warning until it has
been heard on a standalone mic. It moved three things:

- **BALANCE is an effect.** It is nowhere in the guide's effect table, and it appears three
  times in a preset that plays. Mic Gnome used to reject `{ "effect": "BALANCE" }` as an
  unknown effect — a hard error, on a file that runs, which is the one failure this
  validator exists to prevent. It is now a known block, flagged `unverified`, and a value
  outside the range we have *read into* it warns rather than errors: our uncertainty is not
  the user's mistake.
- **SAMPLE on bus 2 is silent**, per the same player, while bus 1 is where the working
  config puts it. A warning, not an error.
- **A trigger is effectively required**, pointed at the SAMPLE row itself, or the sample
  button does nothing. The guide never says so. Still a warning — but one that now names
  the row you want instead of shrugging.

The comments under the same video are a second report, and they cost another hard error.
**A `trigger` can point at an effect row rather than a SAMPLE row**, switching that effect
in and out while the button is held — a way to change sound without changing preset, at the
cost of the sample button, which stops working in that preset. Mic Gnome rejected it
outright. It is a warning now, and one that says what the trade is. (The video's own author
could not reproduce it, which is the honest reason it is a warning and not a fact.)

Two smaller things came out of the same thread. **A wav on the disk that `samples` never
names will not play** — the mic falls back to its factory sounds and the files sit there
looking correct, which is how people lose an afternoon; that is a warning now too. And the
line telling you where to put the SAMPLE row **said the wrong direction**: audio falls top
to bottom, so a SAMPLE row placed earlier runs through everything *below* it, not above.
It was wrong in the guide tab and in the validator's own hint, and "how do I get reverb on
the airhorn" is the most asked question under that video.

`HARMONY`'s pitch now reads back in semitones beside the value. The device wants a ratio,
every musician asks in semitones, and 1.19 is not a number anyone arrives at without a
calculator.

The same report answers a question the help copy could not: the drive is called `fx-mic
disk` on the standalone mic and **`ting boot`** on the TING. Both are named where it
matters, because someone who has been told to look for one name and sees the other stops
dead — and the file is identical either way.

Two smaller things the real file caught: a top-level `comment` (where a published pack
carries its credit and its licence) was **silently deleted on save**, and the LFO has an
undocumented `mpy` field. Anything we do not recognise now survives a round trip at every
level of the file, not just inside a row.

### The pocket manual

`npm run zine` writes `public/zine.html`, so it ships with the site and prints on A4 from
the browser. People with this mic have been asking for a printed syntax reference — the
guide is a web page, and a web page is no use with the lid off the mic and a text editor
open.

It emits two files: `zine.html`, one long A4 sheet to read on screen or print, and
`zine-booklet.html`, the same manual laid out as an **eight page 5.5 × 8.5in booklet** —
which is what a print-on-demand shop wants, and what two folded sheets and a long-arm
stapler produce at home. Both are linked from the guide tab; an unlinked page is not
shipped.

The booklet's pages are **declared, not flowed**, for one reason that is commercial rather
than aesthetic: saddle stitch needs a page count divisible by four, and a reflowing document
does not have a page count you can promise a printer. It is in **reader order, not printer
spreads** — imposition is the printer's job, and doing it here would be a mistake nobody
sees until the box arrives and has been paid for. Twelve pages was the first attempt and
left every page about half empty, which reads as unfinished rather than airy.

It is **generated from `spec.ts`**, which is the entire point. A reference that disagrees
with the validator is worse than no reference: every block, range, note, ambiguity and
field report on the sheet is read out of the same source the validator enforces, so they
cannot drift. Tests fail if a block or a parameter never reaches the page, if the recovery
instruction is not the first thing on it, or if the page ever grows a `<script>` or an
external stylesheet — it has to print from a folder with no network.

Three layout notes worth keeping, all of which only showed up rendered. The blocks flow in
CSS **columns**, not a grid, because a grid gave every row the height of its tallest cell and
left holes beside the long ones. Each parameter's note sits on **its own line** under the
name and range, because three columns in a half-width block put SSB's `-20000 - 20000`
straight through its own footnote. And the booklet's code block is `pre-wrap` at 7pt: on
screen an over-wide `<pre>` scrolls, but on paper it is simply cut off at the trim edge.

The tip jar lives in `src/site.ts` and nowhere else. It had drifted: the bench was still
pointing at GitHub Sponsors long after the decision was Ko-fi, so the manual, the booklet
and the write-succeeded screen now read one constant, and a test asserts they agree.

### One colour, one meaning

The family colours — filters blue, time and space teal, pitch violet, drive magenta, and
SAMPLE deliberately in ink because it is the sound rather than something done to the sound —
existed only inside 20px glyphs, while the printed manual drew every block with a
family-coloured edge and heading. The two said the same thing at different volumes.

The bench now wears it too: a chain row carries its family on its left edge with the block
name in the same colour, and so does the button in the picker that will create it, so the
colour is learned at the point of choosing rather than after the fact. `familyVar()` sits
beside the existing `familyClass()` in `Glyphs.tsx` and is the single source for both.

It stops at the guide column on purpose. Those step borders already carry a meaning — green
done, orange current, muted optional — and a second colour system on the same element would
break the consistency this was for.

### Type scale

`label` (12.5px) and `data` (13.5px) in `src/index.css` are the two utilities almost the
whole UI is built from, so they set the scale. They were 10 and 11.5 and it was squinting
territory next to the EP&ndash;2350 guide, which runs its body near 14px. A tool UI is denser
than a manual, but not that much denser. Changing those two values moves everything.

### Undo

`src/bench/history.ts` wraps the bench reducer and snapshots the config before every edit.
**undo** / **redo** in the header, ⌘Z and ⇧⌘Z (Ctrl+Z / Ctrl+Y). Two things are deliberately
not edits and never enter the history: selecting a preset and moving the handle — they change
what you are looking at, not what would be written to the mic. A slider drag arrives as dozens
of actions and folds into one step while it keeps hitting the same parameter inside a second,
so undo takes the whole drag back rather than one pixel of it. Loading a library pack is an
edit, so undo brings the previous bench back. A hundred steps are kept.

### A pack as a link

`src/bench/share.ts`. **share** in the header copies a URL with the entire pack in its fragment:
JSON, deflate-raw, base64url — a library pack comes to about 150 characters. No server, nothing
stored, and the fragment never leaves the browser, so Cloudflare's logs never see it. Opening
the link puts the pack on the bench through the same lenient parser as file import, so a link
somebody edited by hand gets repaired and reported rather than refused, and the fragment is
then cleared so a reload cannot quietly discard edits. This is the read-only gallery without
the gallery.

### Themes

The palette has a dark variant and follows the system by default. The theme link in the
header cycles **light**, **dark** and **fancy**, and overrides the system per browser (`src/bench/Theme.tsx`, one localStorage key,
stamped on the root before first paint so there is no flash). Every glyph and colour
token has a dark value, which is why the glyphs are drawn rather than placed.

**fancy** is warm charcoal with terracotta, sand and sage, after miaai-lab&rsquo;s "Loading,
Beautifully" (none of its code, which is unlicensed). It adds motion that means something: a
signal falling down the chain, blocks rising in, listen breathing, the handle filling, the
verdict tick drawing itself, hopping dots on anything still working (`src/bench/Hop.tsx`).
It is all CSS on hook classes that do nothing in light and dark, and reduced motion stills it.

### Getting started

`src/bench/Tour.tsx`, `src/bench/HowTo.tsx`, `src/bench/progress.ts`. Two layers.

**how it works** is a seven-step panel that docks in a third column beside the bench, open
by itself on a first visit and afterwards from the tab strip, the **?** button pinned
bottom-right, or **how to use** in the header. Two ways in on purpose: the header link is
easy to miss, and the moment someone wants the recovery instruction is the moment they are
least inclined to hunt for it. The steps are: pick a pack, see what is in it, make the
squeeze do something, your own sounds, check it works, put it on the mic, make it yours and
send it in. Each has a drawing in the same language as the bench's own glyphs, a line
saying *where* it happens that is a link to that tab, and a plain-English body written for
someone who has never opened a JSON file.

The panel lights up as things are actually done rather than asking. `stepStatuses` reads
the bench: a library pack loaded or a chain built, a handle/shake/LFO assigned, samples
present, the virtual write succeeded, `config.json` downloaded, a pack sent in. Own sounds
and send-it-in are optional and never hold the "now" marker. The open step follows the tab
in view, so switching to *samples* opens the samples step unless it is already done. Below
the desktop breakpoint the panel takes the tab area, so picking a tab closes it.

**the full guide** is a modal one link behind the panel. It says up front where
`config.json` comes from, because the obvious question on reading "the mic is configured
by a config.json" is *where do I get one* — and the answer is that you don't. A new mic has
none; it plays its factory sounds until it is given one. Mic Gnome generates the file.
Import exists only for a config you already have. The recovery instruction — hold white +
grey during startup — is in the last step of both layers as well as on the write screen,
because it is the sentence someone will be hunting for in a hurry.

### Reaching a real mic

`src/bench/Downloads.tsx`. Nothing in the deployed site writes to hardware. Under the write
button sit download links for `config.json` and every wav in the pack; the instruction
beside them is the memory-stick one — plug in over USB-C, a drive called *fx-mic disk*
appears, drag the files on, eject. Files deleted from the disk sit in its bin until it is emptied,
still using the 1 MB, and the mic then reports there is not enough space (found on hardware,
26 Sep 2026), so the instruction says to empty the bin. The links are struck through while the verdict has
errors, because this is the file that stops a mic booting. Downloading `config.json` is
what marks step six done.

### Hearing a real mic

The **full guide** (`src/bench/HowTo.tsx`) has a "hear it before the gig" note, from the
route used to test `duck` and QUIZ NIGHT (26–27 Sep 2026). The line out (3.5 mm, up to
+8 dBu) is not detected by a MacBook headset socket on its own. Through an iRig 2 it is:
3.5 mm-to-1/4" adapter → iRig guitar in → iRig lead into the headset socket (it presents as
*External Microphone*), headphones in the iRig. Start with the iRig gain and the orange volume
dial low; the dial ended near two o'clock. In Ableton Live: input *External Microphone*,
output *External Headphones*, buffer 32 samples (128 gave a noticeable monitoring lag),
an audio track on *Ext. In 1*, armed, Monitor *Auto*. Monitor *In* also works while recording
but silences playback of the takes.

### Send it in

`src/bench/submit.ts`. The library is read-only, so offering a pack is a hand-off, not an
upload: **send it in** at the bottom of the library tab opens a pre-filled GitHub issue
(label `pack`) with three prompts — what the pack is after, what the handle does, anything
heard on a real mic — plus the share link, which carries the whole pack on its own. The
serialized JSON is included as well when the URL stays short enough for GitHub to accept.
A person reads it and adds the pack for everyone, or does not.

### The bench

Two columns, three when the guide is open: presets, samples, the handle map, the verdict
and the write button down the left; the tabs — library, chain, samples — in the middle;
**how it works** on the right. The validator's verdict sits directly above the write
button and never behind a tab — you cannot ship a file you have not been told is broken.

Two details that carry a rule each:

**Unset is not zero.** A parameter you have never touched shows `· unset` and stays out
of the file. The slider still sits at a sensible starting position so you can see the
range, but moving it is what writes it.

**Editing never leaves a dangling reference.** Reordering a row remaps every modulation
and trigger so they still point at the same effect. Deleting a row *drops* modulation
that pointed at it rather than repointing it at the neighbour — a wrong target is worse
than an absent one. There is a test asserting that no single edit can produce a config
the validator would reject.

### The fitter

1 mb is the real constraint of this device, not the json. Concessions are applied in a
fixed order — cheapest in quality first — always to the largest unprotected slot:

1. trim leading and trailing silence (free; losing it is not a quality trade)
2. stereo → mono (halves the file; imperceptible on most sound effects)
3. anything above 16-bit → 16-bit
4. sample rate down one stop at a time: 96 → 48 → 44.1 → 32 → 22.05 → 16 → 11.025 → 8 khz
5. 16-bit → 8-bit, last, because it is audibly grainy

Deterministic and explainable, and it always says what it gave up: *"horn.wav: trimmed
0.02 s of silence, stereo → mono. Left gull.wav alone. You got 346 kb back."* A slot can
be given a priority so the sound you care about is protected until everything else is
exhausted. The predicted byte count is the real one — a test asserts the plan's estimate
matches what the encoder actually writes.

## Decisions

- **Free, with a tip jar.** Not a paid product. The editor, validator, preview, import,
  cookbook and gallery stay free. Tips go on the write-succeeded screen and nowhere else —
  never a modal, never on first load. The manual carries the same link on its back page,
  because a thing somebody printed and kept is the one place a tip is not an interruption.
- **The manual is free too**, as HTML and as a print-ready booklet. Print-on-demand stays a
  later option, and only if the tip jar shows there is demand for a physical copy — Lulu's
  own storefront if so, since Lulu is then the seller and the VAT and merchant-of-record
  problem that killed the paid version is theirs rather than ours.
- **Gallery read-only at launch.** Seeded with the cookbook packs and Stephen's own.
  Uploads open later, once there is something to moderate.
- **`micgnome.stephen8n.com`**, public — no Cloudflare Access on this hostname.
- **Free-tier inference** (Workers AI), with BYO-key as the escape valve. Five of the six
  "AI" features need no model at all.
- **Launch gate is hardware validation, not the calendar.** Do not ship a "write to your
  mic" button that has never written to a mic.

## Deploy

Cloudflare Pages, public, at **micgnome.stephen8n.com**. Nothing on the Mini and nothing
in the tunnel — it is a static site and the Mini is forty apps behind one cloudflared.

```sh
npx wrangler login   # once per machine, opens a browser
npm run deploy       # build + deploy
```

Live at **https://micgnome.pages.dev** and, once its DNS record exists,
**micgnome.stephen8n.com**.

The Cloudflare API token in `~/secrets/api-keys/cloudflare.env` verifies fine but has **no
Pages permission and no DNS scope**, so it cannot deploy and cannot touch DNS. The OAuth
login above covers Pages; DNS still does not.

### The custom domain

`micgnome.stephen8n.com` is attached to the Pages project already, but sits at **pending**
until one DNS record exists. Neither wrangler's OAuth scopes nor the stored API token can
write DNS, so this is the one dashboard step:

    CNAME   micgnome   →   micgnome.pages.dev   (proxied)

Cloudflare issues the certificate on its own once that resolves. Two standing rules:

- **No Cloudflare Access policy** on this hostname. Public from day one is the decision.
- **Never** add `micgnome` to the tunnel ingress in `~/.cloudflared/config.yml`. That
  record and the Pages custom domain want the same name and would fight.

`public/_headers` carries CSP, `nosniff`, `frame-ancestors 'none'` and a Permissions-Policy
that leaves only the microphone open, for the preview engine later. `connect-src 'self'`
is honest about the architecture: the app talks to your disk, not to a server.

### Not yet a launch

The deployed site writes to the **virtual** mic only — there is no real-disk code in it
yet, which is exactly why it is safe to put up now. The launch gate still stands: no
"write to your mic" button ships until it has written to a mic.

## Develop

```sh
npm install
npm run dev
npm test          # 184 tests, including TE's documented example and one known to run
npm run typecheck
```

The guide's worked example from chapter 7.11 is a fixture in the test suite. If the
validator ever rejects Teenage Engineering's own documented preset, the validator is wrong.
