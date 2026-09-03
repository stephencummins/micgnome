import { LIBRARY } from '../packs/library'
import type { Config } from '../fxmic/types'

export type StepStatus = 'done' | 'current' | 'todo' | 'optional'

/** Which tab each step lives on, so the guide can follow the person around the bench. */
export const STEP_TAB: (string | undefined)[] = ['library', 'chain', 'chain', 'samples', undefined, undefined, 'library']

/**
 * What the person has actually done, read off the bench rather than asked.
 * Steps 4 (own sounds) and 7 (send it in) are optional: they never block
 * "current" and only turn green if they were done.
 */
export function stepStatuses(
  config: Config,
  flags: { written: boolean; downloaded: boolean; submitted?: boolean },
): StepStatus[] {
  const presets = config.presets ?? []
  const builtSomething = presets.some((p) => p.list.length > 1)
  const done = [
    LIBRARY.some((p) => p.name === config.name) || builtSomething,
    builtSomething,
    presets.some((p) => p.handle || p.shake || p.lfo),
    (config.samples?.length ?? 0) > 0,
    flags.written,
    flags.downloaded,
    Boolean(flags.submitted),
  ]
  const OPTIONAL = new Set([3, 6])
  const current = done.findIndex((d, i) => !d && !OPTIONAL.has(i))
  return done.map((d, i) => (d ? 'done' : OPTIONAL.has(i) ? 'optional' : i === current ? 'current' : 'todo'))
}
