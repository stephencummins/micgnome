import { describe, expect, it } from 'vitest'
import { buildRig } from '../engine'
import { NOT_PREVIEWED } from '../mapping'
import { EFFECTS } from '../../fxmic/spec'
import { blankRow } from '../../fxmic/serialize'
import type { Preset } from '../../fxmic/types'

/**
 * A stand-in for the browser's audio engine.
 *
 * Web Audio does not exist in Node and mocking it properly would be a project
 * of its own, but the engine only touches a small, well-defined corner of it.
 * This records what was made and what was joined to what, which is exactly what
 * the tests below need to ask about — no sound required.
 */
interface FakeNode {
  kind: string
  connections: FakeNode[]
  connect: (to: FakeNode) => FakeNode
  disconnect: () => void
  [key: string]: unknown
}

function fakeContext() {
  const made: FakeNode[] = []
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = {
      kind,
      connections: [],
      connect(to: FakeNode) {
        n.connections.push(to)
        return to
      },
      disconnect() {},
      ...extra,
    }
    made.push(n)
    return n
  }
  const param = () => ({ value: 0 })
  const context = {
    sampleRate: 48_000,
    destination: node('destination'),
    createGain: () => node('gain', { gain: param() }),
    createBiquadFilter: () => node('biquad', { type: '', frequency: param(), Q: param(), gain: param() }),
    createDelay: () => node('delay', { delayTime: param() }),
    createStereoPanner: () => node('panner', { pan: param() }),
    createWaveShaper: () => node('shaper', { curve: null }),
    createConvolver: () => node('convolver', { buffer: null }),
    createOscillator: () => node('oscillator', { type: '', frequency: param(), start() {} }),
    createBuffer: (channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
      numberOfChannels: channels,
    }),
  }
  return { context: context as unknown as AudioContext, made, node }
}

const preset = (list: Preset['list'], extra: Partial<Preset> = {}): Preset => ({ list, ...extra })

/** The fake satisfies everything the engine actually touches, but not the DOM type. */
const asAudio = (n: FakeNode) => n as unknown as AudioNode

describe('building a chain that can be heard', () => {
  it('builds a node for every block it claims to preview', () => {
    for (const effect of EFFECTS) {
      if (effect.name in NOT_PREVIEWED) continue
      const { context, node } = fakeContext()
      const rig = buildRig(context, preset([blankRow(effect.name)]), asAudio(node('out')))
      expect(rig.skipped, `${effect.name} should be playable`).toEqual([])
    }
  })

  it('names the blocks it cannot play, and says why, rather than dropping them', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(context, preset([blankRow('SSB'), blankRow('LOWPASS')]), asAudio(node('out')))
    expect(rig.skipped).toHaveLength(1)
    expect(rig.skipped[0]).toMatchObject({ row: 0, effect: 'SSB' })
    expect(rig.skipped[0].why).toBe(NOT_PREVIEWED.SSB)
  })

  it('keeps the row numbers of what it skipped, so the message can point at one', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(context, preset([blankRow('LOWPASS'), blankRow('HARMONY'), blankRow('SAMPLE')]), asAudio(node('out')))
    expect(rig.skipped.map((s) => s.row)).toEqual([1, 2])
  })

  it('survives a block the mic does not have, rather than throwing at a listener', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(context, preset([{ effect: 'NONSENSE' }]), asAudio(node('out')))
    expect(rig.skipped[0].why).toContain('no block by that name')
  })

  it('plays an empty chain as plain voice instead of failing', () => {
    const { context, node } = fakeContext()
    const out = node('out')
    const rig = buildRig(context, preset([]), asAudio(out))
    expect(rig.skipped).toEqual([])
    expect(rig.input).toBeDefined()
  })

  it('passes audio down the chain, since that is the direction the mic works in', () => {
    const { context, node } = fakeContext()
    const out = node('out')
    const rig = buildRig(context, preset([blankRow('LOWPASS'), blankRow('HIGHPASS')]), asAudio(out))
    // Walk from the input and check we can reach the destination.
    const seen = new Set<FakeNode>()
    const reaches = (from: FakeNode): boolean => {
      if (from === out) return true
      if (seen.has(from)) return false
      seen.add(from)
      return from.connections.some(reaches)
    }
    expect(reaches(rig.input as unknown as FakeNode)).toBe(true)
  })
})

describe('squeezing the handle while it plays', () => {
  it('moves the parameter the handle is pointed at', () => {
    const { context, node } = fakeContext()
    const row = blankRow('LOWPASS')
    row.cutoff = 0
    const rig = buildRig(
      context,
      preset([row], { handle: { row: 0, param: 'cutoff', depth: 1 } }),
      asAudio(node('out')),
    )
    // The filter is the only node the input feeds, so walk one hop to it.
    const found = (rig.input as unknown as FakeNode).connections[0]
    const before = (found.frequency as { value: number }).value
    rig.setHandle(1)
    expect((found.frequency as { value: number }).value).toBeGreaterThan(before)
  })

  it('does nothing when no handle modulation is set, rather than guessing one', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(context, preset([blankRow('LOWPASS')]), asAudio(node('out')))
    const found = (rig.input as unknown as FakeNode).connections[0]
    const before = (found.frequency as { value: number }).value
    rig.setHandle(1)
    expect((found.frequency as { value: number }).value).toBe(before)
  })

  it('ignores a handle pointed at a row that was skipped', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(
      context,
      preset([blankRow('SSB')], { handle: { row: 0, param: 'frequency', depth: 1 } }),
      asAudio(node('out')),
    )
    expect(() => rig.setHandle(1)).not.toThrow()
  })
})

describe('shaking the mic while it plays', () => {
  const cutoffOf = (rig: { input: unknown }) => {
    const node = (rig.input as unknown as FakeNode).connections[0]
    return (node.frequency as { value: number }).value
  }

  it('moves the parameter the shake is pointed at, not only the handle', () => {
    const { context, node } = fakeContext()
    const row = blankRow('LOWPASS')
    row.cutoff = 0
    const rig = buildRig(
      context,
      preset([row], { shake: { row: 0, param: 'cutoff', depth: 1 } }),
      asAudio(node('out')),
    )
    const before = cutoffOf(rig)
    rig.setShake(1)
    expect(cutoffOf(rig)).toBeGreaterThan(before)
  })

  it('composes with the handle when both are pointed at the same parameter', () => {
    // The device has two movers and nothing says they take turns.
    const { context, node } = fakeContext()
    const row = blankRow('LOWPASS')
    row.cutoff = 0
    const rig = buildRig(
      context,
      preset([row], {
        handle: { row: 0, param: 'cutoff', depth: 0.4 },
        shake: { row: 0, param: 'cutoff', depth: 0.4 },
      }),
      asAudio(node('out')),
    )
    rig.setHandle(1)
    const handleOnly = cutoffOf(rig)
    rig.setShake(1)
    expect(cutoffOf(rig)).toBeGreaterThan(handleOnly)
  })

  it('leaves the handle where it was when the shake is let go', () => {
    // Letting go of one mover must not drag the parameter back to its set
    // value while the other is still held.
    const { context, node } = fakeContext()
    const row = blankRow('LOWPASS')
    row.cutoff = 0
    const rig = buildRig(
      context,
      preset([row], {
        handle: { row: 0, param: 'cutoff', depth: 0.5 },
        shake: { row: 0, param: 'cutoff', depth: 0.5 },
      }),
      asAudio(node('out')),
    )
    rig.setHandle(1)
    const held = cutoffOf(rig)
    rig.setShake(1)
    rig.setShake(0)
    expect(cutoffOf(rig)).toBeCloseTo(held, 5)
  })

  it('does nothing when the preset has no shake, rather than inventing one', () => {
    const { context, node } = fakeContext()
    const rig = buildRig(context, preset([blankRow('LOWPASS')]), asAudio(node('out')))
    const before = cutoffOf(rig)
    rig.setShake(1)
    expect(cutoffOf(rig)).toBe(before)
  })
})
