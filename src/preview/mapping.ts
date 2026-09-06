/**
 * Turning the mic's numbers into audio ones.
 *
 * The device publishes most of its parameters as 0 to 1 and never says what
 * they mean in hertz or seconds. Everything here is therefore *our reading*,
 * chosen to sound plausible, and it is kept in one pure module so it can be
 * argued with, tested, and corrected the day someone hears the real thing.
 *
 * The rule the whole preview follows: **never pretend.** A block we cannot
 * honestly approximate is declared unplayable and named in the UI, exactly as
 * the validator warns rather than guessing. A preview that quietly ignored SSB
 * would teach someone their preset does nothing.
 */
import { EFFECTS } from '../fxmic/spec'

/** Why a block is missing from the preview, in words a person can read. */
export const NOT_PREVIEWED: Record<string, string> = {
  HARMONY:
    'pitch shifting needs more than the browser gives us directly — you will hear the dry voice, not the harmony',
  SSB:
    'a frequency shifter is not something a browser can fake convincingly, so this block is skipped',
  SAMPLE:
    'the four sounds live in the mic itself and are not ours to ship, so there is nothing here to play',
}

export const isPreviewed = (effect: string): boolean => !(effect in NOT_PREVIEWED)

/** Every block is either previewed or has a stated reason. Enforced by a test. */
export const PREVIEWED_EFFECTS = EFFECTS.map((e) => e.name).filter(isPreviewed)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 0..1 across a frequency range, by ear rather than by arithmetic: pitch is
 * logarithmic, so a linear sweep spends most of its travel doing nothing
 * audible at the top.
 */
const exponential = (x: number, lo: number, hi: number) => lo * Math.pow(hi / lo, clamp(x, 0, 1))

/**
 * A low-pass at "0" should sound closed but not silent — the device plainly
 * still passes voice there, and a preview that goes mute reads as broken.
 */
export const lowpassHz = (x: number) => exponential(x, 90, 18_000)

/** A high-pass at "0" is off, so it must sit below anything audible. */
export const highpassHz = (x: number) => exponential(x, 20, 6_000)

/** The EQ band sweeps the range a voice actually occupies. */
export const eqHz = (x: number) => exponential(x, 120, 8_000)

/** Wide to surgical. Never below 0.3, which stops being a band at all. */
export const eqQ = (x: number) => 0.3 + clamp(x, 0, 1) * 11.7

/** The one parameter besides SSB that goes negative: a cut as well as a boost. */
export const eqGainDb = (x: number) => clamp(x, -1, 1) * 20

/** Delay "time" 0..1.1. The ceiling is 1.1, not 1.0 — see the spec's note. */
export const delaySeconds = (x: number) => 0.01 + clamp(x, 0, 1.1) * 0.99

/** Reverb "time" as the length of the tail we synthesise. */
export const reverbSeconds = (x: number) => 0.15 + clamp(x, 0, 1) * 3.5

/** RING and SSB carry real hertz already; only guard the range. */
export const ringHz = (x: number) => clamp(x, 0, 20_000)

/**
 * DIST "amount" runs to 40, which is a lot of drive. Curve it so the first
 * third of the range is usable rather than instantly destroyed.
 */
export const distortionDrive = (x: number) => Math.pow(clamp(x, 0, 40) / 40, 0.6) * 100

/**
 * A waveshaper curve for the drive above. Standard soft-clip: gentle at low
 * drive, squarer as it climbs, and symmetrical so it adds odd harmonics like an
 * overdriven preamp rather than sounding like a broken speaker.
 */
export function distortionCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4))
  const k = Math.max(0.0001, drive)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

/** 0 = hard left, 1 = hard right, 0.5 = centre. Web Audio wants -1..1. */
export const balanceToPan = (x: number) => clamp(x, 0, 1) * 2 - 1

/**
 * Apply a modulation source to a parameter.
 *
 * The device's movers are described only as "moves one parameter on one row" by
 * some depth, so this is our reading: depth is a signed proportion of the
 * parameter's own published range, added to its set value and clamped back into
 * range. Squeezing to 100% with depth 1 therefore sweeps to the top of the
 * range, which matches what the handle map in the bench already draws.
 */
export function modulate(base: number, depth: number, amount: number, min: number, max: number): number {
  return clamp(base + depth * amount * (max - min), Math.min(min, max), Math.max(min, max))
}
