import { describe, expect, it } from 'vitest'
import { blankConfig } from '../../fxmic/serialize'
import type { Config } from '../../fxmic/types'
import { ART_RULES, packArt } from '../art'

const pack = (...chains: string[][]): Config => ({
  name: 'TEST',
  presets: chains.map((c, i) => ({ pos: i, name: `P${i}`, list: c.map((effect) => ({ effect })) })),
})

describe('the wallpaper art', () => {
  it('is 16 by 16, with a rule from the chaotic set', () => {
    const art = packArt(pack(['LOWPASS', 'DELAY', 'SAMPLE']))
    expect(art.cells).toHaveLength(16)
    for (const r of art.cells) expect(r).toHaveLength(16)
    expect(ART_RULES).toContain(art.rule)
  })

  it('seeds its first row from the chains, four columns a preset, in family colours', () => {
    const art = packArt(pack(['LOWPASS', 'SAMPLE'], ['DIST', 'HARMONY', 'REVERB', 'SAMPLE']))
    expect(art.own.slice(0, 8)).toEqual(['filter', 'ink', null, null, 'drive', 'pitch', 'space', 'ink'])
    expect(art.cells[0].slice(0, 8)).toEqual([1, 1, 0, 0, 1, 1, 1, 1])
    expect(art.own.slice(8).every((t) => t === null)).toBe(true)
  })

  it('keeps the first and last block of a long chain', () => {
    const art = packArt(pack(['RING', 'LOWPASS', 'DELAY', 'HARMONY', 'REVERB', 'SAMPLE']))
    expect(art.own[0]).toBe('drive')
    expect(art.own[3]).toBe('ink')
  })

  it('grows each row from the one above by the rule, wrapping at the edges', () => {
    const { cells, rule } = packArt(pack(['LOWPASS', 'DELAY'], ['SAMPLE']))
    for (let y = 1; y < 16; y++) {
      const p = cells[y - 1]
      for (let x = 0; x < 16; x++) {
        const n = (p[(x + 15) % 16] << 2) | (p[x] << 1) | p[(x + 1) % 16]
        expect(cells[y][x]).toBe((rule >> n) & 1)
      }
    }
  })

  it('is the same picture for the same chains, whatever the knobs say', () => {
    const a = pack(['LOWPASS', 'SAMPLE'])
    const b: Config = { ...a, name: 'RENAMED', presets: [{ ...a.presets[0], list: [{ effect: 'LOWPASS', cutoff: 0.2 }, { effect: 'SAMPLE' }] }] }
    expect(packArt(b)).toEqual(packArt(a))
  })

  it('changes when a block is added', () => {
    expect(packArt(pack(['LOWPASS', 'SAMPLE']))).not.toEqual(packArt(pack(['LOWPASS', 'DELAY', 'SAMPLE'])))
  })

  it('draws something and puts the spark on a drawn cell, even for a blank pack', () => {
    const art = packArt(blankConfig())
    expect(art.spark).not.toBeNull()
    const [x, y] = art.spark!
    expect(art.cells[y][x]).toBe(1)
  })
})
