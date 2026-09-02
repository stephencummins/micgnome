import { describe, expect, it } from 'vitest'
import { validate } from '../validate'
import { parseConfig } from '../parse'
import { serialize } from '../serialize'
import { errors, warnings } from '../diagnostics'

const codes = (r: ReturnType<typeof validate>) => r.diagnostics.map((d) => d.code)

/**
 * The guide's own worked example, from chapter 7.11. If our validator ever
 * rejects Teenage Engineering's documented preset, the validator is wrong.
 */
const GUIDE_EXAMPLE = {
  name: 'BAD RECEPTION PACK',
  presets: [
    {
      pos: 0,
      name: 'BAD RECEPTION',
      comment: 'static noise that clears up when handle is pushed',
      list: [
        { effect: 'DIST', amount: 10.0, mix: 0.5 },
        { effect: 'LOWPASS', cutoff: 0.2 },
        { effect: 'SAMPLE' },
      ],
      handle: { row: 1, param: 'cutoff', depth: 0.8 },
      shake: { row: 0, param: 'mix', depth: 0.5 },
      trigger: { row: 2 },
    },
  ],
}

describe('the guide’s own example', () => {
  it('passes with no errors and no warnings', () => {
    const report = validate(GUIDE_EXAMPLE)
    expect(report.diagnostics).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('survives a round trip through the serializer', () => {
    const again = JSON.parse(serialize(GUIDE_EXAMPLE))
    expect(validate(again).ok).toBe(true)
    expect(again).toEqual(GUIDE_EXAMPLE)
  })
})

describe('the configs that stop the mic booting', () => {
  it('catches a trailing comma before a closing bracket', () => {
    const broken = '{ "name": "X", "presets": [ { "list": [ { "effect": "SAMPLE" }, ] } ] }'
    const result = parseConfig(broken)
    // Opened for editing, but the repair is reported rather than hidden.
    expect(result.value).toBeDefined()
    expect(result.repairs.map((r) => r.kind)).toContain('trailing-comma')
  })

  it('catches a missing comma between entries', () => {
    const broken = `{
  "presets": [
    { "list": [ { "effect": "SAMPLE" } ] }
    { "list": [ { "effect": "SAMPLE" } ] }
  ]
}`
    const result = parseConfig(broken)
    expect(result.value).toBeDefined()
    expect(result.repairs.map((r) => r.kind)).toContain('missing-comma')
  })

  it('reports the line when a file is past repairing', () => {
    const result = parseConfig('{ "presets": [ { "list": [ }}}')
    expect(result.value).toBeUndefined()
    expect(result.diagnostics[0].code).toBe('json-broken')
    expect(result.diagnostics[0].message).toMatch(/line \d+/)
  })

  it('never corrupts a comma inside a string', () => {
    const text = '{ "name": "a, b, c", "presets": [] }'
    const result = parseConfig(text)
    expect((result.value as { name: string }).name).toBe('a, b, c')
  })

  it('rejects lowercase effect names, which the guide forbids', () => {
    const report = validate({ presets: [{ list: [{ effect: 'dist', amount: 5 }] }] })
    expect(codes(report)).toContain('effect-case')
    expect(report.ok).toBe(false)
    expect(errors(report)[0].fix).toContain('DIST')
  })

  it('rejects an effect that does not exist, and suggests the near miss', () => {
    const report = validate({ presets: [{ list: [{ effect: 'REVERV' }] }] })
    const d = errors(report).find((x) => x.code === 'unknown-effect')!
    expect(d.fix).toContain('REVERB')
  })

  it('rejects a value outside the published range', () => {
    const report = validate({ presets: [{ list: [{ effect: 'DIST', amount: 80 }] }] })
    const d = errors(report).find((x) => x.code === 'param-out-of-range')!
    expect(d.message).toContain('0 to 40')
    expect(d.fix).toContain('40')
  })

  it('allows delay time up to 1.1, which is the one range that is not 0-1', () => {
    expect(validate({ presets: [{ list: [{ effect: 'DELAY', time: 1.1 }, { effect: 'SAMPLE' }] }] }).ok).toBe(true)
    expect(validate({ presets: [{ list: [{ effect: 'DELAY', time: 1.2 }, { effect: 'SAMPLE' }] }] }).ok).toBe(false)
  })

  it('rejects an effect the guide marks use-once appearing twice', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'REVERB' }, { effect: 'DIST' }, { effect: 'REVERB' }] }],
    })
    expect(codes(report)).toContain('once-per-chain')
  })

  it('rejects modulation pointing at a row that does not exist', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'SAMPLE' }], handle: { row: 3, param: 'level', depth: 1 } }],
    })
    const d = errors(report).find((x) => x.code === 'mod-row-out-of-range')!
    expect(d.message).toContain('the chain has 1 row')
  })

  it('rejects modulation of a parameter the target effect does not have', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'LOWPASS' }, { effect: 'SAMPLE' }], handle: { row: 0, param: 'mix', depth: 1 } }],
    })
    const d = errors(report).find((x) => x.code === 'mod-param-missing')!
    expect(d.message).toContain('LOWPASS')
    expect(d.fix).toContain('cutoff')
  })

  it('rejects a trigger pointing anywhere but a SAMPLE row', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'DIST' }, { effect: 'SAMPLE' }], trigger: { row: 0 } }],
    })
    const d = errors(report).find((x) => x.code === 'trigger-not-sample')!
    expect(d.fix).toContain('1')
  })

  it('rejects two presets claiming the same slot', () => {
    const report = validate({
      presets: [
        { pos: 1, list: [{ effect: 'SAMPLE' }] },
        { pos: 1, list: [{ effect: 'SAMPLE' }] },
      ],
    })
    expect(codes(report)).toContain('pos-duplicate')
  })

  it('rejects more presets than the orange button has slots', () => {
    const one = { list: [{ effect: 'SAMPLE' }] }
    const report = validate({ presets: [one, one, one, one, one] })
    expect(codes(report)).toContain('too-many-presets')
  })

  it('rejects an LFO shape that is not one of the four', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'SAMPLE' }], lfo: { row: 0, param: 'pitch', shape: 'triangle', speed: 2 } }],
    })
    const d = errors(report).find((x) => x.code === 'bad-lfo-shape')!
    expect(d.fix).toContain('sawtooth')
  })

  it('rejects handle-controls-lfo when there is no lfo to control', () => {
    const report = validate({
      presets: [{ list: [{ effect: 'SAMPLE' }], handle: { target: 'lfo', param: 'speed', depth: 15 } }],
    })
    expect(codes(report)).toContain('target-lfo-missing')
  })

  it('rejects a pack that does not fit in 1 mb', () => {
    const report = validate(
      { presets: [{ list: [{ effect: 'SAMPLE' }] }], samples: [{ file: 'a.wav', playmode: 'oneshot' }] },
      { files: [{ name: 'a.wav', bytes: 1_200_000 }] },
    )
    const d = errors(report).find((x) => x.code === 'over-budget')!
    expect(d.fix).toMatch(/free up/i)
  })

  it('rejects a sample the disk does not have', () => {
    const report = validate(
      { presets: [{ list: [{ effect: 'SAMPLE' }] }], samples: [{ file: 'gull.wav', playmode: 'oneshot' }] },
      { files: [{ name: 'horn.wav', bytes: 1000 }] },
    )
    expect(codes(report)).toContain('sample-missing')
  })
})

describe('warnings, where the guide is silent', () => {
  it('warns but does not block on an undocumented BUS value', () => {
    const report = validate({ name: 'X', presets: [{ list: [{ effect: 'SAMPLE', BUS: 3 }], trigger: { row: 0 } }] })
    expect(warnings(report).map((d) => d.code)).toContain('bad-bus')
    expect(report.ok).toBe(true)
  })

  it('warns but does not block on an unknown key', () => {
    const report = validate({ name: 'X', presets: [{ list: [{ effect: 'SAMPLE' }], trigger: { row: 0 }, colour: 'red' }] })
    expect(warnings(report).map((d) => d.code)).toContain('unknown-key')
    expect(report.ok).toBe(true)
  })

  it('warns when a preset has a SAMPLE row but no trigger', () => {
    const report = validate({ name: 'X', presets: [{ list: [{ effect: 'SAMPLE' }] }] })
    expect(warnings(report).map((d) => d.code)).toContain('no-trigger')
    expect(report.ok).toBe(true)
  })

  it('warns when a preset can never make a sample sound', () => {
    const report = validate({ name: 'X', presets: [{ list: [{ effect: 'DIST', amount: 5 }] }] })
    expect(warnings(report).map((d) => d.code)).toContain('no-sample-row')
    expect(report.ok).toBe(true)
  })
})

describe('the shape of the report', () => {
  it('says what is wrong and how to fix it, with a path to jump to', () => {
    const report = validate({ presets: [{ list: [{ effect: 'DIST', amount: 99 }] }] })
    const d = errors(report).find((x) => x.code === 'param-out-of-range')!
    expect(d.path).toBe('presets[0].list[0].amount')
    expect(d.fix).toBeTruthy()
  })

  it('refuses a config that is not an object at all', () => {
    expect(validate([]).ok).toBe(false)
    expect(validate('nope').ok).toBe(false)
    expect(validate(null).ok).toBe(false)
  })
})
