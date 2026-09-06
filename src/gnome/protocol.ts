/**
 * What the gnome is allowed to say back.
 *
 * The model never writes a config. It proposes bench actions — the same
 * discriminated union the UI dispatches — and every one is checked here before
 * it goes anywhere near the reducer. A free model will sometimes return
 * nonsense; that has to be an inert parse failure, not a bad file.
 *
 * Two rules shape everything below:
 *   1. Unknown shape is refused, never coerced. A half-understood action is
 *      more dangerous than no action.
 *   2. Refusal is cheap and recoverable. We hand the reason back to the model
 *      and let it try again, rather than throwing.
 */
import { EFFECT_NAMES, LFO_SHAPES } from '../fxmic/spec'
import type { Action, ModKind } from '../bench/state'

/** The reply we ask the model for, and the only shape the UI will render. */
export interface GnomeReply {
  /** Plain text for the person. Rendered as text, never as HTML. */
  say: string
  /** Optional proposed edits, shown as a card with Apply / Discard. */
  actions?: ProposedAction[]
  /** Up to three follow-ups, offered as tappable pills. */
  suggest?: string[]
}

/**
 * The actions the gnome may propose. Deliberately a subset:
 *
 * - `select` and `set-handle` are performance, not editing — nothing to confirm.
 * - the sample actions name files that must already exist on the disk, and a
 *   model inventing a filename produces a preset with a dead sample button.
 *   Samples stay a human job until the sample bay lands.
 */
export const PROPOSABLE = [
  'set-pack-name',
  'add-preset',
  'remove-preset',
  'set-preset-field',
  'add-row',
  'remove-row',
  'move-row',
  'set-param',
  'set-mod',
  'set-trigger',
  'load',
] as const

export type ProposableType = (typeof PROPOSABLE)[number]

/**
 * An action the gnome is allowed to propose. Narrowing to this (rather than the
 * whole `Action` union) is what lets the summary writer in apply.ts be checked
 * for exhaustiveness: add a proposable type and the compiler asks for its words.
 */
export type ProposedAction = Extract<Action, { type: ProposableType }>

/** Longest reply we will render. A runaway generation is a bug, not a feature. */
export const MAX_SAY = 1200
/** More proposed edits than this and the person cannot meaningfully consent. */
export const MAX_ACTIONS = 24

export type ParseOutcome =
  | { ok: true; reply: GnomeReply }
  /** `reason` is written for the model, not the person: it goes back as a repair note. */
  | { ok: false; reason: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 64

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Models wrap JSON in prose or fences even when asked not to. Being lenient
 * about the wrapper costs nothing; being lenient about the contents would cost
 * the whole safety argument.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const body = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(body)
  } catch {
    // Fall back to the outermost braces, for a reply with a sentence in front.
    const first = body.indexOf('{')
    const last = body.lastIndexOf('}')
    if (first === -1 || last <= first) return undefined
    try {
      return JSON.parse(body.slice(first, last + 1))
    } catch {
      return undefined
    }
  }
}

/** One action, checked variant by variant. Returns null when it is not safe to run. */
export function parseAction(raw: unknown): ProposedAction | null {
  if (!isObject(raw) || typeof raw.type !== 'string') return null
  if (!(PROPOSABLE as readonly string[]).includes(raw.type)) return null

  switch (raw.type as ProposableType) {
    case 'set-pack-name':
      return typeof raw.name === 'string' && raw.name.length <= 60
        ? { type: 'set-pack-name', name: raw.name }
        : null

    case 'add-preset':
      return { type: 'add-preset' }

    case 'remove-preset':
      return isIndex(raw.index) ? { type: 'remove-preset', index: raw.index } : null

    case 'set-preset-field':
      return (raw.field === 'name' || raw.field === 'comment') &&
        typeof raw.value === 'string' &&
        raw.value.length <= 200
        ? { type: 'set-preset-field', field: raw.field, value: raw.value }
        : null

    case 'add-row':
      // Uppercase-exact, like the guide requires. A near-miss is refused rather
      // than corrected, so a model guessing "Reverb" gets told, not silently fixed.
      return typeof raw.effect === 'string' && EFFECT_NAMES.includes(raw.effect)
        ? { type: 'add-row', effect: raw.effect }
        : null

    case 'remove-row':
      return isIndex(raw.row) ? { type: 'remove-row', row: raw.row } : null

    case 'move-row':
      return isIndex(raw.from) && isIndex(raw.to) ? { type: 'move-row', from: raw.from, to: raw.to } : null

    case 'set-param':
      // `undefined` is meaningful: it unsets a parameter so the device uses its
      // own default. JSON has no undefined, so null carries it.
      if (!isIndex(raw.row) || typeof raw.param !== 'string') return null
      if (raw.value === null) return { type: 'set-param', row: raw.row, param: raw.param, value: undefined }
      return isFiniteNumber(raw.value)
        ? { type: 'set-param', row: raw.row, param: raw.param, value: raw.value }
        : null

    case 'set-mod': {
      const kinds: ModKind[] = ['handle', 'shake', 'lfo']
      if (!kinds.includes(raw.kind as ModKind)) return null
      if (raw.patch === null) return { type: 'set-mod', kind: raw.kind as ModKind, patch: undefined }
      if (!isObject(raw.patch)) return null
      const patch: Record<string, unknown> = {}
      if ('row' in raw.patch) {
        if (!isIndex(raw.patch.row)) return null
        patch.row = raw.patch.row
      }
      if ('target' in raw.patch) {
        if (raw.patch.target !== 'lfo') return null
        patch.target = 'lfo'
      }
      if ('param' in raw.patch) {
        if (typeof raw.patch.param !== 'string') return null
        patch.param = raw.patch.param
      }
      if ('depth' in raw.patch) {
        if (!isFiniteNumber(raw.patch.depth)) return null
        patch.depth = raw.patch.depth
      }
      if ('shape' in raw.patch) {
        if (!(LFO_SHAPES as readonly string[]).includes(raw.patch.shape as string)) return null
        patch.shape = raw.patch.shape
      }
      for (const k of ['speed', 'phase', 'mpy'] as const) {
        if (k in raw.patch) {
          if (!isFiniteNumber(raw.patch[k])) return null
          patch[k] = raw.patch[k]
        }
      }
      return { type: 'set-mod', kind: raw.kind as ModKind, patch }
    }

    case 'set-trigger':
      if (raw.row === null) return { type: 'set-trigger', row: undefined }
      return isIndex(raw.row) ? { type: 'set-trigger', row: raw.row } : null

    case 'load':
      // The config is passed through unchecked here on purpose: `dryRun` runs
      // the real validator over the resulting state, which is the only opinion
      // that counts. Shape-checking it twice would just be a worse validator.
      return isObject(raw.config) && Array.isArray(raw.config.presets)
        ? ({ type: 'load', config: raw.config } as unknown as ProposedAction)
        : null
  }
}

export function parseReply(raw: unknown): ParseOutcome {
  const value = typeof raw === 'string' ? extractJson(raw) : raw
  if (!isObject(value)) return { ok: false, reason: 'Reply was not a JSON object.' }

  if (typeof value.say !== 'string' || value.say.trim() === '') {
    return { ok: false, reason: 'Reply needs a "say" string with something to tell the person.' }
  }
  const say = value.say.slice(0, MAX_SAY)

  let actions: ProposedAction[] | undefined
  if (value.actions !== undefined && value.actions !== null) {
    if (!Array.isArray(value.actions)) return { ok: false, reason: '"actions" must be an array.' }
    if (value.actions.length > MAX_ACTIONS) {
      return { ok: false, reason: `Too many actions: ${value.actions.length}, the limit is ${MAX_ACTIONS}.` }
    }
    const parsed: ProposedAction[] = []
    for (const [i, a] of value.actions.entries()) {
      const one = parseAction(a)
      if (!one) {
        const type = isObject(a) && typeof a.type === 'string' ? `"${a.type}"` : 'it'
        return { ok: false, reason: `Action ${i} is not one I can run — ${type} is unknown or its fields are wrong.` }
      }
      parsed.push(one)
    }
    if (parsed.length > 0) actions = parsed
  }

  let suggest: string[] | undefined
  if (Array.isArray(value.suggest)) {
    const clean = value.suggest.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, 3)
    if (clean.length > 0) suggest = clean
  }

  return { ok: true, reply: { say, ...(actions && { actions }), ...(suggest && { suggest }) } }
}

/**
 * The reply shape, as a JSON schema.
 *
 * NOT currently sent as `response_format`: constraining generation to it made
 * every model tried return only the required `say` and drop `actions`
 * altogether, which is the whole feature. Kept because it is the most precise
 * statement of the contract, and because a future model may honour a schema
 * without collapsing to the minimum.
 */
export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...PROPOSABLE] },
          effect: { type: 'string', enum: [...EFFECT_NAMES] },
          row: { type: 'number' },
          from: { type: 'number' },
          to: { type: 'number' },
          index: { type: 'number' },
          param: { type: 'string' },
          value: {},
          name: { type: 'string' },
          field: { type: 'string', enum: ['name', 'comment'] },
          kind: { type: 'string', enum: ['handle', 'shake', 'lfo'] },
          patch: { type: 'object' },
          config: { type: 'object' },
        },
        required: ['type'],
      },
    },
    suggest: { type: 'array', items: { type: 'string' } },
  },
  required: ['say'],
} as const
