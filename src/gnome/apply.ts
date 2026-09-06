/**
 * The gate between what the gnome proposes and what reaches the bench.
 *
 * Every proposal is replayed into a throwaway copy of the state, validated
 * with the same validator that guards a hand-edited pack, and only offered to
 * the person if nothing in it would stop the mic booting. The never-brick
 * promise is kept here, in code, rather than in the prompt — which is the
 * point, because the prompt is being answered by a small free model.
 */
import { validate } from '../fxmic/validate'
import { effectByName, paramReadout } from '../fxmic/spec'
import type { Report } from '../fxmic/diagnostics'
import { errors, warnings } from '../fxmic/diagnostics'
import { reduce } from '../bench/state'
import type { BenchState } from '../bench/state'
import type { ProposedAction } from './protocol'

export interface DryRun {
  /** True when the result is safe to offer. Warnings do not block; errors do. */
  ok: boolean
  /** The state as it would be. Never share this unless `ok`. */
  next: BenchState
  report: Report
  /** One line per action, in the person's language, for the confirm card. */
  summary: string[]
  /**
   * Set when the run was refused. Written for the model as a repair note, so
   * it can try again; the person sees `say` plus a short apology instead.
   */
  refusal?: string
}

/**
 * Replay proposed actions and judge the result.
 *
 * `state` is not mutated: the reducer is pure and we keep the original for the
 * caller to fall back to. The returned `next` is a separate object.
 */
export function dryRun(state: BenchState, actions: ProposedAction[]): DryRun {
  let next = state
  const summary: string[] = []

  for (const action of actions) {
    const before = next
    next = reduce(next, action)
    summary.push(describe(action, before))
  }

  const report = validate(next.config)
  const failed = errors(report)

  if (failed.length > 0) {
    return {
      ok: false,
      next,
      report,
      summary,
      refusal:
        `Those edits produce a config the validator refuses: ` +
        failed.map((d) => `${d.path || 'config'}: ${d.message}`).join('; ') +
        `. Propose something different.`,
    }
  }

  return { ok: true, next, report, summary }
}

/** Warnings worth surfacing on the confirm card — the person is about to say yes. */
export function cautions(run: DryRun): string[] {
  return warnings(run.report).map((d) => d.message)
}

/**
 * Plain English for one action, resolved against the state it applied to, so
 * "remove row 2" can say which block that actually was.
 */
function describe(action: ProposedAction, before: BenchState): string {
  const preset = before.config.presets[before.selected]
  const rowName = (i: number) => {
    const row = preset?.list?.[i]
    if (!row) return `row ${i + 1}`
    const spec = effectByName(row.effect)
    return spec ? spec.label : row.effect
  }

  switch (action.type) {
    case 'set-pack-name':
      return `Name the pack "${action.name}"`
    case 'add-preset':
      return 'Add a new preset'
    case 'remove-preset':
      return `Remove the preset "${before.config.presets[action.index]?.name ?? action.index + 1}"`
    case 'set-preset-field':
      return action.field === 'name'
        ? `Name this preset "${action.value}"`
        : `Add a note to this preset`
    case 'add-row': {
      const spec = effectByName(action.effect)
      return `Add ${spec ? spec.label : action.effect}${spec ? ` — ${spec.blurb}` : ''}`
    }
    case 'remove-row':
      return `Remove ${rowName(action.row)}`
    case 'move-row':
      return `Move ${rowName(action.from)} to position ${action.to + 1}`
    case 'set-param': {
      const row = preset?.list?.[action.row]
      const label = rowName(action.row)
      if (action.value === undefined) return `Leave ${label}'s ${action.param} at the mic's own setting`
      const readout = row ? paramReadout(row.effect, action.param, action.value) : undefined
      return `Set ${label}'s ${action.param} to ${readout ?? action.value}`
    }
    case 'set-mod': {
      if (!action.patch) return `Stop the ${action.kind} changing anything`
      const target =
        action.patch.target === 'lfo'
          ? 'the wobble itself'
          : typeof action.patch.row === 'number'
            ? rowName(action.patch.row)
            : 'something'
      const verb = action.kind === 'handle' ? 'Squeezing' : action.kind === 'shake' ? 'Shaking' : 'The wobble'
      return `${verb} changes ${target}${action.patch.param ? `'s ${action.patch.param}` : ''}`
    }
    case 'set-trigger':
      return action.row === undefined
        ? 'Leave the sample button doing nothing'
        : `Point the sample button at ${rowName(action.row)}`
    case 'load':
      return `Load a whole pack: "${action.config.name ?? 'unnamed'}" with ${action.config.presets.length} preset${action.config.presets.length === 1 ? '' : 's'}`
  }
}
