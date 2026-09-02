export type Severity = 'error' | 'warning'

export interface Diagnostic {
  severity: Severity
  /** Stable machine-readable code, safe to branch on. */
  code: string
  /** Where it is, in a form the editor can jump to: presets[0].list[2].cutoff */
  path: string
  /** What is wrong, in the user's language. */
  message: string
  /** What to do about it. */
  fix?: string
}

export interface Report {
  /** True when nothing would stop the mic booting. Warnings do not block. */
  ok: boolean
  diagnostics: Diagnostic[]
}

export const errors = (r: Report) => r.diagnostics.filter((d) => d.severity === 'error')
export const warnings = (r: Report) => r.diagnostics.filter((d) => d.severity === 'warning')

export class Collector {
  readonly diagnostics: Diagnostic[] = []

  error(code: string, path: string, message: string, fix?: string) {
    this.diagnostics.push({ severity: 'error', code, path, message, fix })
  }

  warn(code: string, path: string, message: string, fix?: string) {
    this.diagnostics.push({ severity: 'warning', code, path, message, fix })
  }

  report(): Report {
    return { ok: !this.diagnostics.some((d) => d.severity === 'error'), diagnostics: this.diagnostics }
  }
}

/** Levenshtein-lite: is `a` probably a typo of `b`? Used for "did you mean". */
export function nearest(input: string, candidates: string[]): string | undefined {
  const a = input.toLowerCase()
  let best: string | undefined
  let bestScore = Infinity
  for (const c of candidates) {
    const b = c.toLowerCase()
    if (a === b) return c
    const d = distance(a, b)
    if (d < bestScore) {
      bestScore = d
      best = c
    }
  }
  // Only suggest when it is close enough to be a plausible slip.
  return bestScore <= Math.max(2, Math.floor(a.length / 3)) ? best : undefined
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const cur = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}
