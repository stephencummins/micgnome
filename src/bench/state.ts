/**
 * Bench state. One reducer over the pack, because every edit is a small,
 * describable change to a config that must stay serialisable at all times —
 * there is no "half-edited" representation that could reach the device.
 */
import { blankRow } from '../fxmic/serialize'
import { effectByName } from '../fxmic/spec'
import type { Playmode } from '../fxmic/spec'
import type { Config, EffectRow, Modulation, Preset, SampleRef } from '../fxmic/types'

export type ModKind = 'handle' | 'shake' | 'lfo'

export interface BenchState {
  config: Config
  /** Index into config.presets, not the device slot. */
  selected: number
  /** Handle position, 0 to 1, for the preview and the handle map. */
  handle: number
  /** True once the pack has been edited, so loading a library pack can warn. */
  dirty: boolean
}

export type Action =
  | { type: 'set-pack-name'; name: string }
  | { type: 'select'; index: number }
  | { type: 'set-handle'; value: number }
  | { type: 'add-preset' }
  | { type: 'remove-preset'; index: number }
  | { type: 'set-preset-field'; field: 'name' | 'comment'; value: string }
  | { type: 'add-row'; effect: string }
  | { type: 'remove-row'; row: number }
  | { type: 'move-row'; from: number; to: number }
  | { type: 'set-param'; row: number; param: string; value: number | undefined }
  | { type: 'set-mod'; kind: ModKind; patch: Partial<Modulation> | undefined }
  | { type: 'set-trigger'; row: number | undefined }
  | { type: 'add-sample'; file: string; playmode: Playmode }
  | { type: 'remove-sample'; index: number }
  | { type: 'set-playmode'; index: number; playmode: Playmode }
  | { type: 'load'; config: Config }

export function reduce(state: BenchState, action: Action): BenchState {
  switch (action.type) {
    case 'load':
      // A freshly loaded pack is not "edited" — it is exactly what is on disk.
      return { ...state, config: action.config, selected: 0, dirty: false }

    case 'select':
      return { ...state, selected: clampIndex(action.index, state.config.presets.length) }

    case 'set-handle':
      // Moving the handle is performance, not editing; it changes no file.
      return { ...state, handle: Math.min(1, Math.max(0, action.value)) }

    case 'set-pack-name':
      return { ...state, dirty: true, config: { ...state.config, name: action.name } }

    case 'add-preset': {
      if (state.config.presets.length >= 4) return state
      const preset: Preset = {
        pos: nextFreeSlot(state.config.presets),
        name: 'NEW PRESET',
        list: [{ effect: 'SAMPLE' }],
        trigger: { row: 0 },
      }
      const presets = [...state.config.presets, preset]
      return { ...state, dirty: true, config: { ...state.config, presets }, selected: presets.length - 1 }
    }

    case 'remove-preset': {
      const presets = state.config.presets.filter((_, i) => i !== action.index)
      return {
        ...state,
        dirty: true,
        config: { ...state.config, presets },
        selected: clampIndex(state.selected, presets.length),
      }
    }

    case 'add-sample': {
      const samples = state.config.samples ?? []
      if (samples.length >= 4) return state
      const next: SampleRef = { pos: nextFreeSampleSlot(samples), file: action.file, playmode: action.playmode }
      return { ...state, dirty: true, config: { ...state.config, samples: [...samples, next] } }
    }

    case 'remove-sample': {
      const samples = (state.config.samples ?? []).filter((_, i) => i !== action.index)
      // An empty list is not the same as no list: omitting "samples" entirely is
      // how the guide says to fall back to the mic's four factory sounds.
      const config = { ...state.config }
      if (samples.length) config.samples = samples
      else delete config.samples
      return { ...state, dirty: true, config }
    }

    case 'set-playmode': {
      const samples = (state.config.samples ?? []).map((s, i) =>
        i === action.index ? { ...s, playmode: action.playmode } : s,
      )
      return { ...state, dirty: true, config: { ...state.config, samples } }
    }

    default:
      return { ...state, dirty: true, config: editPreset(state, (preset) => applyToPreset(preset, action)) }
  }
}

function nextFreeSampleSlot(samples: SampleRef[]): number {
  const taken = new Set(samples.map((s) => s.pos).filter((p): p is number => p !== undefined))
  for (let i = 0; i < 4; i++) if (!taken.has(i)) return i
  return 0
}

function applyToPreset(preset: Preset, action: Action): Preset {
  switch (action.type) {
    case 'set-preset-field':
      return { ...preset, [action.field]: action.value }

    case 'add-row':
      return retarget({ ...preset, list: [...preset.list, blankRow(action.effect)] }, preset.list.length)

    case 'remove-row': {
      const list = preset.list.filter((_, i) => i !== action.row)
      return dropDanglingRefs({ ...preset, list }, action.row)
    }

    case 'move-row': {
      const list = [...preset.list]
      const [moved] = list.splice(action.from, 1)
      list.splice(action.to, 0, moved)
      return remapRefs({ ...preset, list }, action.from, action.to)
    }

    case 'set-param': {
      const list = preset.list.map((row, i) => {
        if (i !== action.row) return row
        const next: EffectRow = { ...row }
        // Deleting rather than writing a zero keeps untouched parameters out of
        // the file, so the device uses its own defaults instead of ours.
        if (action.value === undefined) delete next[action.param]
        else next[action.param] = action.value
        return next
      })
      return { ...preset, list }
    }

    case 'set-mod': {
      const next = { ...preset }
      if (action.patch === undefined) delete next[action.kind]
      else next[action.kind] = { ...(preset[action.kind] ?? {}), ...action.patch }
      return next
    }

    case 'set-trigger': {
      const next = { ...preset }
      if (action.row === undefined) delete next.trigger
      else next.trigger = { row: action.row }
      return next
    }

    default:
      return preset
  }
}

function editPreset(state: BenchState, fn: (preset: Preset) => Preset): Config {
  const presets = state.config.presets.map((p, i) => (i === state.selected ? fn(p) : p))
  return { ...state.config, presets }
}

/** A new row shifts nothing, but a first SAMPLE row should get the trigger. */
function retarget(preset: Preset, addedAt: number): Preset {
  const row = preset.list[addedAt]
  if (row?.effect === 'SAMPLE' && !preset.trigger) return { ...preset, trigger: { row: addedAt } }
  return preset
}

/**
 * Deleting a row renumbers everything after it. Modulation that pointed at the
 * deleted row is removed rather than silently repointed at its neighbour —
 * a wrong target is worse than an absent one.
 */
function dropDanglingRefs(preset: Preset, removed: number): Preset {
  const next: Preset = { ...preset }
  for (const kind of ['handle', 'shake', 'lfo'] as const) {
    const mod = next[kind]
    if (!mod || mod.row === undefined) continue
    if (mod.row === removed) delete next[kind]
    else if (mod.row > removed) next[kind] = { ...mod, row: mod.row - 1 }
  }
  if (next.trigger?.row !== undefined) {
    if (next.trigger.row === removed) delete next.trigger
    else if (next.trigger.row > removed) next.trigger = { row: next.trigger.row - 1 }
  }
  return next
}

/** Reordering keeps every reference pointing at the same effect it did before. */
function remapRefs(preset: Preset, from: number, to: number): Preset {
  const move = (row: number) => {
    if (row === from) return to
    if (from < to && row > from && row <= to) return row - 1
    if (from > to && row >= to && row < from) return row + 1
    return row
  }
  const next: Preset = { ...preset }
  for (const kind of ['handle', 'shake', 'lfo'] as const) {
    const mod = next[kind]
    if (mod?.row !== undefined) next[kind] = { ...mod, row: move(mod.row) }
  }
  if (next.trigger?.row !== undefined) next.trigger = { row: move(next.trigger.row) }
  return next
}

function nextFreeSlot(presets: Preset[]): number {
  const taken = new Set(presets.map((p) => p.pos).filter((p): p is number => p !== undefined))
  for (let i = 0; i < 4; i++) if (!taken.has(i)) return i
  return 0
}

const clampIndex = (i: number, length: number) => Math.max(0, Math.min(i, Math.max(0, length - 1)))

/** The value a parameter currently has, falling back to the spec's start value. */
export function paramValue(row: EffectRow, param: string): number | undefined {
  const value = row[param]
  return typeof value === 'number' ? value : undefined
}

export function paramDisplay(row: EffectRow, param: string): number {
  const set = paramValue(row, param)
  if (set !== undefined) return set
  const spec = effectByName(row.effect)
  return spec?.params.find((p) => p.name === param)?.start ?? 0
}
