import { LIBRARY } from '../packs/library'
import type { Config } from '../fxmic/types'

export type StepStatus = 'done' | 'current' | 'todo' | 'optional'

/** Which tab each step lives on, so the guide can follow the person around the bench. */
export const STEP_TAB: (string | undefined)[] = ['library', 'chain', 'chain', 'samples', undefined, undefined]

/**
 * What the person has actually done, read off the bench rather than asked.
 * Step 4 (own sounds) is optional: it never blocks "current" and only turns
 * green if they did it.
 */
export function stepStatuses(config: Config, flags: { written: boolean; downloaded: boolean }): StepStatus[] {
  const presets = config.presets ?? []
  const builtSomething = presets.some((p) => p.list.length > 1)
  const done = [
    LIBRARY.some((p) => p.name === config.name) || builtSomething,
    builtSomething,
    presets.some((p) => p.handle || p.shake || p.lfo),
    (config.samples?.length ?? 0) > 0,
    flags.written,
    flags.downloaded,
  ]
  const OPTIONAL = 3
  const current = done.findIndex((d, i) => !d && i !== OPTIONAL)
  return done.map((d, i) => (d ? 'done' : i === OPTIONAL ? 'optional' : i === current ? 'current' : 'todo'))
}
