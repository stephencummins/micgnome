import { LIBRARY } from '../packs/library'
import type { Config } from '../fxmic/types'

export type StepStatus = 'done' | 'current' | 'todo' | 'optional'

/** Which tab each step lives on, so the guide can follow the person around the bench. */
export const STEP_TAB: (string | undefined)[] = ['gnome', 'library', 'chain', 'chain', 'samples', undefined, undefined, 'library']

/**
 * What each step's "where →" link points at on the bench: switch to its tab
 * (if it has one), then scroll to this and outline it, as TDMDNE's guide does.
 */
export const STEP_AT: string[] = [
  '#tab-gnome',
  '#tab-library',
  '#bench-chain',
  '#bench-modulation',
  '#tab-samples',
  '#bench-write',
  '#bench-downloads',
  '#tab-library',
]

/**
 * What the person has actually done, read off the bench rather than asked.
 *
 * Three steps are optional and never block "current": asking the gnome, your
 * own sounds, and sending a pack in. The gnome is optional by design — it is a
 * way in, not a chore, and somebody who prefers the knobs should never be shown
 * an unfinished guide for ignoring him.
 */
export function stepStatuses(
  config: Config,
  flags: { written: boolean; downloaded: boolean; submitted?: boolean; asked?: boolean },
): StepStatus[] {
  const presets = config.presets ?? []
  const builtSomething = presets.some((p) => p.list.length > 1)
  const done = [
    Boolean(flags.asked),
    LIBRARY.some((p) => p.name === config.name) || builtSomething,
    builtSomething,
    presets.some((p) => p.handle || p.shake || p.lfo),
    (config.samples?.length ?? 0) > 0,
    flags.written,
    flags.downloaded,
    Boolean(flags.submitted),
  ]
  const OPTIONAL = new Set([0, 4, 7])
  const current = done.findIndex((d, i) => !d && !OPTIONAL.has(i))
  return done.map((d, i) => (d ? 'done' : OPTIONAL.has(i) ? 'optional' : i === current ? 'current' : 'todo'))
}
