/**
 * The preview engine: one Web Audio graph per preset, built from the chain.
 *
 * Native Web Audio throughout, no audio library. Most of the mic's blocks map
 * onto a built-in node almost exactly, and the ones that do not are declared
 * unplayable rather than faked — see mapping.ts.
 *
 * Audio falls down the chain, which is the mic's own rule and conveniently also
 * how you connect nodes: each row's output is the next row's input.
 */
import { effectByName, paramByName } from '../fxmic/spec'
import type { EffectRow, Preset } from '../fxmic/types'
import {
  NOT_PREVIEWED,
  balanceToPan,
  delaySeconds,
  distortionCurve,
  distortionDrive,
  eqGainDb,
  eqHz,
  eqQ,
  highpassHz,
  isPreviewed,
  lowpassHz,
  modulate,
  reverbSeconds,
  ringHz,
} from './mapping'

/** A parameter the movers can reach while the preview is running. */
interface LiveParam {
  row: number
  param: string
  set: (value: number) => void
  min: number
  max: number
  base: number
}

export interface Rig {
  context: AudioContext
  /** Feed the chain from here. */
  input: GainNode
  /** Rows that were skipped, with the reason, for the UI to state plainly. */
  skipped: { row: number; effect: string; why: string }[]
  /** Apply the handle at 0..1. Cheap enough to call on every slider move. */
  setHandle: (amount: number) => void
  /** Apply the shake at 0..1. Momentary in life; a held button here. */
  setShake: (amount: number) => void
  stop: () => void
}

const value = (row: EffectRow, param: string, fallback: number): number => {
  const v = row[param]
  return typeof v === 'number' ? v : fallback
}

/** The published start value, which is what the device uses for an untouched param. */
function start(effect: string, param: string): number {
  const spec = effectByName(effect)
  const p = spec && paramByName(spec, param)
  return p ? p.start : 0
}

function range(effect: string, param: string): { min: number; max: number } {
  const spec = effectByName(effect)
  const p = spec && paramByName(spec, param)
  return p ? { min: p.min, max: p.max } : { min: 0, max: 1 }
}

/**
 * A synthesised impulse response: white noise under an exponential decay, which
 * is the cheapest thing that sounds like a room rather than a delay. Not the
 * mic's reverb — nobody has heard that yet — just a plausible one.
 */
function impulse(context: AudioContext, seconds: number, bright: number): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(seconds * rate))
  const buffer = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      // A brighter tail rings longer at the top, which is the "spring" end of it.
      const decay = Math.pow(1 - i / length, 2 + (1 - bright) * 3)
      data[i] = (Math.random() * 2 - 1) * decay
    }
  }
  return buffer
}

/** Build one row. Returns its input and output, or null when it is not previewed. */
function buildRow(
  context: AudioContext,
  row: EffectRow,
  index: number,
  live: LiveParam[],
): { input: AudioNode; output: AudioNode } | null {
  const effect = row.effect
  if (!isPreviewed(effect)) return null

  const get = (param: string) => value(row, param, start(effect, param))
  const track = (param: string, set: (v: number) => void) => {
    const { min, max } = range(effect, param)
    live.push({ row: index, param, set, min, max, base: get(param) })
    set(get(param))
  }

  switch (effect) {
    case 'LOWPASS': {
      const node = context.createBiquadFilter()
      node.type = 'lowpass'
      track('cutoff', (v) => (node.frequency.value = lowpassHz(v)))
      return { input: node, output: node }
    }

    case 'HIGHPASS': {
      const node = context.createBiquadFilter()
      node.type = 'highpass'
      track('cutoff', (v) => (node.frequency.value = highpassHz(v)))
      return { input: node, output: node }
    }

    case 'EQUALISER': {
      const node = context.createBiquadFilter()
      node.type = 'peaking'
      track('cutoff', (v) => (node.frequency.value = eqHz(v)))
      track('q', (v) => (node.Q.value = eqQ(v)))
      track('gain', (v) => (node.gain.value = eqGainDb(v)))
      return { input: node, output: node }
    }

    case 'BALANCE': {
      const node = context.createStereoPanner()
      track('balance', (v) => (node.pan.value = balanceToPan(v)))
      return { input: node, output: node }
    }

    case 'DIST': {
      // Its own filters sit around the shaper, as the device's parameters imply.
      const input = context.createGain()
      const high = context.createBiquadFilter()
      high.type = 'highpass'
      const shaper = context.createWaveShaper()
      const low = context.createBiquadFilter()
      low.type = 'lowpass'
      const wet = context.createGain()
      const dry = context.createGain()
      const out = context.createGain()

      input.connect(high).connect(shaper).connect(low).connect(wet).connect(out)
      input.connect(dry).connect(out)

      track('amount', (v) => (shaper.curve = distortionCurve(distortionDrive(v))))
      track('mix', (v) => {
        wet.gain.value = v
        dry.gain.value = 1 - v
      })
      track('lowpass-cutoff', (v) => (low.frequency.value = lowpassHz(v)))
      track('highpass-cutoff', (v) => (high.frequency.value = highpassHz(v)))
      return { input, output: out }
    }

    case 'RING': {
      // Ring modulation is a multiply: the carrier drives a gain the signal
      // passes through, so the output is signal × carrier.
      const input = context.createGain()
      const ring = context.createGain()
      ring.gain.value = 0
      const carrier = context.createOscillator()
      carrier.type = 'sine'
      const depth = context.createGain()
      depth.gain.value = 1
      carrier.connect(depth).connect(ring.gain)
      carrier.start()

      const wet = context.createGain()
      const dry = context.createGain()
      const out = context.createGain()
      input.connect(ring).connect(wet).connect(out)
      input.connect(dry).connect(out)

      track('frequency', (v) => (carrier.frequency.value = ringHz(v)))
      track('mix', (v) => {
        wet.gain.value = v
        dry.gain.value = 1 - v
      })
      return { input, output: out }
    }

    case 'DELAY': {
      const input = context.createGain()
      const delay = context.createDelay(2)
      const feedback = context.createGain()
      const low = context.createBiquadFilter()
      low.type = 'lowpass'
      const high = context.createBiquadFilter()
      high.type = 'highpass'
      const wet = context.createGain()
      const dry = context.createGain()
      const pan = context.createStereoPanner()
      const out = context.createGain()

      input.connect(delay)
      delay.connect(high).connect(low).connect(feedback).connect(delay) // the echo
      low.connect(wet).connect(pan).connect(out)
      input.connect(dry).connect(out)

      track('time', (v) => (delay.delayTime.value = delaySeconds(v)))
      // Feedback must stay below 1 or the echo grows without limit.
      track('echo', (v) => (feedback.gain.value = Math.min(0.95, v)))
      track('lowpass-cutoff', (v) => (low.frequency.value = lowpassHz(v)))
      track('highpass-cutoff', (v) => (high.frequency.value = highpassHz(v)))
      track('wet-level', (v) => (wet.gain.value = v))
      track('dry-level', (v) => (dry.gain.value = v))
      track('balance', (v) => (pan.pan.value = balanceToPan(v)))
      return { input, output: out }
    }

    case 'REVERB': {
      const input = context.createGain()
      const high = context.createBiquadFilter()
      high.type = 'highpass'
      const convolver = context.createConvolver()
      const wet = context.createGain()
      const dry = context.createGain()
      const out = context.createGain()

      input.connect(high).connect(convolver).connect(wet).connect(out)
      input.connect(dry).connect(out)

      let seconds = reverbSeconds(get('time'))
      let bright = get('spring-mix')
      const rebuild = () => (convolver.buffer = impulse(context, seconds, bright))
      track('time', (v) => {
        seconds = reverbSeconds(v)
        rebuild()
      })
      track('spring-mix', (v) => {
        bright = v
        rebuild()
      })
      track('wet-level', (v) => (wet.gain.value = v))
      track('dry-level', (v) => (dry.gain.value = v))
      track('highpass-cutoff', (v) => (high.frequency.value = highpassHz(v)))
      return { input, output: out }
    }

    default:
      return null
  }
}

/**
 * Wire a preset into a running graph.
 *
 * `destination` is passed in rather than assumed so a caller can render to
 * something other than the speakers later.
 */
export function buildRig(context: AudioContext, preset: Preset, destination: AudioNode): Rig {
  const input = context.createGain()
  const skipped: Rig['skipped'] = []
  const live: LiveParam[] = []

  let tail: AudioNode = input
  preset.list.forEach((row, index) => {
    const built = buildRow(context, row, index, live)
    if (!built) {
      const spec = effectByName(row.effect)
      skipped.push({
        row: index,
        effect: row.effect,
        why: spec ? (NOT_PREVIEWED[row.effect] ?? 'this block is not in the preview') : 'the mic has no block by that name',
      })
      return
    }
    tail.connect(built.input)
    tail = built.output
  })

  // A little headroom: chains with several wet blocks stack up fast.
  const trim = context.createGain()
  trim.gain.value = 0.7
  tail.connect(trim).connect(destination)

  /**
   * The handle and the shake are two movers over the same set of parameters, so
   * they are applied together rather than one at a time: if both point at the
   * same parameter their depths compose, and letting go of one puts the
   * parameter back where the other left it rather than back to its set value.
   *
   * Only parameters something actually points at are written. That is not a
   * micro-optimisation — REVERB re-synthesises its impulse response when its
   * time changes, so blindly re-setting every parameter on every move of a
   * slider would rebuild a buffer for nothing.
   */
  const movers = [
    { mod: preset.handle, amount: 0 },
    { mod: preset.shake, amount: 0 },
  ].filter((m) => m.mod && typeof m.mod.row === 'number' && m.mod.param)

  const apply = () => {
    for (const param of live) {
      const pointed = movers.filter((m) => m.mod!.row === param.row && m.mod!.param === param.param)
      if (pointed.length === 0) continue
      let value = param.base
      for (const m of pointed) {
        value = modulate(value, m.mod!.depth ?? 0, m.amount, param.min, param.max)
      }
      param.set(value)
    }
  }

  const setMover = (index: number) => (amount: number) => {
    const mover = movers[index]
    if (!mover) return
    mover.amount = amount
    apply()
  }

  // The filter above drops absent movers, so the handle is not always index 0.
  const indexOf = (mod: typeof preset.handle) => movers.findIndex((m) => m.mod === mod)

  return {
    context,
    input,
    skipped,
    setHandle: setMover(indexOf(preset.handle)),
    setShake: setMover(indexOf(preset.shake)),
    stop: () => {
      try {
        input.disconnect()
        trim.disconnect()
      } catch {
        // Already torn down; nothing to do.
      }
    },
  }
}
