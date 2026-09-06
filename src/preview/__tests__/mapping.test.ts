import { describe, expect, it } from 'vitest'
import {
  NOT_PREVIEWED,
  PREVIEWED_EFFECTS,
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
} from '../mapping'
import { EFFECTS, LIMITS, effectByName, paramByName } from '../../fxmic/spec'

// Everything in this file is our reading of numbers the guide never explains.
// The tests are therefore about staying honest and staying audible, not about
// matching a device nobody has heard yet.

describe('every block is either previewed or has a reason', () => {
  it('accounts for all eleven blocks, with no invented ones', () => {
    const named = new Set([...PREVIEWED_EFFECTS, ...Object.keys(NOT_PREVIEWED)])
    for (const effect of EFFECTS) expect(named, effect.name).toContain(effect.name)
    for (const name of Object.keys(NOT_PREVIEWED)) {
      expect(effectByName(name), `${name} is not a real block`).toBeDefined()
    }
  })

  it('gives a reason a person can read, not a code', () => {
    for (const [name, why] of Object.entries(NOT_PREVIEWED)) {
      expect(why.length, name).toBeGreaterThan(30)
      expect(why, name).not.toMatch(/[A-Z]{3,}_[A-Z]/)
    }
  })

  it('skips exactly the three we cannot do honestly', () => {
    // Adding to this list is a product decision, not a refactor: it means
    // someone hears less than they think they do.
    expect(Object.keys(NOT_PREVIEWED).sort()).toEqual(['HARMONY', 'SAMPLE', 'SSB'])
    expect(isPreviewed('REVERB')).toBe(true)
  })
})

describe('staying audible across the whole travel of a knob', () => {
  it('never closes the low-pass to silence, because silence reads as broken', () => {
    expect(lowpassHz(0)).toBeGreaterThan(80)
    expect(lowpassHz(1)).toBeGreaterThan(15_000)
  })

  it('leaves the high-pass out of the way when it is off', () => {
    // Its start value is 0 — at that setting it must do nothing audible.
    expect(highpassHz(0)).toBeLessThanOrEqual(20)
    expect(highpassHz(1)).toBeGreaterThan(4_000)
  })

  it('moves a filter more per turn low down than high up, as ears hear it', () => {
    const lower = lowpassHz(0.2) - lowpassHz(0.1)
    const upper = lowpassHz(1.0) - lowpassHz(0.9)
    expect(upper).toBeGreaterThan(lower)
  })

  it('sweeps the EQ across the range a voice lives in', () => {
    expect(eqHz(0)).toBeGreaterThanOrEqual(100)
    expect(eqHz(1)).toBeLessThanOrEqual(10_000)
    expect(eqQ(0)).toBeGreaterThan(0)
  })

  it('cuts as well as boosts, which is the only signed parameter here', () => {
    expect(eqGainDb(-1)).toBeLessThan(0)
    expect(eqGainDb(0)).toBe(0)
    expect(eqGainDb(1)).toBeGreaterThan(0)
  })

  it('honours the delay ceiling of 1.1, which is not a typo in the spec', () => {
    const spec = effectByName('DELAY')!
    expect(paramByName(spec, 'time')!.max).toBe(1.1)
    expect(delaySeconds(1.1)).toBeGreaterThan(delaySeconds(1.0))
    expect(delaySeconds(0)).toBeGreaterThan(0)
  })

  it('gives reverb a tail that grows but never runs away', () => {
    expect(reverbSeconds(0)).toBeGreaterThan(0)
    expect(reverbSeconds(1)).toBeLessThan(5)
    expect(reverbSeconds(1)).toBeGreaterThan(reverbSeconds(0))
  })

  it('keeps ring modulation inside the range the device publishes', () => {
    const spec = effectByName('RING')!
    expect(ringHz(999_999)).toBe(paramByName(spec, 'frequency')!.max)
    expect(ringHz(-5)).toBe(0)
  })
})

describe('the distortion curve', () => {
  it('passes quiet signals through nearly untouched at low drive', () => {
    const curve = distortionCurve(distortionDrive(0))
    const middle = curve[Math.floor(curve.length / 2)]
    expect(Math.abs(middle)).toBeLessThan(0.05)
  })

  it('squashes harder as the amount climbs, without ever leaving the rails', () => {
    const gentle = distortionCurve(distortionDrive(5))
    const brutal = distortionCurve(distortionDrive(40))
    const at = (c: Float32Array) => c[Math.floor(c.length * 0.75)]
    expect(at(brutal)).toBeGreaterThan(at(gentle))
    for (const c of [gentle, brutal]) {
      for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(1.0001)
    }
  })

  it('is symmetrical, so it overdrives rather than sounding broken', () => {
    const c = distortionCurve(distortionDrive(20))
    expect(c[0]).toBeCloseTo(-c[c.length - 1], 1)
  })
})

describe('balance', () => {
  it('reads the device\'s 0 to 1 as left to right, centred at a half', () => {
    expect(balanceToPan(0)).toBe(-1)
    expect(balanceToPan(0.5)).toBe(0)
    expect(balanceToPan(1)).toBe(1)
  })
})

describe('what a mover does to a parameter', () => {
  it('sweeps a parameter to the top of its own range at full depth', () => {
    expect(modulate(0, 1, 1, 0, 1)).toBe(1)
  })

  it('does nothing at rest, so an untouched handle leaves the sound alone', () => {
    expect(modulate(0.4, 1, 0, 0, 1)).toBe(0.4)
  })

  it('can pull a parameter down as well as up', () => {
    expect(modulate(0.5, -1, 1, 0, 1)).toBe(0)
  })

  it('never leaves the range, however hard it is pushed', () => {
    expect(modulate(0.9, 1, 1, 0, 1)).toBe(1)
    expect(modulate(0.1, -1, 1, 0, 1)).toBe(0)
  })

  it('scales to a parameter whose range is not 0 to 1', () => {
    // RING's frequency runs to 20 kHz; a half-depth squeeze should move it in
    // hertz, not by a fraction of one.
    const { min, max } = { min: 0, max: LIMITS.busValues ? 20_000 : 1 }
    expect(modulate(200, 0.5, 1, min, max)).toBeGreaterThan(5_000)
  })
})
