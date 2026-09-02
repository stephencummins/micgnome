/**
 * The validator. Its one job: never let a file reach the device that would
 * stop it booting.
 *
 * Two severities, and the line between them is deliberate. An `error` is
 * something the guide states plainly — an unknown effect, a value outside a
 * published range, a modulation row that does not exist. A `warning` is
 * somewhere the guide is silent (see spec.AMBIGUOUS): we say so and let the
 * file through, because refusing a config that actually works is a worse
 * failure than passing one that might not.
 */
import { Collector, nearest, type Report } from './diagnostics'
import {
  AMBIGUOUS,
  EFFECT_NAMES,
  LFO_SHAPES,
  LIMITS,
  PLAYMODES,
  effectByLooseName,
  effectByName,
  paramByLooseName,
  paramByName,
} from './spec'
import type { DiskFile } from './types'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const PRESET_KEYS = ['pos', 'name', 'comment', 'list', 'handle', 'shake', 'lfo', 'trigger']
const SAMPLE_KEYS = ['pos', 'file', 'playmode']
const TOP_KEYS = ['name', 'samples', 'presets']
/** Fields of the LFO block itself, for `"target": "lfo"` modulation. */
const LFO_TARGETS = ['speed', 'depth', 'phase']

export interface ValidateOptions {
  /** Files sitting on the disk beside config.json, for size and existence checks. */
  files?: DiskFile[]
}

export function validate(input: unknown, options: ValidateOptions = {}): Report {
  const c = new Collector()

  if (!isObject(input)) {
    c.error('not-an-object', '', 'The config must be a JSON object wrapped in { }.', 'Start from the basic skeleton: { "name": "...", "presets": [ ... ] }')
    return c.report()
  }

  unknownKeys(c, input, TOP_KEYS, '')

  if ('name' in input && typeof input.name !== 'string') {
    c.error('name-not-string', 'name', 'The pack name must be text in double quotes.')
  } else if (!('name' in input)) {
    c.warn('no-name', '', 'This pack has no name.', 'Add "name": "MY PACK" so you can tell it apart on the device.')
  }

  validateSamples(c, input.samples, options.files)
  validatePresets(c, input.presets, isObject(input) && Array.isArray(input.samples) ? input.samples.length : 0)
  validateStorage(c, options.files)

  return c.report()
}

function unknownKeys(c: Collector, obj: Record<string, unknown>, known: string[], path: string) {
  for (const key of Object.keys(obj)) {
    if (known.includes(key)) continue
    const guess = nearest(key, known)
    c.warn(
      'unknown-key',
      join(path, key),
      `"${key}" is not a field the guide documents here.`,
      guess ? `Did you mean "${guess}"?` : AMBIGUOUS.unknownKeys,
    )
  }
}

const join = (a: string, b: string) => (a ? `${a}.${b}` : b)

// ---------------------------------------------------------------- samples

function validateSamples(c: Collector, samples: unknown, files?: DiskFile[]) {
  if (samples === undefined) return // omitted on purpose: use the factory sounds
  if (!Array.isArray(samples)) {
    c.error('samples-not-array', 'samples', 'The "samples" field must be a list in [ ].')
    return
  }
  if (samples.length > LIMITS.samples) {
    c.error(
      'too-many-samples',
      'samples',
      `${samples.length} samples, but the mic has ${LIMITS.samples} slots.`,
      `Remove ${samples.length - LIMITS.samples}.`,
    )
  }

  const seenPos = new Map<number, number>()

  samples.forEach((s, i) => {
    const path = `samples[${i}]`
    if (!isObject(s)) {
      c.error('sample-not-object', path, 'Each sample must be an object: { "file": "x.wav", "playmode": "oneshot" }')
      return
    }
    unknownKeys(c, s, SAMPLE_KEYS, path)

    if (typeof s.file !== 'string' || !s.file) {
      c.error('sample-no-file', join(path, 'file'), 'Every sample needs a "file".')
    } else {
      if (!s.file.toLowerCase().endsWith('.wav')) {
        c.error('sample-not-wav', join(path, 'file'), `"${s.file}" is not a .wav — the mic only reads wav files.`)
      }
      if (files && !files.some((f) => f.name.toLowerCase() === String(s.file).toLowerCase())) {
        c.error(
          'sample-missing',
          join(path, 'file'),
          `"${s.file}" is not on the disk.`,
          'Add the file, or remove this entry from "samples".',
        )
      }
    }

    if (s.playmode === undefined) {
      c.warn(
        'no-playmode',
        join(path, 'playmode'),
        'No playmode set.',
        `Add one of: ${PLAYMODES.join(', ')}. The guide does not say what the mic does without it.`,
      )
    } else if (typeof s.playmode !== 'string' || !PLAYMODES.includes(s.playmode as never)) {
      const guess = typeof s.playmode === 'string' ? nearest(s.playmode, [...PLAYMODES]) : undefined
      c.error(
        'bad-playmode',
        join(path, 'playmode'),
        `"${String(s.playmode)}" is not a playmode.`,
        guess ? `Did you mean "${guess}"?` : `Use one of: ${PLAYMODES.join(', ')}.`,
      )
    }

    validateSlot(c, s.pos, join(path, 'pos'), seenPos, i, LIMITS.samples, 'sample')
  })
}

// ---------------------------------------------------------------- presets

function validatePresets(c: Collector, presets: unknown, sampleCount: number) {
  if (presets === undefined) {
    c.error('no-presets', 'presets', 'The config has no "presets" list.', 'Every config needs "presets": [ ... ] — this is what the orange button selects.')
    return
  }
  if (!Array.isArray(presets)) {
    c.error('presets-not-array', 'presets', 'The "presets" field must be a list in [ ].')
    return
  }
  if (presets.length === 0) {
    c.warn('empty-presets', 'presets', 'There are no presets, so the mic will make no sound.')
  }
  if (presets.length > LIMITS.presets) {
    c.error(
      'too-many-presets',
      'presets',
      `${presets.length} presets, but the orange button has ${LIMITS.presets} slots.`,
      `Remove ${presets.length - LIMITS.presets}.`,
    )
  }

  const seenPos = new Map<number, number>()

  presets.forEach((preset, i) => {
    const path = `presets[${i}]`
    if (!isObject(preset)) {
      c.error('preset-not-object', path, 'Each preset must be an object in { }.')
      return
    }
    unknownKeys(c, preset, PRESET_KEYS, path)
    validateSlot(c, preset.pos, join(path, 'pos'), seenPos, i, LIMITS.presets, 'preset')

    for (const key of ['name', 'comment'] as const) {
      if (key in preset && typeof preset[key] !== 'string') {
        c.error('not-string', join(path, key), `"${key}" must be text in double quotes.`)
      }
    }

    const rows = validateChain(c, preset.list, path)
    validateModulation(c, preset, rows, path, sampleCount)
  })
}

/** Returns the effect name per row, or undefined where the row was unusable. */
function validateChain(c: Collector, list: unknown, path: string): (string | undefined)[] {
  const p = join(path, 'list')
  if (list === undefined) {
    c.error('no-list', p, 'This preset has no "list" of effects.', 'Add "list": [ ... ] — even a dry preset needs one, usually just { "effect": "SAMPLE" }.')
    return []
  }
  if (!Array.isArray(list)) {
    c.error('list-not-array', p, 'The "list" field must be a list in [ ].')
    return []
  }
  if (list.length === 0) {
    c.warn('empty-list', p, 'This preset has an empty chain, so it will pass audio through untouched.')
  }

  const rows: (string | undefined)[] = []
  const onceUsed = new Map<string, number>()

  list.forEach((row, i) => {
    const rp = `${p}[${i}]`
    if (!isObject(row)) {
      c.error('row-not-object', rp, 'Each effect must be an object: { "effect": "DIST", "amount": 10.0 }')
      rows.push(undefined)
      return
    }

    const raw = row.effect
    if (typeof raw !== 'string') {
      c.error('no-effect', join(rp, 'effect'), 'This row has no "effect" name.')
      rows.push(undefined)
      return
    }

    const exact = effectByName(raw)
    const loose = effectByLooseName(raw)

    if (!exact && loose) {
      // The guide is explicit: uppercase is mandatory. This is an error, not a nag.
      c.error(
        'effect-case',
        join(rp, 'effect'),
        `"${raw}" must be uppercase.`,
        `Write "${loose.name}". The guide requires uppercase effect names.`,
      )
      rows.push(loose.name)
    } else if (!exact) {
      const guess = nearest(raw, EFFECT_NAMES)
      c.error(
        'unknown-effect',
        join(rp, 'effect'),
        `"${raw}" is not an effect on this mic.`,
        guess ? `Did you mean "${guess}"?` : `Available: ${EFFECT_NAMES.join(', ')}.`,
      )
      rows.push(undefined)
      return
    } else {
      rows.push(exact.name)
    }

    const spec = exact ?? loose!

    if (spec.oncePerChain) {
      const first = onceUsed.get(spec.name)
      if (first !== undefined) {
        c.error(
          'once-per-chain',
          join(rp, 'effect'),
          `${spec.name} is already used at row ${first}.`,
          `The guide marks ${spec.name} as "use once per effect chain". Remove one of them.`,
        )
      } else {
        onceUsed.set(spec.name, i)
      }
    }

    validateRowParams(c, row, spec.name, rp)
  })

  return rows
}

function validateRowParams(c: Collector, row: Record<string, unknown>, effectName: string, rp: string) {
  const spec = effectByName(effectName)!
  const names = spec.params.map((x) => x.name)

  for (const [key, value] of Object.entries(row)) {
    if (key === 'effect') continue

    if (key === 'BUS') {
      if (!isInt(value) || !LIMITS.busValues.includes(value as 1 | 2)) {
        c.warn(
          'bad-bus',
          join(rp, 'BUS'),
          `BUS is ${JSON.stringify(value)}; the guide only documents 1 and 2.`,
          AMBIGUOUS.bus,
        )
      }
      continue
    }

    const exact = paramByName(spec, key)
    const loose = paramByLooseName(spec, key)

    if (!exact && loose) {
      c.warn(
        'param-case',
        join(rp, key),
        `"${key}" is spelled "${loose.name}" in the guide.`,
        AMBIGUOUS.paramCase,
      )
    } else if (!exact) {
      const guess = nearest(key, names)
      c.warn(
        'unknown-param',
        join(rp, key),
        `${effectName} has no parameter called "${key}".`,
        guess ? `Did you mean "${guess}"?` : `${effectName} takes: ${names.join(', ')}.`,
      )
      continue
    }

    const param = exact ?? loose!
    if (!isNum(value)) {
      c.error('param-not-number', join(rp, key), `"${key}" must be a number, not ${JSON.stringify(value)}.`)
    } else if (value < param.min || value > param.max) {
      c.error(
        'param-out-of-range',
        join(rp, key),
        `"${key}" is ${value}; the range is ${param.min} to ${param.max}.`,
        `Clamp it to ${Math.min(Math.max(value, param.min), param.max)}.`,
      )
    }
  }
}

// ------------------------------------------------------------ modulation

function validateModulation(
  c: Collector,
  preset: Record<string, unknown>,
  rows: (string | undefined)[],
  path: string,
  sampleCount: number,
) {
  const hasLfo = isObject(preset.lfo)

  for (const kind of ['handle', 'shake', 'lfo'] as const) {
    const block = preset[kind]
    if (block === undefined) continue
    const bp = join(path, kind)
    if (!isObject(block)) {
      c.error('mod-not-object', bp, `"${kind}" must be an object in { }.`)
      continue
    }

    if (kind === 'lfo') validateLfoFields(c, block, bp)

    const targetsLfo = block.target === 'lfo'
    if ('target' in block && !targetsLfo) {
      c.error('bad-target', join(bp, 'target'), `"target" is only documented with the value "lfo".`)
    }

    if (targetsLfo) {
      if (kind !== 'handle') {
        c.warn('target-lfo-elsewhere', join(bp, 'target'), `The guide only shows "target": "lfo" on the handle.`)
      }
      if (!hasLfo) {
        c.error('target-lfo-missing', bp, 'This modulates the LFO, but the preset has no "lfo" block.', 'Add an "lfo" block, or point this at a row instead.')
      }
      if (typeof block.param === 'string' && !LFO_TARGETS.includes(block.param)) {
        c.warn('lfo-target-param', join(bp, 'param'), `The guide only shows ${LFO_TARGETS.join(', ')} as LFO targets.`)
      }
    } else {
      validateRowRef(c, block.row, join(bp, 'row'), rows, kind)
      validateParamRef(c, block, rows, bp)
    }

    if (typeof block.param !== 'string') {
      c.error('mod-no-param', join(bp, 'param'), `"${kind}" must name a "param" to modulate.`)
    }
    if ('depth' in block && !isNum(block.depth)) {
      c.error('mod-depth', join(bp, 'depth'), '"depth" must be a number.')
    } else if (!('depth' in block) && kind !== 'lfo') {
      c.warn('mod-no-depth', bp, `"${kind}" has no depth, so it may do nothing.`)
    }
  }

  validateTrigger(c, preset, rows, path, sampleCount)
}

function validateLfoFields(c: Collector, block: Record<string, unknown>, bp: string) {
  if ('shape' in block) {
    if (typeof block.shape !== 'string' || !LFO_SHAPES.includes(block.shape as never)) {
      const guess = typeof block.shape === 'string' ? nearest(block.shape, [...LFO_SHAPES]) : undefined
      c.error(
        'bad-lfo-shape',
        join(bp, 'shape'),
        `"${String(block.shape)}" is not an LFO shape.`,
        guess ? `Did you mean "${guess}"?` : `Use one of: ${LFO_SHAPES.join(', ')}.`,
      )
    }
  } else {
    c.warn('no-lfo-shape', join(bp, 'shape'), 'No LFO shape set.', `Add one of: ${LFO_SHAPES.join(', ')}.`)
  }

  for (const key of ['speed', 'phase'] as const) {
    if (key in block && !isNum(block[key])) {
      c.error('lfo-not-number', join(bp, key), `"${key}" must be a number.`)
    }
  }
  if (isNum(block.speed) && block.speed <= 0) {
    c.warn('lfo-stopped', join(bp, 'speed'), `Speed is ${block.speed}, so the LFO will not cycle.`)
  }
}

function validateRowRef(
  c: Collector,
  row: unknown,
  path: string,
  rows: (string | undefined)[],
  kind: string,
) {
  if (row === undefined) {
    c.error('mod-no-row', path, `"${kind}" must name the "row" it modulates.`, 'Rows are numbered from 0, in the order they appear in "list".')
    return
  }
  if (!isInt(row) || row < 0) {
    c.error('mod-row-not-index', path, `"row" must be a whole number from 0, not ${JSON.stringify(row)}.`)
    return
  }
  if (row >= rows.length) {
    c.error(
      'mod-row-out-of-range',
      path,
      `"row": ${row} does not exist — the chain has ${rows.length} row${rows.length === 1 ? '' : 's'} (0 to ${rows.length - 1}).`,
      'Row numbers are indexes into "list", counting from 0.',
    )
  }
}

function validateParamRef(
  c: Collector,
  block: Record<string, unknown>,
  rows: (string | undefined)[],
  bp: string,
) {
  const row = block.row
  const param = block.param
  if (!isInt(row) || typeof param !== 'string') return
  const effectName = rows[row]
  if (!effectName) return // already reported as an unknown effect or a bad row
  const spec = effectByName(effectName)!
  if (paramByName(spec, param)) return
  const loose = paramByLooseName(spec, param)
  if (loose) {
    c.warn('mod-param-case', join(bp, 'param'), `"${param}" is spelled "${loose.name}" in the guide.`, AMBIGUOUS.paramCase)
    return
  }
  const guess = nearest(param, spec.params.map((x) => x.name))
  c.error(
    'mod-param-missing',
    join(bp, 'param'),
    `Row ${row} is ${effectName}, which has no "${param}" to modulate.`,
    guess ? `Did you mean "${guess}"?` : `${effectName} takes: ${spec.params.map((x) => x.name).join(', ')}.`,
  )
}

function validateTrigger(
  c: Collector,
  preset: Record<string, unknown>,
  rows: (string | undefined)[],
  path: string,
  sampleCount: number,
) {
  const sampleRow = rows.indexOf('SAMPLE')
  const trigger = preset.trigger

  if (trigger !== undefined) {
    const tp = join(path, 'trigger')
    if (!isObject(trigger)) {
      c.error('trigger-not-object', tp, '"trigger" must be an object: { "row": 2 }')
      return
    }
    validateRowRef(c, trigger.row, join(tp, 'row'), rows, 'trigger')
    if (isInt(trigger.row) && trigger.row < rows.length && rows[trigger.row] !== 'SAMPLE') {
      c.error(
        'trigger-not-sample',
        join(tp, 'row'),
        `"trigger" points at row ${trigger.row}, which is ${rows[trigger.row] ?? 'unreadable'}, not SAMPLE.`,
        sampleRow >= 0 ? `The SAMPLE row is ${sampleRow}.` : 'Add a { "effect": "SAMPLE" } row first.',
      )
    }
    return
  }

  if (sampleRow >= 0) {
    c.warn('no-trigger', path, 'This preset has a SAMPLE row but no "trigger".', AMBIGUOUS.trigger)
  } else if (rows.length > 0) {
    // Guide 7.5: without a SAMPLE block in the chain, no sample sound is generated.
    c.warn(
      'no-sample-row',
      join(path, 'list'),
      sampleCount > 0
        ? 'This preset has no SAMPLE row, so the sample button will be silent here.'
        : 'This preset has no SAMPLE row, so the mic\'s built-in sounds will be silent here.',
      'Add { "effect": "SAMPLE" } to the chain — at the end to keep it dry, earlier to run it through the effects above.',
    )
  }
}

/**
 * `pos` places a preset or sample in a specific slot on the device. Two entries
 * claiming the same slot is a silent overwrite, so it is an error.
 */
function validateSlot(
  c: Collector,
  pos: unknown,
  path: string,
  seen: Map<number, number>,
  index: number,
  limit: number,
  kind: string,
) {
  if (pos === undefined) {
    // No pos means "take the next free slot in order", which is the common case.
    return
  }
  if (!isInt(pos)) {
    c.error('pos-not-int', path, `"pos" must be a whole number, not ${JSON.stringify(pos)}.`)
    return
  }
  if (pos < 0 || pos >= limit) {
    c.error('pos-out-of-range', path, `"pos": ${pos} — the mic has ${kind} slots 0 to ${limit - 1}.`)
    return
  }
  const first = seen.get(pos)
  if (first !== undefined) {
    c.error(
      'pos-duplicate',
      path,
      `Slot ${pos} is already taken by ${kind} ${first}.`,
      `Give this one a different "pos", or remove it — otherwise one silently replaces the other.`,
    )
    return
  }
  seen.set(pos, index)
}

function validateStorage(c: Collector, files?: DiskFile[]) {
  if (!files?.length) return
  const total = files.reduce((n, f) => n + f.bytes, 0)
  if (total > LIMITS.storageBytes) {
    const over = total - LIMITS.storageBytes
    c.error(
      'over-budget',
      'samples',
      `${kb(total)} of files, but the mic holds ${kb(LIMITS.storageBytes)}.`,
      `Free up ${kb(over)} — trim a sample, drop it to mono, or lower the sample rate.`,
    )
  } else if (total > LIMITS.storageBytes * 0.95) {
    c.warn('near-budget', 'samples', `${kb(total)} of ${kb(LIMITS.storageBytes)} used.`)
  }
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kb`
