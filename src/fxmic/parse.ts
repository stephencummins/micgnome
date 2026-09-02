/**
 * The importer.
 *
 * Deliberately more forgiving than the validator, because a broken config is
 * exactly the one you most need to open. It parses what it can, says what it
 * had to change, and hands you something editable — it never throws, and it
 * never silently rewrites your file on disk.
 */
import { Collector, type Diagnostic } from './diagnostics'

export interface ParseResult {
  /** The parsed config, or undefined if even the repairs could not rescue it. */
  value?: unknown
  /** Repairs the importer applied in memory to get this far. */
  repairs: Repair[]
  diagnostics: Diagnostic[]
}

export interface Repair {
  kind: 'trailing-comma' | 'comment' | 'single-quote' | 'unquoted-key' | 'missing-comma' | 'bom'
  count: number
  description: string
}

export function parseConfig(text: string): ParseResult {
  const c = new Collector()

  const direct = tryParse(text)
  if (direct.ok) return { value: direct.value, repairs: [], diagnostics: [] }

  const { repaired, repairs } = repair(text)
  const second = tryParse(repaired)

  if (second.ok) {
    for (const r of repairs) {
      c.warn('repaired', '', r.description, 'Mic Gnome fixed this to open the file. Saving will write it back correctly.')
    }
    return { value: second.value, repairs, diagnostics: c.diagnostics }
  }

  // Beyond repair — report the original failure, which is the useful one.
  const at = locate(text, direct.position)
  c.error(
    'json-broken',
    at ? `line ${at.line}` : '',
    at
      ? `The file is not valid JSON: ${direct.message} (line ${at.line}, column ${at.column})`
      : `The file is not valid JSON: ${direct.message}`,
    at ? `Near: ${at.excerpt}` : 'A missing or extra comma is the most common cause.',
  )
  return { repairs, diagnostics: c.diagnostics }
}

interface TryResult {
  ok: boolean
  value?: unknown
  message: string
  position?: number
}

function tryParse(text: string): TryResult {
  try {
    return { ok: true, value: JSON.parse(text), message: '' }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    return { ok: false, message: cleanMessage(raw), position: findPosition(raw, text) }
  }
}

/**
 * Engines disagree about what they tell you, and V8 changed its mind in Node 20.
 * Three formats, in descending order of how much they give us away:
 *   1. "... in JSON at position 42 (line 3 column 5)"
 *   2. "... at position 42"
 *   3. `Unexpected token '}', ..."list": [ }}}" is not valid JSON`  — no position
 *      at all, just a snippet, which we look up in the source ourselves.
 * A config that will not open is the moment a line number is worth most, so it
 * is worth chasing all three rather than shrugging.
 */
function findPosition(raw: string, text: string): number | undefined {
  const byPosition = /position (\d+)/.exec(raw)
  if (byPosition) return Number(byPosition[1])

  const snippet = extractSnippet(raw)
  if (snippet) {
    const at = text.indexOf(snippet)
    if (at >= 0) {
      // Point at the offending token inside the snippet where we know it.
      const token = /Unexpected token '(.)'/.exec(raw)?.[1]
      const offset = token ? snippet.lastIndexOf(token) : -1
      return at + (offset >= 0 ? offset : Math.max(0, snippet.length - 1))
    }
  }

  if (/Unexpected end of (JSON input|input)/.test(raw)) return Math.max(0, text.length - 1)
  return undefined
}

function extractSnippet(raw: string): string | undefined {
  const m = /(?:\.\.\.)?"(.+)"\s+is not valid JSON/s.exec(raw)
  return m?.[1]
}

/** The engine's own wording, minus the parts we render ourselves. */
function cleanMessage(message: string): string {
  return message
    .replace(/^JSON\.parse: /, '')
    .replace(/,?\s*(?:\.\.\.)?".+"\s+is not valid JSON$/s, '')
    .replace(/ in JSON at position \d+.*$/, '')
    .replace(/ at position \d+.*$/, '')
    .replace(/\s+$/, '')
    .replace(/[,.]$/, '')
    .trim()
}

function locate(text: string, position?: number) {
  if (position === undefined || position < 0) return undefined
  const clamped = Math.min(position, Math.max(0, text.length - 1))
  const before = text.slice(0, clamped)
  const line = before.split('\n').length
  const column = clamped - before.lastIndexOf('\n')
  const lineText = text.split('\n')[line - 1] ?? ''
  return { line, column, excerpt: lineText.trim().slice(0, 80) }
}

/**
 * The repair pipeline, ordered so each pass sees clean input from the last.
 * Strings are skipped throughout — a comma inside a preset name is not a bug.
 */
function repair(text: string): { repaired: string; repairs: Repair[] } {
  const repairs: Repair[] = []
  let out = text

  if (out.charCodeAt(0) === 0xfeff) {
    out = out.slice(1)
    repairs.push({ kind: 'bom', count: 1, description: 'Removed a byte-order mark before the opening brace.' })
  }

  let comments = 0
  out = mapOutsideStrings(out, (chunk) => {
    return chunk
      .replace(/\/\*[\s\S]*?\*\//g, (m) => {
        comments++
        return ' '.repeat(m.length)
      })
      .replace(/\/\/[^\n]*/g, (m) => {
        comments++
        return ' '.repeat(m.length)
      })
  })
  if (comments) {
    repairs.push({ kind: 'comment', count: comments, description: `Removed ${comments} comment${comments === 1 ? '' : 's'} — JSON does not allow them.` })
  }

  let trailing = 0
  out = mapOutsideStrings(out, (chunk) =>
    chunk.replace(/,(\s*[}\]])/g, (_m, tail) => {
      trailing++
      return tail
    }),
  )
  if (trailing) {
    repairs.push({ kind: 'trailing-comma', count: trailing, description: `Removed ${trailing} trailing comma${trailing === 1 ? '' : 's'} before a closing bracket.` })
  }

  let missing = 0
  out = mapOutsideStrings(out, (chunk) =>
    chunk.replace(/([}\]"])(\s*\n\s*)(["{[])/g, (_m, a, gap, b) => {
      missing++
      return `${a},${gap}${b}`
    }),
  )
  if (missing) {
    repairs.push({ kind: 'missing-comma', count: missing, description: `Added ${missing} missing comma${missing === 1 ? '' : 's'} between entries — the guide calls this the number one cause of a config the mic will not read.` })
  }

  return { repaired: out, repairs }
}

/**
 * Applies `fn` only to the parts of the text that are outside double-quoted
 * strings, so repairs never corrupt a name, comment or filename.
 */
function mapOutsideStrings(text: string, fn: (chunk: string) => string): string {
  let out = ''
  let i = 0
  let chunkStart = 0
  let inString = false

  while (i < text.length) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === '"') {
        inString = false
        out += text.slice(chunkStart, i + 1)
        chunkStart = i + 1
      }
    } else if (ch === '"') {
      out += fn(text.slice(chunkStart, i))
      chunkStart = i
      inString = true
    }
    i++
  }

  out += inString ? text.slice(chunkStart) : fn(text.slice(chunkStart))
  return out
}
