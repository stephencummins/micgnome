import { describe, expect, it } from 'vitest'
import { reduce, type BenchState } from '../state'
import type { Config } from '../../fxmic/types'
import { validate } from '../../fxmic/validate'

const config: Config = {
  name: 'T',
  presets: [
    {
      pos: 0,
      list: [{ effect: 'DIST', amount: 10 }, { effect: 'LOWPASS', cutoff: 0.2 }, { effect: 'SAMPLE' }],
      handle: { row: 1, param: 'cutoff', depth: 0.8 },
      shake: { row: 0, param: 'mix', depth: 0.5 },
      trigger: { row: 2 },
    },
  ],
}
const start: BenchState = { config, selected: 0, handle: 0 }
const preset = (s: BenchState) => s.config.presets[0]

describe('editing a chain keeps every reference honest', () => {
  it('follows the effect when a row moves up', () => {
    // handle points at LOWPASS (row 1). Move LOWPASS to the top; it must follow.
    const next = reduce(start, { type: 'move-row', from: 1, to: 0 })
    expect(preset(next).list.map((r) => r.effect)).toEqual(['LOWPASS', 'DIST', 'SAMPLE'])
    expect(preset(next).handle?.row).toBe(0)
    expect(preset(next).shake?.row).toBe(1)
    expect(preset(next).trigger?.row).toBe(2)
    expect(validate(next.config).ok).toBe(true)
  })

  it('follows the effect when a row moves down', () => {
    const next = reduce(start, { type: 'move-row', from: 0, to: 2 })
    expect(preset(next).list.map((r) => r.effect)).toEqual(['LOWPASS', 'SAMPLE', 'DIST'])
    expect(preset(next).handle?.row).toBe(0)
    expect(preset(next).shake?.row).toBe(2)
    expect(preset(next).trigger?.row).toBe(1)
    expect(validate(next.config).ok).toBe(true)
  })

  it('drops modulation of a deleted row rather than repointing it', () => {
    // A wrong target is worse than an absent one.
    const next = reduce(start, { type: 'remove-row', row: 1 })
    expect(preset(next).handle).toBeUndefined()
    expect(preset(next).shake?.row).toBe(0)
    expect(preset(next).trigger?.row).toBe(1)
    expect(validate(next.config).ok).toBe(true)
  })

  it('drops the trigger when its SAMPLE row is deleted', () => {
    const next = reduce(start, { type: 'remove-row', row: 2 })
    expect(preset(next).trigger).toBeUndefined()
    expect(validate(next.config).ok).toBe(true)
  })

  it('never leaves a config the validator would reject', () => {
    for (const action of [
      { type: 'remove-row', row: 0 },
      { type: 'remove-row', row: 1 },
      { type: 'remove-row', row: 2 },
      { type: 'move-row', from: 2, to: 0 },
      { type: 'move-row', from: 1, to: 2 },
      { type: 'add-row', effect: 'REVERB' },
    ] as const) {
      const next = reduce(start, action)
      const errors = validate(next.config).diagnostics.filter((d) => d.severity === 'error')
      expect(errors, JSON.stringify(action)).toEqual([])
    }
  })
})

describe('parameters', () => {
  it('unsets a parameter rather than writing a zero', () => {
    const next = reduce(start, { type: 'set-param', row: 0, param: 'amount', value: undefined })
    expect('amount' in preset(next).list[0]).toBe(false)
  })

  it('writes the value the user chose', () => {
    const next = reduce(start, { type: 'set-param', row: 0, param: 'amount', value: 22.5 })
    expect(preset(next).list[0].amount).toBe(22.5)
  })
})

describe('presets', () => {
  it('gives a new preset the next free slot', () => {
    const next = reduce(start, { type: 'add-preset' })
    expect(next.config.presets[1].pos).toBe(1)
    expect(next.selected).toBe(1)
  })

  it('refuses a fifth preset, because the orange button has four slots', () => {
    let s = start
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'add-preset' })
    expect(s.config.presets).toHaveLength(4)
    expect(validate(s.config).ok).toBe(true)
  })

  it('keeps the selection in range when a preset is removed', () => {
    let s = reduce(start, { type: 'add-preset' })
    s = reduce(s, { type: 'remove-preset', index: 1 })
    expect(s.selected).toBe(0)
  })

  it('gives a first SAMPLE row the trigger automatically', () => {
    const bare: BenchState = { config: { name: 'B', presets: [{ list: [] }] }, selected: 0, handle: 0 }
    const next = reduce(bare, { type: 'add-row', effect: 'SAMPLE' })
    expect(preset(next).trigger?.row).toBe(0)
  })
})
