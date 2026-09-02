/**
 * Undo and redo, as a reducer wrapped around the bench reducer.
 *
 * Every edit snapshots the config it replaces. Two things are deliberately
 * not edits: selecting a preset and moving the handle. They change what you
 * are looking at, not what would be written to the mic, and undoing them
 * would feel like the button was broken.
 *
 * A slider drag arrives as dozens of set-param actions. They coalesce into
 * one step while they keep hitting the same parameter inside a short window,
 * so undo takes the whole drag back rather than one pixel of it. The same
 * applies to typing into a name field.
 */
import { reduce, type Action, type BenchState } from './state'
import type { Config } from '../fxmic/types'

interface Snapshot {
  config: Config
  selected: number
}

export interface HistoryState {
  present: BenchState
  past: Snapshot[]
  future: Snapshot[]
  /** Which edit the last snapshot belongs to, for coalescing. */
  lastKey?: string
  lastAt: number
}

export type HistoryAction = Action | { type: 'undo' } | { type: 'redo' }

export const HISTORY_LIMIT = 100
const COALESCE_MS = 1000

export function initialHistory(present: BenchState): HistoryState {
  return { present, past: [], future: [], lastAt: 0 }
}

/** The key two actions must share to fold into one undo step, or undefined if they never fold. */
export function coalesceKey(action: Action): string | undefined {
  switch (action.type) {
    case 'set-param':
      return `set-param:${action.row}:${action.param}`
    case 'set-pack-name':
      return 'set-pack-name'
    case 'set-preset-field':
      return `set-preset-field:${action.field}`
    case 'set-mod':
      return `set-mod:${action.kind}:${Object.keys(action.patch ?? {}).join(',')}`
    case 'set-handle':
    case 'select':
      return undefined
    default:
      return undefined
  }
}

const isEdit = (action: Action) => action.type !== 'select' && action.type !== 'set-handle'

export function createHistoryReducer(now: () => number = () => Date.now()) {
  return function historyReduce(state: HistoryState, action: HistoryAction): HistoryState {
    if (action.type === 'undo') {
      const snapshot = state.past[state.past.length - 1]
      if (!snapshot) return state
      return {
        present: { ...state.present, config: snapshot.config, selected: snapshot.selected, dirty: true },
        past: state.past.slice(0, -1),
        future: [current(state.present), ...state.future],
        lastAt: 0,
      }
    }

    if (action.type === 'redo') {
      const snapshot = state.future[0]
      if (!snapshot) return state
      return {
        present: { ...state.present, config: snapshot.config, selected: snapshot.selected, dirty: true },
        past: [...state.past, current(state.present)],
        future: state.future.slice(1),
        lastAt: 0,
      }
    }

    const present = reduce(state.present, action)
    if (present === state.present || !isEdit(action) || present.config === state.present.config) {
      return present === state.present ? state : { ...state, present }
    }

    const at = now()
    const key = coalesceKey(action)
    const folds = key !== undefined && key === state.lastKey && at - state.lastAt < COALESCE_MS
    if (folds) return { ...state, present, lastAt: at }

    const past = [...state.past, current(state.present)]
    if (past.length > HISTORY_LIMIT) past.shift()
    return { present, past, future: [], lastKey: key, lastAt: at }
  }
}

export const historyReduce = createHistoryReducer()

const current = (s: BenchState): Snapshot => ({ config: s.config, selected: s.selected })
