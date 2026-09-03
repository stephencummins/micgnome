import { describe, expect, it } from 'vitest'
import { stepStatuses } from '../progress'
import { LIBRARY } from '../../packs/library'
import type { Config } from '../../fxmic/types'

const fresh: Config = { name: 'NEW PACK', presets: [{ pos: 0, name: 'DRY', list: [{ effect: 'SAMPLE' }], trigger: { row: 0 } }] }
const off = { written: false, downloaded: false }

describe('guide progress, read off the bench', () => {
  it('starts on step 1 with nothing done and step 4 marked optional', () => {
    expect(stepStatuses(fresh, off)).toEqual(['current', 'todo', 'todo', 'optional', 'todo', 'todo', 'optional'])
  })

  it('loading a library pack ticks the first three steps at once', () => {
    // A pack has a chain and modulation already, so the guide does not nag
    // about things the pack did for you.
    expect(stepStatuses(LIBRARY[0].config, off)).toEqual(['done', 'done', 'done', 'optional', 'current', 'todo', 'optional'])
  })

  it('building your own chain counts as picking a pack, without a library name', () => {
    const own: Config = { name: 'MINE', presets: [{ pos: 0, list: [{ effect: 'SAMPLE' }, { effect: 'REVERB' }], trigger: { row: 0 } }] }
    expect(stepStatuses(own, off).slice(0, 3)).toEqual(['done', 'done', 'current'])
  })

  it('own sounds turn green only when there are some, and never hold up "current"', () => {
    const withWav: Config = { ...LIBRARY[0].config, samples: [{ file: 'a.wav', playmode: 'oneshot' }] }
    expect(stepStatuses(withWav, off)[3]).toBe('done')
    expect(stepStatuses(LIBRARY[0].config, off)[4]).toBe('current')
  })

  it('the last two steps come from the virtual write and the download', () => {
    expect(stepStatuses(LIBRARY[0].config, { written: true, downloaded: false }).slice(4)).toEqual(['done', 'current', 'optional'])
    expect(stepStatuses(LIBRARY[0].config, { written: true, downloaded: true })).not.toContain('current')
  })

  it('sending a pack in is the seventh step, optional, green only once done', () => {
    expect(stepStatuses(LIBRARY[0].config, { written: true, downloaded: true, submitted: true })[6]).toBe('done')
  })
})
