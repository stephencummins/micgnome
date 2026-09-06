import { describe, expect, it } from 'vitest'
import { cautions, dryRun } from '../apply'
import { blankConfig } from '../../fxmic/serialize'
import { LIMITS } from '../../fxmic/spec'
import { packById } from '../../packs/library'
import type { BenchState } from '../../bench/state'
import type { ProposedAction } from '../protocol'

const start = (): BenchState => ({
  config: { ...blankConfig('TEST PACK'), presets: [{ pos: 0, name: 'ONE', list: [{ effect: 'SAMPLE' }], trigger: { row: 0 } }] },
  selected: 0,
  handle: 0,
  dirty: false,
})

// This is the file that keeps the promise the product is built on: whatever the
// model proposes, nothing that would stop a mic booting can reach the bench.

describe('trying a proposal before anyone sees it', () => {
  it('accepts a sensible edit and says what it would do, in the person\'s words', () => {
    const run = dryRun(start(), [{ type: 'add-row', effect: 'REVERB' }])
    expect(run.ok).toBe(true)
    expect(run.summary[0]).toContain('Add')
    // The blurb comes from the spec, so the card explains the block without a
    // second source of copy to keep in step.
    expect(run.summary[0].length).toBeGreaterThan('Add'.length)
  })

  it('never alters the state it was given, so a refusal costs the person nothing', () => {
    const before = start()
    const snapshot = JSON.stringify(before)
    dryRun(before, [{ type: 'add-row', effect: 'DIST' }, { type: 'remove-row', row: 0 }])
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('applies actions in order, so a row added first can be tuned by the next action', () => {
    const run = dryRun(start(), [
      { type: 'add-row', effect: 'LOWPASS' },
      { type: 'set-param', row: 1, param: 'cutoff', value: 0.3 },
    ])
    expect(run.ok).toBe(true)
    expect(run.next.config.presets[0].list[1]).toMatchObject({ effect: 'LOWPASS', cutoff: 0.3 })
  })

  it('refuses a proposal the validator would reject, and explains itself to the model', () => {
    // Removing the only SAMPLE row leaves a trigger pointing at nothing.
    const run = dryRun(start(), [{ type: 'load', config: { name: 'X', presets: [{ list: [], trigger: { row: 4 } }] } }])
    expect(run.ok).toBe(false)
    expect(run.refusal).toBeTruthy()
    expect(run.refusal).toContain('Propose something different')
  })

  it('refuses a whole pack that is not a valid config, however confidently it was offered', () => {
    const run = dryRun(start(), [
      { type: 'load', config: { name: 'BAD', presets: [{ list: [{ effect: 'NOT_A_BLOCK' }] }] } } as ProposedAction,
    ])
    expect(run.ok).toBe(false)
  })

  it('passes a real library pack, because the gate must not refuse our own work', () => {
    const pack = packById('ko-lo-fi')
    expect(pack).toBeDefined()
    const run = dryRun(start(), [{ type: 'load', config: pack!.config }])
    expect(run.ok).toBe(true)
    expect(run.report.diagnostics).toEqual([])
  })

  it('warns rather than refuses when a chain runs past what the firmware reads', () => {
    // The ceiling is a player's reading of the firmware, not the guide, so a long
    // chain is a caution on the card — never a refusal.
    const actions: ProposedAction[] = Array.from({ length: LIMITS.maxRowsPerPreset + 2 }, () => ({
      type: 'add-row' as const,
      effect: 'DIST',
    }))
    const run = dryRun(start(), actions)
    expect(run.ok).toBe(true)
    expect(cautions(run).join(' ')).toContain(String(LIMITS.maxRowsPerPreset))
  })
})

describe('the summary shown on the confirm card', () => {
  it('names the block being removed, not the row number, because numbers mean nothing here', () => {
    const state = start()
    state.config.presets[0].list = [{ effect: 'REVERB' }, { effect: 'SAMPLE' }]
    const run = dryRun(state, [{ type: 'remove-row', row: 0 }])
    expect(run.summary[0]).toContain('reverb')
  })

  it('says a parameter is being left alone rather than showing "undefined"', () => {
    const run = dryRun(start(), [{ type: 'set-param', row: 0, param: 'mix', value: undefined }])
    expect(run.summary[0]).toContain("mic's own setting")
  })

  it('has one line for every action, so nothing is applied unannounced', () => {
    const actions: ProposedAction[] = [
      { type: 'set-pack-name', name: 'RADIO' },
      { type: 'add-row', effect: 'LOWPASS' },
      { type: 'add-row', effect: 'DIST' },
    ]
    const run = dryRun(start(), actions)
    expect(run.summary).toHaveLength(actions.length)
  })
})
