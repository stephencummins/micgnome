/**
 * What the gnome is told about the device, assembled from `spec.ts`.
 *
 * Same principle as the printed manual: one source of truth, generated. A
 * reference that disagrees with the validator is worse than none, and an agent
 * that disagrees with the validator is worse still — it would confidently
 * propose things the bench then refuses.
 *
 * Grounding is requested in slices rather than shipped whole. That is a cost
 * decision as much as a quality one: the daily allowance is shared by every
 * visitor, so a prompt carrying the entire block table on every turn is a prompt
 * that runs out by lunchtime.
 */
import {
  AMBIGUOUS,
  BUTTONS,
  DUCK,
  EFFECTS,
  FACTORY_SOUNDS,
  FIELD_REPORTS,
  LFO_SHAPES,
  LIMITS,
  LINE_OUT,
  PLAYMODES,
  RECOVERY,
} from '../fxmic/spec'
import { LIBRARY } from '../packs/library'

export type GroundingKey =
  | 'blocks'
  | 'chain'
  | 'modulation'
  | 'packs'
  | 'limits'
  | 'device'
  | 'ambiguity'
  | 'evidence'

/** Every block, with its parameters and the ranges the validator will enforce. */
function blocks(): string {
  const lines = EFFECTS.map((e) => {
    const params = e.params
      .map((p) => `${p.name} ${p.min}..${p.max}${p.note ? ` (${p.note})` : ''}`)
      .join(', ')
    const flags = [
      e.oncePerChain ? 'once per chain' : null,
      e.unverified ? `not in the guide — player-reported (${e.unverified})` : null,
    ]
      .filter(Boolean)
      .join('; ')
    return `- ${e.name} (${e.label}): ${e.blurb}\n  params: ${params || 'none'}${flags ? `\n  note: ${flags}` : ''}`
  })
  return `THE BLOCKS. Effect names are UPPERCASE exactly as written.\n${lines.join('\n')}`
}

/** How a chain is ordered, which is the single most misunderstood thing about the mic. */
function chain(): string {
  return [
    'HOW A CHAIN WORKS.',
    'Audio falls from the top of the list to the bottom. A block affects everything',
    'BELOW it, never above. This is the most common misunderstanding: putting SAMPLE',
    'earlier means the sample runs through the effects that come AFTER it in the list.',
    'A preset is one chain. There are four preset slots plus a dry position.',
    'SAMPLE moves only the sample, never the voice.',
  ].join('\n')
}

function modulation(): string {
  return [
    'MAKING THINGS MOVE.',
    'Three movers, each pointed at one row and one of its parameters, with a depth:',
    '- handle: squeezing the mic',
    '- shake: shaking it',
    `- lfo: a wobble that runs on its own, shape one of ${LFO_SHAPES.join(', ')}`,
    'A mover can also point at the LFO itself (target "lfo") so squeezing changes the',
    'wobble speed rather than an effect.',
    `Sample playback modes: ${PLAYMODES.join(', ')}.`,
    `A sample can also set "duck" (${DUCK.min}-${DUCK.max}): ${DUCK.note}. Needs firmware ${DUCK.since}+; the meaning is inferred from the OP-Z, not confirmed on an fx-mic.`,
  ].join('\n')
}

/** The library, so "something like KO LO-FI" is answerable without loading every pack. */
function packs(): string {
  const lines = LIBRARY.map((p) => {
    const presets = p.config.presets.map((x) => x.name ?? 'unnamed').join(', ')
    return `- ${p.name} (id ${p.id}), after the ${p.after}: ${p.blurb}\n  presets: ${presets}\n  squeeze: ${p.handle}`
  })
  return (
    `THE PACK LIBRARY — ${LIBRARY.length} packs already built. Suggest one of these before building from scratch.\n` +
    lines.join('\n') +
    `\nNone has been heard on real hardware yet, so never claim one is verified.`
  )
}

function limits(): string {
  return [
    'HARD LIMITS.',
    `- ${LIMITS.presets} preset slots, ${LIMITS.samples} sample slots.`,
    `- Up to ${LIMITS.maxRowsPerPreset} effects in one preset's chain.`,
    `- Total sample storage ${Math.round(LIMITS.storageBytes / 1024)} KB.`,
    `- Samples: ${LIMITS.audio.extensions.join('/')}, up to ${LIMITS.audio.maxSampleRate / 1000} kHz, ${LIMITS.audio.maxChannels} channels.`,
    `- BUS is ${LIMITS.busValues.join(' or ')}.`,
  ].join('\n')
}

function device(): string {
  return [
    'THE MIC ITSELF.',
    `- Orange button: ${BUTTONS.orange}`,
    `- White button: ${BUTTONS.white}`,
    `- Grey button: ${BUTTONS.grey}`,
    `- Four sounds are already in the mic (${FACTORY_SOUNDS.join(', ')}), so a pack needs no files of its own. The censor beep also mutes the mic while it plays.`,
    `- Line out: ${LINE_OUT.maxLevel}. ${LINE_OUT.warning}`,
    `- If it will not start: ${RECOVERY}`,
  ].join('\n')
}

/** Where the guide is silent. The gnome must not invent certainty we do not have. */
function ambiguity(): string {
  const lines = Object.entries(AMBIGUOUS).map(([k, v]) => `- ${k}: ${v}`)
  return (
    'WHERE THE GUIDE IS SILENT. Say so plainly if one of these comes up; never state it as fact.\n' +
    lines.join('\n')
  )
}

function evidence(): string {
  const lines = Object.entries(FIELD_REPORTS).map(([k, v]) => `- ${k} (${v.when}): ${v.what}`)
  return (
    'THINGS PLAYERS REPORT, WHICH RANK BELOW THE GUIDE. Attribute these, never assert them.\n' +
    lines.join('\n')
  )
}

const SECTIONS: Record<GroundingKey, () => string> = {
  blocks,
  chain,
  modulation,
  packs,
  limits,
  device,
  ambiguity,
  evidence,
}

/** Assemble the requested slices, in a stable order so prompts stay cacheable. */
export function buildGrounding(keys: readonly GroundingKey[]): string {
  const order = Object.keys(SECTIONS) as GroundingKey[]
  const wanted = order.filter((k) => keys.includes(k))
  return wanted.map((k) => SECTIONS[k]()).join('\n\n')
}
