/**
 * Writes config.json the way the guide writes it: fields in the order the
 * manual introduces them, effect parameters in the order the spec table lists
 * them, two-space indent.
 *
 * The rule that matters: we only write what is actually set. The guide
 * publishes ranges but not device defaults, so emitting a "default" we invented
 * would change how somebody's mic sounds. An untouched parameter stays absent.
 */
import { EFFECTS, effectByName } from './spec'
import type { Config, EffectRow, Modulation, Preset, SampleRef } from './types'

const PRESET_ORDER = ['pos', 'name', 'comment', 'list', 'handle', 'shake', 'lfo', 'trigger'] as const
const SAMPLE_ORDER = ['pos', 'file', 'playmode'] as const
const MOD_ORDER = ['row', 'target', 'param', 'depth', 'shape', 'speed', 'phase'] as const

export function serialize(config: Config): string {
  const out: Record<string, unknown> = {}
  if (config.name !== undefined) out.name = config.name
  if (config.samples !== undefined) out.samples = config.samples.map(orderSample)
  out.presets = (config.presets ?? []).map(orderPreset)
  return JSON.stringify(out, null, 2) + '\n'
}

function orderSample(sample: SampleRef): Record<string, unknown> {
  return pick(sample as unknown as Record<string, unknown>, SAMPLE_ORDER)
}

function orderPreset(preset: Preset): Record<string, unknown> {
  const out = pick(preset as unknown as Record<string, unknown>, PRESET_ORDER)
  if (Array.isArray(out.list)) out.list = (out.list as EffectRow[]).map(orderRow)
  for (const key of ['handle', 'shake', 'lfo'] as const) {
    if (out[key]) out[key] = pick(out[key] as Record<string, unknown>, MOD_ORDER)
  }
  return out
}

function orderRow(row: EffectRow): Record<string, unknown> {
  const out: Record<string, unknown> = { effect: row.effect }
  const spec = effectByName(row.effect)
  const ordered = spec ? spec.params.map((p) => p.name) : []

  for (const name of ordered) {
    if (row[name] !== undefined) out[name] = row[name]
  }
  // Anything we do not recognise is preserved verbatim rather than dropped —
  // a config from newer firmware must survive a round trip through the editor.
  for (const [key, value] of Object.entries(row)) {
    if (key === 'effect' || key === 'BUS' || ordered.includes(key)) continue
    if (value !== undefined) out[key] = value
  }
  if (row.BUS !== undefined) out.BUS = row.BUS
  return out
}

function pick<T extends Record<string, unknown>>(obj: T, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of order) {
    if (obj?.[key] !== undefined) out[key] = obj[key]
  }
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (!order.includes(key) && value !== undefined) out[key] = value
  }
  return out
}

/** A minimal, valid starting point — the smallest config the mic will accept. */
export function blankConfig(name = 'NEW PACK'): Config {
  return {
    name,
    presets: [{ pos: 0, name: 'DRY', list: [{ effect: 'SAMPLE' }], trigger: { row: 0 } }],
  }
}

export function blankRow(effectName: string): EffectRow {
  const spec = EFFECTS.find((e) => e.name === effectName)
  if (!spec) throw new Error(`Unknown effect: ${effectName}`)
  // Start values are written only once the user changes one; see the note above.
  return { effect: spec.name }
}

/**
 * Where a modulated parameter lands at a given handle position, and whether it
 * runs out of travel before the handle does. This is the handle map.
 */
export function modulationCurve(
  base: number,
  mod: Modulation,
  min: number,
  max: number,
): { at: (position: number) => number; clipsAt?: number } {
  const depth = mod.depth ?? 0
  const at = (position: number) => clamp(base + depth * position, min, max)
  if (depth === 0) return { at }
  const limit = depth > 0 ? max : min
  const position = (limit - base) / depth
  return { at, clipsAt: position > 0 && position < 1 ? position : undefined }
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
