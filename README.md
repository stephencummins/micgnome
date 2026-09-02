# Mic Gnome

A browser patch bay for the [Teenage Engineering EP–2350 fx-mic](https://teenage.engineering/guides/ep-2350).
Hear it before you eject it.

Not affiliated with Teenage Engineering.

## Why

The fx-mic mounts over USB-C as a FAT disk. You drop `1.wav`–`4.wav` and a `config.json`
onto it, eject, and the mic restarts with new sounds. That `config.json` is the whole
instrument — four effect chains, ten effect blocks, and rules for how the handle,
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
| chain editor, sample bay, handle map | | next |
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

## Decisions

- **Free, with a tip jar.** Not a paid product. The editor, validator, preview, import,
  cookbook and gallery stay free. Tips go on the write-succeeded screen and nowhere else —
  never a modal, never on first load.
- **Gallery read-only at launch.** Seeded with the cookbook packs and Stephen's own.
  Uploads open later, once there is something to moderate.
- **`micgnome.stephen8n.com`**, public — no Cloudflare Access on this hostname.
- **Free-tier inference** (Workers AI), with BYO-key as the escape valve. Five of the six
  "AI" features need no model at all.
- **Launch gate is hardware validation, not the calendar.** Do not ship a "write to your
  mic" button that has never written to a mic.

## Develop

```sh
npm install
npm run dev
npm test          # 39 tests, including TE's own documented example
npm run typecheck
```

The guide's worked example from chapter 7.11 is a fixture in the test suite. If the
validator ever rejects Teenage Engineering's own documented preset, the validator is wrong.
