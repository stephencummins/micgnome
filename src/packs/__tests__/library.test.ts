import { describe, expect, it } from 'vitest'
import { LIBRARY } from '../library'
import { parseConfig } from '../../fxmic/parse'
import { modulationCurve, serialize } from '../../fxmic/serialize'
import { EFFECTS, LIMITS, effectByName } from '../../fxmic/spec'
import { validate } from '../../fxmic/validate'

describe.each(LIBRARY.map((p) => [p.name, p] as const))('%s', (_name, pack) => {
  it('is clean — no errors and no warnings', () => {
    // A shipped pack is the example everyone copies. It has to be exemplary,
    // not merely legal.
    const report = validate(pack.config)
    expect(report.diagnostics).toEqual([])
  })

  it('survives a round trip through the file it will actually be', () => {
    const parsed = parseConfig(serialize(pack.config))
    expect(parsed.repairs).toEqual([])
    expect(parsed.value).toEqual(pack.config)
    expect(validate(parsed.value).ok).toBe(true)
  })

  it('carries no samples, so it uses the factory sounds and redistributes nothing', () => {
    expect(pack.config.samples).toBeUndefined()
    expect(serialize(pack.config)).not.toContain('.wav')
  })

  it('is small enough to share as a link', async () => {
    const raw = new TextEncoder().encode(serialize(pack.config)).byteLength
    // Against the device's 1 mb, a pack this size is a rounding error — it can
    // never be the reason a pack does not fit.
    expect(raw).toBeLessThan(LIMITS.storageBytes / 100)
    // And the claim that actually needs checking: compressed and base64'd it
    // fits inside the ~2000 characters a url can carry everywhere.
    const packed = await urlSafe(serialize(pack.config))
    expect(packed.length, `${packed.length} chars`).toBeLessThan(2000)
  })

  it('fills the four slots on the orange button, one each', () => {
    const positions = pack.config.presets.map((p) => p.pos)
    expect(positions).toEqual([0, 1, 2, 3])
  })

  it('gives every preset a SAMPLE row and a trigger, or the sample button is dead', () => {
    for (const preset of pack.config.presets) {
      const sampleRow = preset.list.findIndex((r) => r.effect === 'SAMPLE')
      expect(sampleRow, preset.name).toBeGreaterThanOrEqual(0)
      expect(preset.trigger?.row, preset.name).toBe(sampleRow)
    }
  })

  it('does not waste the handle', () => {
    // The whole point of the handle map: a depth that hits the rail early
    // leaves the rest of the squeeze doing nothing. No shipped pack should.
    for (const preset of pack.config.presets) {
      const mod = preset.handle
      if (!mod || mod.row === undefined || !mod.param) continue
      const row = preset.list[mod.row]
      const param = effectByName(row.effect)!.params.find((p) => p.name === mod.param)!
      const base = typeof row[mod.param] === 'number' ? (row[mod.param] as number) : param.start
      const { clipsAt } = modulationCurve(base, mod, param.min, param.max)
      expect(clipsAt === undefined || clipsAt > 0.9, `${preset.name}: clips at ${clipsAt}`).toBe(true)
    }
  })

  it('says what it is and admits it has not been heard on hardware', () => {
    expect(pack.after).toBeTruthy()
    expect(pack.blurb.length).toBeGreaterThan(40)
    expect(pack.handle).toBeTruthy()
    expect(pack.verified).toBe(false)
  })
})

/** Web-standard compression, so the same code could run in the browser later. */
async function urlSafe(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('the library as a whole', () => {
  it('has unique ids and names', () => {
    expect(new Set(LIBRARY.map((p) => p.id)).size).toBe(LIBRARY.length)
    expect(new Set(LIBRARY.map((p) => p.name)).size).toBe(LIBRARY.length)
  })

  it('between them, exercises every block on the mic', () => {
    // The library is how someone learns what these ten things do. If a block
    // appears nowhere, nobody ever hears it.
    const used = new Set(
      LIBRARY.flatMap((p) => p.config.presets.flatMap((preset) => preset.list.map((r) => r.effect))),
    )
    const missing = EFFECTS.map((e) => e.name).filter((name) => !used.has(name))
    expect(missing, `never demonstrated: ${missing.join(', ')}`).toEqual([])
  })

  it('uses both modulation sources the handle is not', () => {
    const presets = LIBRARY.flatMap((p) => p.config.presets)
    expect(presets.some((p) => p.shake)).toBe(true)
    expect(presets.some((p) => p.lfo)).toBe(true)
    expect(presets.some((p) => p.handle?.target === 'lfo')).toBe(true)
  })

  it('shows all four lfo shapes somewhere', () => {
    const shapes = new Set(
      LIBRARY.flatMap((p) => p.config.presets.map((preset) => preset.lfo?.shape)).filter(Boolean),
    )
    expect([...shapes].sort()).toEqual(['random', 'sawtooth', 'sine', 'square'])
  })

  it('uses every playmode-free path — no pack needs a wav to work', () => {
    for (const pack of LIBRARY) expect(pack.config.samples).toBeUndefined()
  })
})
