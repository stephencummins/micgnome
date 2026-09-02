import { describe, expect, it } from 'vitest'
import { createHistoryReducer, initialHistory, HISTORY_LIMIT } from '../history'
import type { BenchState } from '../state'
import type { Config } from '../../fxmic/types'

const config: Config = {
  name: 'T',
  presets: [{ pos: 0, list: [{ effect: 'LOWPASS', cutoff: 0.5 }, { effect: 'SAMPLE' }], trigger: { row: 1 } }],
}
const start: BenchState = { config, selected: 0, handle: 0, dirty: false }

function clock() {
  let t = 0
  return { now: () => t, tick: (ms: number) => (t += ms) }
}

describe('undo and redo', () => {
  it('takes an edit back and puts it forward again', () => {
    const { now } = clock()
    const reduce = createHistoryReducer(now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'add-row', effect: 'DELAY' })
    expect(s.present.config.presets[0].list).toHaveLength(3)
    s = reduce(s, { type: 'undo' })
    expect(s.present.config.presets[0].list).toHaveLength(2)
    expect(s.present.config).toBe(config)
    s = reduce(s, { type: 'redo' })
    expect(s.present.config.presets[0].list).toHaveLength(3)
  })

  it('folds a slider drag into one step', () => {
    const { now, tick } = clock()
    const reduce = createHistoryReducer(now)
    let s = initialHistory(start)
    for (const v of [0.4, 0.3, 0.2, 0.1]) {
      tick(50)
      s = reduce(s, { type: 'set-param', row: 0, param: 'cutoff', value: v })
    }
    expect(s.past).toHaveLength(1)
    s = reduce(s, { type: 'undo' })
    expect(s.present.config.presets[0].list[0].cutoff).toBe(0.5)
  })

  it('does not fold once the drag has paused', () => {
    const { now, tick } = clock()
    const reduce = createHistoryReducer(now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'set-param', row: 0, param: 'cutoff', value: 0.4 })
    tick(2000)
    s = reduce(s, { type: 'set-param', row: 0, param: 'cutoff', value: 0.3 })
    expect(s.past).toHaveLength(2)
  })

  it('does not fold edits to different parameters', () => {
    const { now } = clock()
    const reduce = createHistoryReducer(now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'set-param', row: 0, param: 'cutoff', value: 0.4 })
    s = reduce(s, { type: 'set-param', row: 1, param: 'level', value: 0.4 })
    expect(s.past).toHaveLength(2)
  })

  it('ignores selection and the handle', () => {
    const reduce = createHistoryReducer(clock().now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'set-handle', value: 0.7 })
    s = reduce(s, { type: 'select', index: 0 })
    expect(s.past).toHaveLength(0)
    expect(s.present.handle).toBe(0.7)
  })

  it('a new edit clears the redo stack', () => {
    const reduce = createHistoryReducer(clock().now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'add-row', effect: 'DELAY' })
    s = reduce(s, { type: 'undo' })
    expect(s.future).toHaveLength(1)
    s = reduce(s, { type: 'add-row', effect: 'REVERB' })
    expect(s.future).toHaveLength(0)
  })

  it('undoing a library load brings the old bench back', () => {
    const reduce = createHistoryReducer(clock().now)
    let s = initialHistory(start)
    s = reduce(s, { type: 'load', config: { name: 'OTHER', presets: [] } })
    expect(s.present.config.name).toBe('OTHER')
    s = reduce(s, { type: 'undo' })
    expect(s.present.config.name).toBe('T')
  })

  it('does nothing when there is nothing to undo', () => {
    const reduce = createHistoryReducer(clock().now)
    const s = initialHistory(start)
    expect(reduce(s, { type: 'undo' })).toBe(s)
    expect(reduce(s, { type: 'redo' })).toBe(s)
  })

  it('keeps only the last hundred steps', () => {
    const { now, tick } = clock()
    const reduce = createHistoryReducer(now)
    let s = initialHistory(start)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      tick(5000)
      s = reduce(s, { type: 'set-pack-name', name: `N${i}` })
    }
    expect(s.past).toHaveLength(HISTORY_LIMIT)
  })
})
