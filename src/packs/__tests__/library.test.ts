/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { LIBRARY } from '../library'
import { SIGIL_IDS, hasSigil } from '../../bench/Sigil'
import { parseConfig } from '../../fxmic/parse'
import { modulationCurve, serialize } from '../../fxmic/serialize'
import { EFFECTS, LIMITS, effectByName } from '../../fxmic/spec'
import { validate } from '../../fxmic/validate'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC = join(__dirname, '../../../public')
const HEARD_ON_HARDWARE = ['quiz-night']

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

  it('carries no samples unless it brings its own sounds, so it redistributes nothing', () => {
    if (pack.sounds) {
      // Every wav it names is served, and all of it fits the mic with the config.
      const dir = join(PUBLIC, pack.sounds)
      const files = (pack.config.samples ?? []).map((s) => join(dir, s.file))
      for (const f of files) expect(existsSync(f), f).toBe(true)
      const total = files.reduce((n, f) => n + statSync(f).size, 0) + serialize(pack.config).length
      expect(total).toBeLessThan(LIMITS.storageBytes)
      return
    }
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

  it('fills the slots on the orange button in order, all four unless its sounds are the point', () => {
    // QUIZ NIGHT keeps the two presets it was heard with on a mic rather than
    // gain two that nobody has played.
    const positions = pack.config.presets.map((p) => p.pos)
    expect(positions).toEqual(pack.sounds ? positions.map((_, i) => i) : [0, 1, 2, 3])
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

  it('says what it is, and claims hardware only where it was actually heard', () => {
    expect(pack.after).toBeTruthy()
    expect(pack.blurb.length).toBeGreaterThan(40)
    expect(pack.handle).toBeTruthy()
    // Heard: QUIZ NIGHT, fx-mic firmware 1.1.2, 27 Sep 2026. Add to this list
    // only with a recording to point at.
    expect(pack.verified).toBe(HEARD_ON_HARDWARE.includes(pack.id))
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
  it('gives every pack a sigil', () => {
    // A fifth pack without one would ship a card that just looks broken.
    const missing = LIBRARY.filter((p) => !hasSigil(p.id)).map((p) => p.id)
    expect(missing, `no sigil drawn for: ${missing.join(', ')}`).toEqual([])
    expect(SIGIL_IDS.filter((id) => !LIBRARY.some((p) => p.id === id))).toEqual([])
  })

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

  it('puts something on a bus, so the last line of the config format is heard too', () => {
    const rows = LIBRARY.flatMap((p) => p.config.presets.flatMap((preset) => preset.list))
    const buses = new Set(rows.map((r) => r.BUS).filter((b): b is number => b !== undefined))
    expect([...buses].sort()).toEqual([...LIMITS.busValues])
  })

  it('keeps Y CABLE\u2019s sends wet-only, because that is what a send is', () => {
    // This used to be asserted over the whole library, on the reading that a
    // bus is a copy and a copy is wet only. DUAL MONO came off a working mic
    // and its bus rows carry dry — a bare pan on one bus, dry-level 1.0 on the
    // next — so the rule was never the format's, only the send convention
    // Y CABLE is built on. It stays here, where it is the point of the pack.
    const rows = LIBRARY.find((p) => p.id === 'y-cable')!.config.presets.flatMap((p) => p.list)
    for (const r of rows) {
      if (r.BUS === undefined) continue
      const dry = r['dry-level'] ?? (r.mix === undefined ? undefined : 1 - (r.mix as number))
      expect(dry, `${r.effect} on bus ${r.BUS} carries dry`).toBe(0)
    }
  })

  it('needs no wav to work, except the one pack that brings its own', () => {
    for (const pack of LIBRARY) if (!pack.sounds) expect(pack.config.samples).toBeUndefined()
    expect(LIBRARY.filter((p) => p.sounds).map((p) => p.id)).toEqual(['quiz-night'])
  })
})
